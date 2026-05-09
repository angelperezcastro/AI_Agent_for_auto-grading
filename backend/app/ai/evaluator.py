from __future__ import annotations

import json
import os
import re
import time
from typing import Any, Mapping, Sequence, TypedDict

from dotenv import load_dotenv
from google import genai
from google.genai import types

from app.ai.prompts import CRITERIA_BY_DELIVERABLE, PROMPT_BUILDERS


load_dotenv()


class EvaluationMalformedResponseError(ValueError):
    """Raised when Gemini returns invalid or non-compliant evaluation JSON."""


class EvaluationResult(TypedDict):
    score: int
    criteria: dict[str, int]
    feedback: str


def _get_client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")

    if not api_key or api_key.strip().lower() == "dummy":
        raise RuntimeError("GEMINI_API_KEY is missing or invalid. Add a real key to backend/.env")

    return genai.Client(api_key=api_key.strip())


def _get_primary_model_name() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip()


def _get_fallback_model_name() -> str:
    return os.getenv("GEMINI_FALLBACK_MODEL", "gemini-1.5-flash").strip()


def _strip_json_fences(raw_text: str) -> str:
    text = raw_text.strip()

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

    return text.strip()


def _extract_json_object(raw_text: str) -> str:
    """
    Gemini usually returns pure JSON when response_mime_type is application/json.
    This fallback also handles Markdown fences or small text prefixes/suffixes.
    """
    text = _strip_json_fences(raw_text)

    if text.startswith("{") and text.endswith("}"):
        return text

    start = text.find("{")
    end = text.rfind("}")

    if start == -1 or end == -1 or end <= start:
        raise EvaluationMalformedResponseError(
            f"Could not find a JSON object in Gemini response. Raw response: {raw_text[:1000]}"
        )

    return text[start : end + 1]


def _parse_json(raw_text: str) -> dict[str, Any]:
    text = _extract_json_object(raw_text)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise EvaluationMalformedResponseError(
            f"Gemini returned invalid JSON: {exc}. Raw response: {raw_text[:1000]}"
        ) from exc

    if not isinstance(parsed, dict):
        raise EvaluationMalformedResponseError("Gemini JSON response must be an object.")

    return parsed


def _coerce_int(value: Any, field_name: str) -> int:
    if isinstance(value, bool):
        raise EvaluationMalformedResponseError(f"{field_name} must be numeric, not boolean.")

    if isinstance(value, int):
        return value

    if isinstance(value, float):
        return int(round(value))

    if isinstance(value, str):
        match = re.search(r"-?\d+(?:\.\d+)?", value.strip())
        if match:
            return int(round(float(match.group(0))))

    raise EvaluationMalformedResponseError(f"{field_name} must be an integer-compatible value.")


def _normalise_key(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _distribute_score_across_criteria(
    score: int,
    expected_criteria: Mapping[str, int],
) -> dict[str, int]:
    """Distribute a total score proportionally across rubric weights."""
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

    criteria_sum = sum(repaired.values())

    # The project rubric expects the total score to equal the criteria sum.
    # If Gemini returns a close but inconsistent total, trust the criterion breakdown.
    if criteria_sum != score:
        return repaired

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
        f'- "{criterion_name}": integer from 0 to {max_points}'
        for criterion_name, max_points in expected_criteria.items()
    )

    return f"""
{base_prompt}

STRICT OUTPUT CONTRACT:
Return ONLY one valid JSON object. Do not use Markdown fences. Do not add commentary outside JSON.
The JSON object must have exactly this structure:
{{
  "score": integer from 0 to 100,
  "criteria": {{
{criteria_lines}
  }},
  "feedback": "detailed constructive feedback"
}}

Rules:
- The score must equal the sum of all criteria values.
- The criteria keys must use the exact names shown above.
- Feedback should be specific, constructive, and refer to the student's actual submission.
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
            max_output_tokens=4096,
            response_mime_type="application/json",
        ),
    )

    raw_text = getattr(response, "text", None)

    if raw_text:
        return raw_text

    # Some SDK versions expose candidates even when .text is empty.
    candidates = getattr(response, "candidates", None)
    if candidates:
        raise EvaluationMalformedResponseError(
            f"Gemini returned no response.text using model {model_name}. Candidates: {candidates}"
        )

    raise EvaluationMalformedResponseError(
        f"Gemini returned an empty response using model {model_name}. Full response: {response}"
    )


def _generate_json_with_gemini(prompt: str) -> str:
    client = _get_client()

    model_attempts = []
    for model_name in [_get_primary_model_name(), _get_fallback_model_name()]:
        if model_name and model_name not in model_attempts:
            model_attempts.append(model_name)

    last_error: Exception | None = None

    for model_name in model_attempts:
        for attempt in range(1, 4):
            try:
                return _generate_once(
                    client=client,
                    model_name=model_name,
                    prompt=prompt,
                )
            except Exception as exc:
                last_error = exc
                print(
                    f"[Gemini evaluator] Attempt {attempt}/3 failed with model {model_name}: {type(exc).__name__}: {exc}"
                )

                if attempt < 3:
                    time.sleep(attempt * 2)

        print(f"[Gemini evaluator] Falling back from {model_name} to next model.")

    raise RuntimeError(
        f"Gemini evaluation failed after all model attempts. Last error: {type(last_error).__name__}: {last_error}"
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

    raw_text = _generate_json_with_gemini(prompt=prompt)
    parsed = _parse_json(raw_text)

    return _validate_result(
        parsed=parsed,
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
