from __future__ import annotations

import json
import os
import re
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

    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is missing. Add it to backend/.env")

    return genai.Client(api_key=api_key)


def _get_primary_model_name() -> str:
    return os.getenv("GEMINI_MODEL", "gemini-2.5-flash")


def _get_fallback_model_name() -> str:
    return os.getenv("GEMINI_FALLBACK_MODEL", "gemini-2.5-flash-lite")


def _build_response_schema(expected_criteria: Mapping[str, int]) -> dict[str, Any]:
    """
    Builds a Gemini-compatible schema.

    Important:
    - Do NOT use additionalProperties. Gemini API does not support it.
    - Criteria keys are explicitly declared because a generic object may be returned as {}.
    """
    return {
        "type": "OBJECT",
        "required": ["score", "criteria", "feedback"],
        "properties": {
            "score": {
                "type": "INTEGER",
                "description": "Total score from 0 to 100. Must equal the sum of all criterion scores.",
            },
            "criteria": {
                "type": "OBJECT",
                "required": list(expected_criteria.keys()),
                "properties": {
                    criterion_name: {
                        "type": "INTEGER",
                        "description": f"Score for '{criterion_name}', from 0 to {max_points}.",
                    }
                    for criterion_name, max_points in expected_criteria.items()
                },
            },
            "feedback": {
                "type": "STRING",
                "description": "Detailed constructive feedback of at least 150 words.",
            },
        },
    }


def _strip_json_fences(raw_text: str) -> str:
    text = raw_text.strip()

    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)

    return text.strip()


def _parse_json(raw_text: str) -> dict[str, Any]:
    text = _strip_json_fences(raw_text)

    try:
        parsed = json.loads(text)
    except json.JSONDecodeError as exc:
        raise EvaluationMalformedResponseError(
            f"Gemini returned invalid JSON: {exc}. Raw response: {raw_text[:1000]}"
        ) from exc

    if not isinstance(parsed, dict):
        raise EvaluationMalformedResponseError("Gemini JSON response must be an object.")

    return parsed


def _ensure_int(value: Any, field_name: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int):
        raise EvaluationMalformedResponseError(f"{field_name} must be an integer.")

    return value


def _count_words(text: str) -> int:
    return len(re.findall(r"\b\w+\b", text, flags=re.UNICODE))


def _validate_result(
    parsed: Mapping[str, Any],
    expected_criteria: Mapping[str, int],
) -> EvaluationResult:
    required_top_level_keys = {"score", "criteria", "feedback"}
    missing_keys = required_top_level_keys - set(parsed.keys())

    if missing_keys:
        raise EvaluationMalformedResponseError(
            f"Missing top-level keys: {sorted(missing_keys)}"
        )

    score = _ensure_int(parsed["score"], "score")

    if not 0 <= score <= 100:
        raise EvaluationMalformedResponseError("score must be between 0 and 100.")

    criteria = parsed["criteria"]

    if not isinstance(criteria, dict):
        raise EvaluationMalformedResponseError("criteria must be an object.")

    expected_names = set(expected_criteria.keys())
    actual_names = set(criteria.keys())

    if actual_names != expected_names:
        raise EvaluationMalformedResponseError(
            "criteria keys do not match expected rubric. "
            f"Expected: {sorted(expected_names)}. Got: {sorted(actual_names)}"
        )

    validated_criteria: dict[str, int] = {}

    for criterion_name, max_points in expected_criteria.items():
        criterion_score = _ensure_int(
            criteria[criterion_name],
            f"criteria.{criterion_name}",
        )

        if not 0 <= criterion_score <= max_points:
            raise EvaluationMalformedResponseError(
                f"criteria.{criterion_name} must be between 0 and {max_points}."
            )

        validated_criteria[criterion_name] = criterion_score

    criteria_sum = sum(validated_criteria.values())

    if criteria_sum != score:
        raise EvaluationMalformedResponseError(
            f"score must equal the sum of criteria scores. "
            f"score={score}, criteria_sum={criteria_sum}."
        )

    feedback = parsed["feedback"]

    if not isinstance(feedback, str):
        raise EvaluationMalformedResponseError("feedback must be a string.")

    feedback = feedback.strip()

    if _count_words(feedback) < 150:
        raise EvaluationMalformedResponseError(
            "feedback must contain at least 150 words."
        )

    return {
        "score": score,
        "criteria": validated_criteria,
        "feedback": feedback,
    }


def _generate_once(
    client: genai.Client,
    model_name: str,
    prompt: str,
    expected_criteria: Mapping[str, int],
) -> str:
    response = client.models.generate_content(
        model=model_name,
        contents=prompt,
        config=types.GenerateContentConfig(
            temperature=0.1,
            top_p=0.8,
            max_output_tokens=4096,
            response_mime_type="application/json",
            response_schema=_build_response_schema(expected_criteria),
        ),
    )

    raw_text = getattr(response, "text", None)

    if not raw_text:
        raise EvaluationMalformedResponseError(
            f"Gemini returned an empty response using model {model_name}."
        )

    return raw_text


def _generate_json_with_gemini(
    prompt: str,
    expected_criteria: Mapping[str, int],
) -> str:
    """
    Calls Gemini with a primary model and a fallback model.

    Handles temporary 503/high-demand errors by retrying automatically.
    """
    import time

    client = _get_client()

    model_attempts = [
        _get_primary_model_name(),
        _get_fallback_model_name(),
    ]

    last_error: Exception | None = None

    for model_name in model_attempts:
        for attempt in range(1, 4):
            try:
                return _generate_once(
                    client=client,
                    model_name=model_name,
                    prompt=prompt,
                    expected_criteria=expected_criteria,
                )
            except Exception as exc:
                last_error = exc
                message = str(exc).lower()

                is_temporary_capacity_error = (
                    "503" in message
                    or "unavailable" in message
                    or "high demand" in message
                    or "temporarily" in message
                )

                if not is_temporary_capacity_error:
                    raise

                if attempt < 3:
                    sleep_seconds = attempt * 2
                    print(
                        f"[Gemini] Temporary error with {model_name}. "
                        f"Retrying in {sleep_seconds}s..."
                    )
                    time.sleep(sleep_seconds)

        print(f"[Gemini] Falling back from {model_name} to next available model.")

    raise RuntimeError(
        f"Gemini evaluation failed after retries and fallback model. Last error: {last_error}"
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

    prompt = PROMPT_BUILDERS[deliverable_number](
        project_topic=project_topic.strip(),
        deliverable_content=deliverable_content.strip(),
        previous_submissions=previous_submissions,
    )

    raw_text = _generate_json_with_gemini(
        prompt=prompt,
        expected_criteria=expected_criteria,
    )

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