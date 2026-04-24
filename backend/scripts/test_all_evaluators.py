import json
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_ROOT))

from app.ai.evaluator import (
    evaluate_deliverable_1,
    evaluate_deliverable_2,
    evaluate_deliverable_3,
    evaluate_deliverable_4,
)


PROJECT_TOPIC = "AI-powered web platform for automatic grading of Software Engineering deliverables"


def print_result(title: str, result: dict) -> None:
    print("\n" + "=" * 100)
    print(title)
    print("=" * 100)
    print(json.dumps(result, indent=2, ensure_ascii=False))


def main() -> None:
    d1_content = """
    This project aims to solve the problem of delayed feedback in Software Engineering courses.
    Students often submit requirements engineering documents and wait several days or weeks before receiving
    comments from professors. This delay reduces the usefulness of the feedback because students cannot quickly
    improve their next deliverable.

    The proposed platform uses an AI agent to evaluate four sequential deliverables: research and motivation,
    user requirements, target group questions, and an updated requirements document. The system gives students
    immediate feedback and helps professors supervise progress more efficiently.

    The motivation for this project is both academic and practical. From an academic perspective, it demonstrates
    how LLMs can be integrated into a real software workflow. From a practical perspective, it reduces repetitive
    grading work and improves learning speed. Sources considered include university assessment practices,
    requirements engineering guidelines, and documentation about LLM-based feedback systems.
    """

    d1_result = evaluate_deliverable_1(
        project_topic=PROJECT_TOPIC,
        deliverable_content=d1_content,
        previous_submissions=[],
    )

    print_result("DELIVERABLE 1 RESULT", d1_result)

    previous_d1 = {
        "deliverable_number": 1,
        "content": d1_content,
        "score": d1_result["score"],
        "feedback": d1_result["feedback"],
    }

    d2_content = """
    REQ-001: The system shall allow students to register and log in using an email and password.
    REQ-002: The system shall allow professors to create subjects.
    REQ-003: The system shall allow professors to create projects inside subjects.
    REQ-004: The system shall allow students to enroll in one active project per subject.
    REQ-005: The system shall allow students to submit four deliverables in strict sequential order.
    REQ-006: The system shall prevent students from submitting deliverable N+1 until deliverable N has been evaluated.
    REQ-007: The system shall evaluate each submitted deliverable using an AI agent.
    REQ-008: The system shall store the AI score, criteria breakdown, and feedback.
    REQ-009: The system shall send an email confirmation to the student after each submission.
    REQ-010: The system shall notify the professor by email when a student submits a deliverable.
    REQ-011: The system shall send the AI feedback to the student by email after grading.
    REQ-012: The system shall allow professors to override AI scores with a manual comment.
    """

    d2_result = evaluate_deliverable_2(
        project_topic=PROJECT_TOPIC,
        deliverable_content=d2_content,
        previous_submissions=[previous_d1],
    )

    print_result("DELIVERABLE 2 RESULT", d2_result)

    previous_d2 = {
        "deliverable_number": 2,
        "content": d2_content,
        "score": d2_result["score"],
        "feedback": d2_result["feedback"],
    }

    d3_content = """
    1. When you submit an academic assignment, what kind of feedback do you find most useful?
    2. What problems have you experienced when feedback arrives too late?
    3. How would you prefer to receive AI-generated feedback: inside the platform, by email, or both?
    4. What information would make you trust or distrust an AI-generated grade?
    5. Which parts of requirements engineering assignments are hardest for you to improve without feedback?
    6. What should happen if you disagree with the AI score?
    7. How detailed should the criteria breakdown be?
    8. Would you prefer short feedback, detailed feedback, or both?
    9. What deadlines or reminders would help you submit deliverables on time?
    10. What would make the platform easier to use during a real university course?
    """

    d3_result = evaluate_deliverable_3(
        project_topic=PROJECT_TOPIC,
        deliverable_content=d3_content,
        previous_submissions=[previous_d1, previous_d2],
    )

    print_result("DELIVERABLE 3 RESULT", d3_result)

    previous_d3 = {
        "deliverable_number": 3,
        "content": d3_content,
        "score": d3_result["score"],
        "feedback": d3_result["feedback"],
    }

    d4_content = """
    REQ-001: The system shall allow students to register and log in using an email and password.
    REQ-002: The system shall allow professors to create, edit, and delete subjects.
    REQ-003: The system shall allow professors to create, edit, and delete projects inside subjects.
    REQ-004: The system shall allow students to enroll in one active project per subject.
    REQ-005: The system shall allow students to submit four deliverables in strict sequential order.
    REQ-006: The system shall prevent students from submitting deliverable N+1 until deliverable N has been evaluated.
    REQ-007: The system shall evaluate each submitted deliverable using an AI agent.
    REQ-008: The system shall store the AI score, criteria breakdown, and feedback.
    REQ-009: The system shall send an email confirmation to the student after each submission.
    REQ-010: The system shall notify the professor by email when a student submits a deliverable.
    REQ-011: The system shall send the AI feedback to the student by email after grading.
    REQ-012: The system shall allow professors to override AI scores with a manual comment.
    REQ-013: The system shall show students both a short summary and detailed feedback after evaluation.
    REQ-014: The system shall show a transparent criteria breakdown to improve trust in AI grading.
    REQ-015: The system shall allow students to see whether a score was generated by AI or overridden by a professor.
    REQ-016: The system shall send deadline reminders before a deliverable expires.
    REQ-017: The system shall show students the deadline of the currently unlocked deliverable.
    REQ-018: The system shall provide clear next-step guidance after each submission.
    NFR-001: The system should return API responses in under 500 ms when no AI evaluation is running synchronously.
    NFR-002: The system should store Gmail OAuth credentials encrypted at rest.
    NFR-003: The system should log email delivery attempts for auditability.
    """

    d4_result = evaluate_deliverable_4(
        project_topic=PROJECT_TOPIC,
        deliverable_content=d4_content,
        previous_submissions=[previous_d1, previous_d2, previous_d3],
    )

    print_result("DELIVERABLE 4 RESULT", d4_result)


if __name__ == "__main__":
    main()