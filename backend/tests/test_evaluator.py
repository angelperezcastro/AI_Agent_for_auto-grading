from __future__ import annotations

import os
import time
from dataclasses import dataclass

import pytest

from app.ai.evaluator import EvaluationResult, evaluate_by_deliverable_number


RUN_LIVE_GEMINI_TESTS = os.getenv("RUN_LIVE_GEMINI_TESTS") == "1"
GEMINI_TEST_DELAY_SECONDS = float(os.getenv("GEMINI_TEST_DELAY_SECONDS", "7"))

pytestmark = pytest.mark.skipif(
    not RUN_LIVE_GEMINI_TESTS,
    reason="Live Gemini tests skipped. Set RUN_LIVE_GEMINI_TESTS=1 to run them.",
)


@pytest.fixture(autouse=True)
def rate_limit_live_gemini_tests() -> None:
    """
    Prevents free-tier Gemini per-minute rate limit errors during live tests.

    This does not bypass daily free-tier quota. If the daily quota is reached,
    the test is skipped by _evaluate_or_skip_on_quota().
    """
    if RUN_LIVE_GEMINI_TESTS:
        time.sleep(GEMINI_TEST_DELAY_SECONDS)


PROJECT_TOPIC = "AI-powered platform for automatic grading of Software Engineering requirements deliverables"


@dataclass(frozen=True)
class EvaluatorCase:
    name: str
    deliverable_number: int
    quality: str
    content: str
    previous_submissions: list[dict]


def _is_gemini_quota_error(exc: Exception) -> bool:
    message = str(exc).lower()

    return (
        "429" in message
        or "resource_exhausted" in message
        or "quota" in message
        or "rate limit" in message
        or "too many requests" in message
    )


def _evaluate_or_skip_on_quota(
    *,
    deliverable_number: int,
    project_topic: str,
    deliverable_content: str,
    previous_submissions: list[dict],
) -> EvaluationResult:
    try:
        return evaluate_by_deliverable_number(
            deliverable_number=deliverable_number,
            project_topic=project_topic,
            deliverable_content=deliverable_content,
            previous_submissions=previous_submissions,
        )
    except Exception as exc:
        if _is_gemini_quota_error(exc):
            pytest.skip(f"Gemini live test skipped because quota/rate limit was reached: {exc}")

        raise


def _assert_valid_result(result: EvaluationResult) -> None:
    assert isinstance(result["score"], int)
    assert 0 <= result["score"] <= 100
    assert isinstance(result["criteria"], dict)
    assert result["criteria"]
    assert isinstance(result["feedback"], str)
    assert len(result["feedback"].split()) >= 120


D1_LOW = """
I want to make an app about AI grading because it is useful. Students send things and the AI gives marks.
I think it can help teachers. I searched some websites but I do not remember which ones.
"""

D1_MEDIUM = """
The project addresses delayed feedback in Software Engineering courses. Students often wait too long after
submitting requirements engineering assignments, which reduces the usefulness of feedback. The proposed platform
uses an AI agent to evaluate four sequential deliverables and provide immediate comments. The motivation is academic
and practical: it demonstrates LLM integration in a real educational workflow and may reduce repetitive grading work.
Sources considered include requirements engineering guidelines, university assessment practices and Gemini API
documentation, although specific citations are still limited.
"""

D1_HIGH = """
This project investigates how AI-assisted evaluation can reduce delayed feedback in Software Engineering courses,
specifically during requirements engineering activities. In many academic settings, students submit research notes,
requirements lists and interview questions, but feedback often arrives after the next task has already begun. This
weakens formative assessment and limits iterative improvement.

The proposed system is a web platform where students complete four sequential deliverables and receive AI-generated
feedback with a score and criterion-level breakdown. The professor remains in control through dashboards and manual
score overrides. The motivation is to combine educational value with a realistic software architecture: FastAPI,
PostgreSQL, React, Gmail API and Gemini.

The research basis includes requirements engineering principles such as traceability, ambiguity reduction and elicitation
quality; academic feedback theory emphasizing timeliness and specificity; and technical documentation on structured LLM
outputs. The project also considers risks: hallucinated feedback, over-reliance on automatic grading, inconsistent scoring
and privacy concerns. These risks justify professor override, transparent criteria and audit logs.
"""

D2_LOW = """
The system should be good.
Students can use it.
Teachers can see things.
AI checks homework.
Emails are sent.
"""

D2_MEDIUM = """
REQ-001: The system shall allow students to register and log in.
REQ-002: The system shall allow professors to create subjects and projects.
REQ-003: The system shall allow students to submit deliverables.
REQ-004: The system shall evaluate submissions with AI.
REQ-005: The system shall send emails to users.
REQ-006: The system shall allow professors to override grades.
"""

D2_HIGH = """
REQ-001: The system shall allow students to register and authenticate using email and password.
REQ-002: The system shall allow professors to create, update and delete subjects.
REQ-003: The system shall allow professors to create projects inside their own subjects.
REQ-004: The system shall enforce that each student has only one active project per subject.
REQ-005: The system shall allow students to submit four deliverables in strict sequential order.
REQ-006: The system shall prevent submission of deliverable N+1 until deliverable N has an evaluation.
REQ-007: The system shall evaluate each submission using an AI agent with deliverable-specific criteria.
REQ-008: The system shall store the AI score, criterion breakdown and feedback for each submission.
REQ-009: The system shall send a confirmation email to the student after submission.
REQ-010: The system shall notify the professor when a student submits a deliverable.
REQ-011: The system shall send the AI feedback email to the student after evaluation.
REQ-012: The system shall allow professors to override AI scores with a manual comment.
NFR-001: The system shall encrypt Gmail OAuth credentials at rest.
NFR-002: The system shall log every email attempt for auditability.
"""

D3_LOW = """
Do you like the app?
Is AI good?
Would you use it?
Is feedback important?
"""

D3_MEDIUM = """
1. What type of feedback is most useful after submitting an academic assignment?
2. How long do you usually wait for feedback?
3. Would you trust an AI-generated score?
4. What would make feedback easier to understand?
5. Do you prefer feedback by email, inside the platform, or both?
6. What should happen if the AI score is wrong?
"""

D3_HIGH = """
1. Can you describe the last time delayed feedback affected your ability to improve a later assignment?
2. Which parts of requirements engineering submissions are hardest to improve without specific feedback?
3. What information would you need to trust an AI-generated score?
4. Which criterion-level details would help you understand why you received a specific score?
5. How should the system communicate uncertainty or limitations in AI feedback?
6. What should happen if you disagree with the AI evaluation?
7. Would receiving both an email and in-platform feedback improve your workflow, or would it feel redundant?
8. What reminders would help you submit each deliverable before the deadline?
9. What privacy concerns would you have if your submissions were evaluated by an AI system?
10. What professor actions would make the automatic grading process feel fair?
11. Can you identify any edge case where the AI might misunderstand a valid submission?
12. How should the final updated requirements document show that new user insights were integrated?
"""

D4_LOW = """
REQ-001: Login.
REQ-002: AI grades.
REQ-003: Emails.
REQ-004: Teacher dashboard.
"""

D4_MEDIUM = """
REQ-001: The system shall allow students to log in.
REQ-002: The system shall allow professors to manage projects.
REQ-003: The system shall evaluate submissions with AI.
REQ-004: The system shall send feedback emails.
REQ-005: The system shall allow professor override.
REQ-006: The system shall show criteria breakdown.
REQ-007: The system shall show deadlines.
"""

D4_HIGH = """
REQ-001: The system shall allow students to register and authenticate using email and password.
REQ-002: The system shall allow professors to create and manage subjects and projects.
REQ-003: The system shall enforce one active project per student per subject.
REQ-004: The system shall enforce sequential submission of four deliverables.
REQ-005: The system shall prevent deliverable N+1 until deliverable N has been evaluated.
REQ-006: The system shall evaluate each submission using a deliverable-specific Gemini prompt.
REQ-007: The system shall store total score, criterion breakdown and detailed feedback.
REQ-008: The system shall send confirmation emails to students after submission.
REQ-009: The system shall notify professors when submissions arrive.
REQ-010: The system shall send feedback emails after AI evaluation.
REQ-011: The system shall allow professor score override with a required manual comment.
REQ-012: The system shall visibly distinguish AI scores from professor-overridden scores.
REQ-013: The system shall log all email attempts, including failures, for auditability.
REQ-014: The system shall show deadline information for the currently unlocked deliverable.
REQ-015: The system shall provide transparent criteria breakdowns to improve student trust.
REQ-016: The system shall explain AI evaluation limitations when fallback/manual review is required.
REQ-017: The system shall preserve previous submissions as context for later evaluations.
REQ-018: The system shall support both in-platform feedback and email feedback, based on user preference.

NFR-001: Gmail OAuth credentials shall be encrypted at rest.
NFR-002: The backend shall avoid blocking the submission request while AI evaluation runs.
NFR-003: The evaluation output shall be validated as structured JSON before storage.
"""


PREVIOUS_D1 = {
    "deliverable_number": 1,
    "content": D1_HIGH,
    "score": 88,
    "feedback": "Strong research, but source specificity could still improve.",
}

PREVIOUS_D2 = {
    "deliverable_number": 2,
    "content": D2_HIGH,
    "score": 90,
    "feedback": "Requirements are clear, traceable and mostly complete.",
}

PREVIOUS_D3 = {
    "deliverable_number": 3,
    "content": D3_HIGH,
    "score": 91,
    "feedback": "Questions explore trust, delayed feedback, disagreement and edge cases.",
}


CASES = [
    EvaluatorCase("D1 low", 1, "low", D1_LOW, []),
    EvaluatorCase("D1 medium", 1, "medium", D1_MEDIUM, []),
    EvaluatorCase("D1 high", 1, "high", D1_HIGH, []),

    EvaluatorCase("D2 low", 2, "low", D2_LOW, [PREVIOUS_D1]),
    EvaluatorCase("D2 medium", 2, "medium", D2_MEDIUM, [PREVIOUS_D1]),
    EvaluatorCase("D2 high", 2, "high", D2_HIGH, [PREVIOUS_D1]),

    EvaluatorCase("D3 low", 3, "low", D3_LOW, [PREVIOUS_D1, PREVIOUS_D2]),
    EvaluatorCase("D3 medium", 3, "medium", D3_MEDIUM, [PREVIOUS_D1, PREVIOUS_D2]),
    EvaluatorCase("D3 high", 3, "high", D3_HIGH, [PREVIOUS_D1, PREVIOUS_D2]),

    EvaluatorCase("D4 low", 4, "low", D4_LOW, [PREVIOUS_D1, PREVIOUS_D2, PREVIOUS_D3]),
    EvaluatorCase("D4 medium", 4, "medium", D4_MEDIUM, [PREVIOUS_D1, PREVIOUS_D2, PREVIOUS_D3]),
    EvaluatorCase("D4 high", 4, "high", D4_HIGH, [PREVIOUS_D1, PREVIOUS_D2, PREVIOUS_D3]),
]


@pytest.mark.parametrize("case", CASES, ids=[case.name for case in CASES])
def test_evaluator_returns_valid_structured_output(case: EvaluatorCase) -> None:
    result = _evaluate_or_skip_on_quota(
        deliverable_number=case.deliverable_number,
        project_topic=PROJECT_TOPIC,
        deliverable_content=case.content,
        previous_submissions=case.previous_submissions,
    )

    _assert_valid_result(result)

    if case.quality == "low":
        assert result["score"] <= 75

    if case.quality == "high":
        assert result["score"] >= 60


@pytest.mark.parametrize("deliverable_number", [1, 2, 3, 4])
def test_scores_are_roughly_proportional_by_quality(deliverable_number: int) -> None:
    deliverable_cases = [
        case for case in CASES if case.deliverable_number == deliverable_number
    ]

    scores: dict[str, int] = {}

    for case in deliverable_cases:
        result = _evaluate_or_skip_on_quota(
            deliverable_number=case.deliverable_number,
            project_topic=PROJECT_TOPIC,
            deliverable_content=case.content,
            previous_submissions=case.previous_submissions,
        )

        _assert_valid_result(result)
        scores[case.quality] = result["score"]

    assert scores["low"] < scores["high"]

    # Medium can be noisy with LLMs, but it should not be wildly inverted.
    assert scores["medium"] >= scores["low"] - 10
    assert scores["medium"] <= scores["high"] + 10


def test_d4_feedback_references_previous_d3_context() -> None:
    result = _evaluate_or_skip_on_quota(
        deliverable_number=4,
        project_topic=PROJECT_TOPIC,
        deliverable_content=D4_HIGH,
        previous_submissions=[PREVIOUS_D1, PREVIOUS_D2, PREVIOUS_D3],
    )

    _assert_valid_result(result)

    feedback_lower = result["feedback"].lower()

    assert any(
        term in feedback_lower
        for term in [
            "d3",
            "deliverable 3",
            "questions",
            "trust",
            "delayed feedback",
            "disagree",
            "edge case",
        ]
    )