from __future__ import annotations

import json
import re
import time
from typing import Any, Mapping, Sequence, TypedDict

from google import genai
from google.genai import types

from app.ai.prompts import CRITERIA_BY_DELIVERABLE, PROMPT_BUILDERS
from app.core.config import settings


class EvaluationMalformedResponseError(ValueError):
    """Raised when Gemini returns invalid or non-compliant evaluation JSON."""


class EvaluationResult(TypedDict):
    score: int
    criteria: dict[str, int]
    feedback: str


def _get_client() -> genai.Client:
    api_key = settings.GEMINI_API_KEY

    if not api_key or api_key.strip().lower() == "dummy":
        raise RuntimeError(
            "GEMINI_API_KEY is missing or invalid. Add a real key to backend/.env and Railway."
        )

    return genai.Client(api_key=api_key.strip())


def _get_model_attempts() -> list[str]:
    """
    Ordered model fallback chain.

    Important:
    - Never fall back to gemini-1.5-flash.
    - Railway/local .env should normally provide:
        GEMINI_MODEL=gemini-2.5-flash
        GEMINI_FALLBACK_MODEL=gemini-2.5-flash-lite
    """

    candidates = [
        getattr(settings, "GEMINI_MODEL", None),
        getattr(settings, "GEMINI_FALLBACK_MODEL", None),
        "gemini-2.5-flash",
        "gemini-2.5-flash-lite",
    ]

    model_attempts: list[str] = []

    for model_name in candidates:
        if not model_name:
            continue

        clean_model_name = str(model_name).strip()

        if clean_model_name and clean_model_name not in model_attempts:
            model_attempts.append(clean_model_name)

    return model_attempts


def _strip_json_fences(raw_text: str) -> str:
    text = raw_text.strip()

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

    return text.strip()


def _extract_json_object(raw_text: str) -> str:
    """
    Gemini should return pure JSON when response_mime_type is application/json.
    This fallback also handles Markdown fences or small text prefixes/suffixes.
    """

    text = _strip_json_fences(raw_text)

    if text.startswith("{") and text.endswith("}"):
        return text

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise EvaluationMalformedResponseError(
            f"Could not find a JSON object in Gemini response. Raw response: {raw_text[:1500]}"
        )

    return text[start : end + 1]


def _escape_control_characters_inside_strings(json_text: str) -> str:
    """
    Repairs a common LLM JSON issue:

    {
      "feedback": "This is a long feedback
      with a raw newline inside the JSON string"
    }

    JSON does not allow raw control characters inside strings.
    This converts raw newlines/tabs/etc. inside strings into escaped sequences.
    """

    result: list[str] = []
    in_string = False
    escaped = False

    for char in json_text:
        if escaped:
            result.append(char)
            escaped = False
            continue

        if char == "\\":
            result.append(char)
            escaped = True
            continue

        if char == '"':
            result.append(char)
            in_string = not in_string
            continue

        if in_string:
            if char == "\n":
                result.append("\\n")
                continue

            if char == "\r":
                result.append("\\r")
                continue

            if char == "\t":
                result.append("\\t")
                continue

            if char == "\b":
                result.append("\\b")
                continue

            if char == "\f":
                result.append("\\f")
                continue

        result.append(char)

    return "".join(result)


def _parse_json(raw_text: str) -> dict[str, Any]:
    json_text = _extract_json_object(raw_text)

    try:
        parsed = json.loads(json_text)
    except json.JSONDecodeError:
        repaired_json_text = _escape_control_characters_inside_strings(json_text)

        try:
            parsed = json.loads(repaired_json_text)
        except json.JSONDecodeError as exc:
            raise EvaluationMalformedResponseError(
                f"Gemini returned invalid JSON: {exc}. Raw response: {raw_text[:3000]}"
            ) from exc

    if not isinstance(parsed, dict):
        raise EvaluationMalformedResponseError("Gemini JSON response must be an object.")

    return parsed


def _coerce_int(value: Any, field_name: str) -> int:
    if isinstance(value, bool):
        raise EvaluationMalformedResponseError(
            f"{field_name} must be numeric, not boolean."
        )

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return int(round(value))

    if isinstance(value, str):
        match = re.search(r"-?\d+(?:\.\d+)?", value.strip())
        if match:
            return int(round(float(match.group(0))))

    raise EvaluationMalformedResponseError(
        f"{field_name} must be an integer-compatible value."
    )


def _normalise_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _distribute_score_across_criteria(
    score: int,
    expected_criteria: Mapping[str, int],
) -> dict[str, int]:
    """
    Distributes a total score proportionally across rubric weights.

    Used only as a repair fallback when Gemini returns missing/malformed criteria.
    """

    score = max(0, min(100, score))
    total_weight = sum(expected_criteria.values()) or 100

    distributed: dict[str, int] = {}
    running_total = 0
    items = list(expected_criteria.items())

    for index, (criterion_name, max_points) in enumerate(items):
        if index == len(items) - 1:
            criterion_score = score - running_total
        else:
            criterion_score = round(score * (max_points / total_weight))
            running_total += criterion_score

        distributed[criterion_name] = max(0, min(max_points, criterion_score))

    # If clamping changed the sum, adjust from the last criterion backwards.
    diff = score - sum(distributed.values())

    for criterion_name, max_points in reversed(items):
        if diff == 0:
            break

        current_value = distributed[criterion_name]

        if diff > 0:
            available = max_points - current_value
            delta = min(available, diff)
            distributed[criterion_name] += delta
            diff -= delta
        else:
            removable = current_value
            delta = min(removable, abs(diff))
            distributed[criterion_name] -= delta
            diff += delta

    return distributed


def _validate_and_repair_criteria(
    raw_criteria: Any,
    score: int,
    expected_criteria: Mapping[str, int],
) -> dict[str, int]:
    if not isinstance(raw_criteria, dict):
        return _distribute_score_across_criteria(score, expected_criteria)

    actual_by_normalized_key = {
        _normalise_key(str(key)): value for key, value in raw_criteria.items()
    }

    repaired: dict[str, int] = {}
    missing_any = False

    for criterion_name, max_points in expected_criteria.items():
        normalized_expected_name = _normalise_key(criterion_name)
        raw_value = actual_by_normalized_key.get(normalized_expected_name)

        if raw_value is None:
            missing_any = True
            break

        criterion_score = _coerce_int(raw_value, f"criteria.{criterion_name}")
        repaired[criterion_name] = max(0, min(max_points, criterion_score))

    if missing_any:
        return _distribute_score_across_criteria(score, expected_criteria)

    return repaired


def _validate_result(
    parsed: Mapping[str, Any],
    expected_criteria: Mapping[str, int],
) -> EvaluationResult:
    if "score" not in parsed:
        raise EvaluationMalformedResponseError("Missing top-level key: score")

    score = _coerce_int(parsed["score"], "score")
    score = max(0, min(100, score))

    criteria = _validate_and_repair_criteria(
        raw_criteria=parsed.get("criteria"),
        score=score,
        expected_criteria=expected_criteria,
    )

    # Store a coherent score that matches the stored rubric breakdown.
    # Your rubric weights sum to 100, so this keeps score and criteria aligned.
    score = max(0, min(100, sum(criteria.values())))

    feedback = parsed.get("feedback", "")

    if not isinstance(feedback, str):
        feedback = str(feedback)

    feedback = feedback.strip()

    if not feedback:
        feedback = (
            "The submission was evaluated against the rubric, but Gemini returned an empty feedback field. "
            "The score and criterion breakdown are still available. Please review the rubric results and improve "
            "clarity, completeness, traceability, and structure in the next deliverable."
        )

    return {
        "score": score,
        "criteria": criteria,
        "feedback": feedback,
    }


def _build_final_prompt(
    base_prompt: str,
    expected_criteria: Mapping[str, int],
) -> str:
    criteria_lines = "\n".join(
        f'    "{criterion_name}": integer from 0 to {max_points}'
        for criterion_name, max_points in expected_criteria.items()
    )

    return f"""
{base_prompt}

STRICT OUTPUT CONTRACT:
Return ONLY one valid JSON object.
Do not use Markdown fences.
Do not add commentary outside JSON.
Do not include trailing commas.
Do not include comments.
Do not insert raw line breaks inside JSON string values.
If a line break is needed inside feedback, encode it as \\n.

The JSON object must have exactly this structure:
{{
  "score": integer from 0 to 100,
  "criteria": {{
{criteria_lines}
  }},
  "feedback": "detailed constructive feedback as one valid JSON string"
}}

Rules:
- The score must equal the sum of all criteria values.
- The criteria keys must use the exact names shown above.
- Each criterion value must be an integer.
- Feedback must be specific, constructive, detailed, and refer to the student's actual submission.
- Feedback must be valid JSON string content: escape quotes and newlines properly.
""".strip()


def _generate_once(
    client: genai.Client,
    model_name: str,
    prompt: str,
) -> str:
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.1,
            top_p=0.8,
            max_output_tokens=8192,
            response_mime_type="application/json",
        ),
    )

    raw_text = getattr(response, "text", None)

    if isinstance(raw_text, str) and raw_text.strip():
        return raw_text.strip()

    candidates = getattr(response, "candidates", None)
    if candidates:
        raise EvaluationMalformedResponseError(
            f"Gemini returned no response.text using model {model_name}. Candidates: {candidates}"
        )

    raise EvaluationMalformedResponseError(
        f"Gemini returned an empty response using model {model_name}. Full response: {response}"
    )


def _generate_valid_result_with_gemini(
    prompt: str,
    expected_criteria: Mapping[str, int],
) -> EvaluationResult:
    client = _get_client()
    model_attempts = _get_model_attempts()

    if not model_attempts:
        raise RuntimeError(
            "No Gemini models configured. Set GEMINI_MODEL and GEMINI_FALLBACK_MODEL."
        )

    last_error: Exception | None = None

    for model_name in model_attempts:
        for attempt in range(1, 4):
            try:
                raw_text = _generate_once(
                    client=client,
                    model_name=model_name,
                    prompt=prompt,
                )

                parsed = _parse_json(raw_text)

                return _validate_result(
                    parsed=parsed,
                    expected_criteria=expected_criteria,
                )

            except Exception as exc:
                last_error = exc
                print(
                    "[Gemini evaluator] "
                    f"Attempt {attempt}/3 failed with model {model_name}: "
                    f"{type(exc).__name__}: {exc}"
                )

                if attempt < 3:
                    time.sleep(attempt * 2)

        print(f"[Gemini evaluator] Falling back from {model_name} to next model.")

    raise RuntimeError(
        "Gemini evaluation failed after all model attempts. "
        f"Last error: {type(last_error).__name__}: {last_error}"
    )


def _run_evaluation(
    deliverable_number: int,
    project_topic: str,
    deliverable_content: str,
    previous_submissions: Sequence[Mapping[str, Any] | str] | None = None,
) -> EvaluationResult:
    if deliverable_number not in PROMPT_BUILDERS:
        raise ValueError("deliverable_number must be 1, 2, 3, or 4.")

    if not project_topic or not project_topic.strip():
        raise ValueError("project_topic cannot be empty.")

    if not deliverable_content or not deliverable_content.strip():
        raise ValueError("deliverable_content cannot be empty.")

    previous_submissions = previous_submissions or []
    expected_criteria = CRITERIA_BY_DELIVERABLE[deliverable_number]

    base_prompt = PROMPT_BUILDERS[deliverable_number](
        project_topic=project_topic.strip(),
        deliverable_content=deliverable_content.strip(),
        previous_submissions=previous_submissions,
    )

    prompt = _build_final_prompt(
        base_prompt=base_prompt,
        expected_criteria=expected_criteria,
    )

    return _generate_valid_result_with_gemini(
        prompt=prompt,
        expected_criteria=expected_criteria,
    )


def evaluate_deliverable_1(
    project_topic: str,
    deliverable_content: str,
    previous_submissions: Sequence[Mapping[str, Any] | str] | None = None,
) -> EvaluationResult:
    return _run_evaluation(
        deliverable_number=1,
        project_topic=project_topic,
        deliverable_content=deliverable_content,
        previous_submissions=previous_submissions,
    )


def evaluate_deliverable_2(
    project_topic: str,
    deliverable_content: str,
    previous_submissions: Sequence[Mapping[str, Any] | str] | None = None,
) -> EvaluationResult:
    return _run_evaluation(
        deliverable_number=2,
        project_topic=project_topic,
        deliverable_content=deliverable_content,
        previous_submissions=previous_submissions,
    )


def evaluate_deliverable_3(
    project_topic: str,
    deliverable_content: str,
    previous_submissions: Sequence[Mapping[str, Any] | str] | None = None,
) -> EvaluationResult:
    return _run_evaluation(
        deliverable_number=3,
        project_topic=project_topic,
        deliverable_content=deliverable_content,
        previous_submissions=previous_submissions,
    )


def evaluate_deliverable_4(
    project_topic: str,
    deliverable_content: str,
    previous_submissions: Sequence[Mapping[str, Any] | str] | None = None,
) -> EvaluationResult:
    return _run_evaluation(
        deliverable_number=4,
        project_topic=project_topic,
        deliverable_content=deliverable_content,
        previous_submissions=previous_submissions,
    )


def evaluate_by_deliverable_number(
    deliverable_number: int,
    project_topic: str,
    deliverable_content: str,
    previous_submissions: Sequence[Mapping[str, Any] | str] | None = None,
) -> EvaluationResult:
    return _run_evaluation(
        deliverable_number=deliverable_number,
        project_topic=project_topic,
        deliverable_content=deliverable_content,
        previous_submissions=previous_submissions,
    )