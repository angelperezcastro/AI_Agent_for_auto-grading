from __future__ import annotations

import os
import traceback
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.evaluator import evaluate_by_deliverable_number
from app.ai.prompts import CRITERIA_BY_DELIVERABLE
from app.models import Enrollment, Evaluation, Project, Submission, User
from app.services.email_resolver import resolve_sender_account
from app.services.email_service import send_email
from app.services.email_templates import feedback_email


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


def _get_platform_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:5173")


def _student_display_name(student: User) -> str:
    name = getattr(student, "name", None)

    if name:
        return str(name)

    email = getattr(student, "email", None)

    if email:
        return str(email).split("@")[0]

    return "student"


def _get_project_topic(project: Project) -> str:
    topic = getattr(project, "topic", None)

    if topic:
        return str(topic)

    description = getattr(project, "description", None)

    if description:
        return str(description)

    name = getattr(project, "name", None)

    if name:
        return str(name)

    return "Software Engineering project"


def _extract_criteria_breakdown(evaluation: Evaluation) -> dict[str, int]:
    """
    Supports several possible model field names, because your Evaluation model
    may use criteria, criteria_breakdown, or rubric_scores.
    """
    for field_name in ("criteria", "criteria_breakdown", "rubric_scores"):
        value = getattr(evaluation, field_name, None)
        if isinstance(value, dict):
            return value

    return {}


def _set_evaluation_criteria(evaluation: Evaluation, criteria: dict[str, int]) -> None:
    """
    Writes criteria to whichever JSON field exists in your Evaluation model.
    """
    for field_name in ("criteria", "criteria_breakdown", "rubric_scores"):
        if hasattr(evaluation, field_name):
            setattr(evaluation, field_name, criteria)
            return

    raise AttributeError(
        "Evaluation model needs one JSON field named criteria, criteria_breakdown, or rubric_scores."
    )


def _get_score(evaluation: Evaluation) -> int:
    score = getattr(evaluation, "score", None)

    if score is None:
        score = getattr(evaluation, "ai_score", None)

    if score is None:
        return 0

    return int(score)


def _get_feedback(evaluation: Evaluation) -> str:
    feedback = getattr(evaluation, "feedback", None)

    if feedback is None:
        feedback = getattr(evaluation, "ai_feedback", None)

    if feedback is None:
        return ""

    return str(feedback)


def _set_optional_field(instance: Any, field_name: str, value: Any) -> None:
    if hasattr(instance, field_name):
        setattr(instance, field_name, value)


def _build_previous_submissions_context(
    previous_submissions: list[Submission],
) -> list[dict[str, Any]]:
    context: list[dict[str, Any]] = []

    for previous in previous_submissions:
        previous_evaluation = getattr(previous, "evaluation", None)

        item: dict[str, Any] = {
            "deliverable_number": previous.deliverable_number,
            "content": previous.content,
        }

        if previous_evaluation is not None:
            item["score"] = _get_score(previous_evaluation)
            item["feedback"] = _get_feedback(previous_evaluation)

        context.append(item)

    return context


async def _fetch_submission_graph(
    submission_id: int,
    db: AsyncSession,
) -> tuple[Submission, Enrollment, User, Project]:
    """
    Fetches submission, enrollment, student and project.

    This uses explicit queries to avoid relying too much on relationship names.
    """
    submission = await db.get(Submission, submission_id)

    if submission is None:
        raise ValueError(f"Submission {submission_id} not found.")

    enrollment = await db.get(Enrollment, submission.enrollment_id)

    if enrollment is None:
        raise ValueError(f"Enrollment {submission.enrollment_id} not found.")

    student = await db.get(User, enrollment.student_id)

    if student is None:
        raise ValueError(f"Student {enrollment.student_id} not found.")

    project = await db.get(Project, enrollment.project_id)

    if project is None:
        raise ValueError(f"Project {enrollment.project_id} not found.")

    return submission, enrollment, student, project


async def _fetch_previous_submissions(
    enrollment_id: int,
    deliverable_number: int,
    db: AsyncSession,
) -> list[Submission]:
    """
    Returns previous submissions for the same enrollment.
    Attempts to load their evaluation relationship if it exists.
    """
    stmt = (
        select(Submission)
        .where(
            Submission.enrollment_id == enrollment_id,
            Submission.deliverable_number < deliverable_number,
        )
        .order_by(Submission.deliverable_number.asc())
    )

    try:
        stmt = stmt.options(selectinload(Submission.evaluation))
    except Exception:
        # If the relationship is not named "evaluation", the evaluator still works
        # without previous scores/feedback.
        pass

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _save_success_evaluation(
    submission: Submission,
    result: dict[str, Any],
    db: AsyncSession,
) -> Evaluation:
    evaluation = Evaluation(
        submission_id=submission.id,
        score=int(result["score"]),
        feedback=str(result["feedback"]),
    )

    _set_evaluation_criteria(evaluation, dict(result["criteria"]))

    _set_optional_field(evaluation, "evaluated_at", _utcnow())
    _set_optional_field(evaluation, "created_at", _utcnow())
    _set_optional_field(evaluation, "is_fallback", False)
    _set_optional_field(evaluation, "error_message", None)

    db.add(evaluation)
    await db.commit()
    await db.refresh(evaluation)

    return evaluation


async def _save_fallback_evaluation(
    submission: Submission,
    error: Exception,
    db: AsyncSession,
) -> Evaluation:
    expected_criteria = CRITERIA_BY_DELIVERABLE.get(
        submission.deliverable_number,
        {},
    )

    fallback_criteria = {
        criterion_name: 0
        for criterion_name in expected_criteria.keys()
    }

    fallback_feedback = (
        "Evaluation failed — your professor will review this submission manually. "
        "Your work has been received correctly, but the AI evaluation service could not complete the grading process. "
        "This may be caused by temporary model capacity, quota limits, connectivity issues, or malformed AI output. "
        "No action is required from you right now. Your professor has access to your submission and can review it manually."
    )

    evaluation = Evaluation(
        submission_id=submission.id,
        score=0,
        feedback=fallback_feedback,
    )

    _set_evaluation_criteria(evaluation, fallback_criteria)

    _set_optional_field(evaluation, "evaluated_at", _utcnow())
    _set_optional_field(evaluation, "created_at", _utcnow())
    _set_optional_field(evaluation, "is_fallback", True)
    _set_optional_field(evaluation, "error_message", str(error)[:1000])

    db.add(evaluation)
    await db.commit()
    await db.refresh(evaluation)

    return evaluation


async def send_feedback_email(
    student: User,
    submission: Submission,
    evaluation: Evaluation,
    project: Project,
    db: AsyncSession,
    *,
    is_override: bool = False,
    professor_comment: str | None = None,
    ai_score: int | None = None,
) -> None:
    """
    Sends the feedback email using the Gmail account resolved for the project.
    """
    sender_account = await resolve_sender_account(project.id, db)

    student_name = _student_display_name(student)
    project_name = getattr(project, "name", "Project")

    score = _get_score(evaluation)
    criteria_breakdown = _extract_criteria_breakdown(evaluation)
    feedback_text = _get_feedback(evaluation)

    criteria_max_points = CRITERIA_BY_DELIVERABLE.get(
        submission.deliverable_number,
        {},
    )

    html_body = feedback_email(
        student_name=student_name,
        deliverable_num=submission.deliverable_number,
        project_name=str(project_name),
        score=score,
        criteria_breakdown=criteria_breakdown,
        feedback_text=feedback_text,
        platform_url=_get_platform_url(),
        criteria_max_points=criteria_max_points,
        is_override=is_override,
        professor_comment=professor_comment,
        ai_score=ai_score,
    )

    subject = (
        f"Feedback ready: Deliverable {submission.deliverable_number} "
        f"for {project_name}"
    )

    await send_email(
        to=student.email,
        subject=subject,
        body_html=html_body,
        gmail_account_email=sender_account.account_email,
        db=db,
    )


async def run_evaluation(
    submission_id: int,
    db: AsyncSession,
) -> Evaluation:
    """
    Main dispatcher:
    1. Fetch submission + student + project.
    2. Fetch previous submissions as context.
    3. Call Gemini evaluator.
    4. Save Evaluation row.
    5. Send feedback email to the student.

    On Gemini failure:
    - Save fallback Evaluation.
    - Send fallback feedback email.
    - Do not crash the request/background task.
    """
    submission, enrollment, student, project = await _fetch_submission_graph(
        submission_id=submission_id,
        db=db,
    )

    try:
        previous_submissions = await _fetch_previous_submissions(
            enrollment_id=enrollment.id,
            deliverable_number=submission.deliverable_number,
            db=db,
        )

        previous_context = _build_previous_submissions_context(previous_submissions)

        result = evaluate_by_deliverable_number(
            deliverable_number=submission.deliverable_number,
            project_topic=_get_project_topic(project),
            deliverable_content=submission.content,
            previous_submissions=previous_context,
        )

        evaluation = await _save_success_evaluation(
            submission=submission,
            result=result,
            db=db,
        )

    except Exception as exc:
        print("[AI DISPATCHER] Gemini evaluation failed.")
        print(traceback.format_exc())

        evaluation = await _save_fallback_evaluation(
            submission=submission,
            error=exc,
            db=db,
        )

    try:
        await send_feedback_email(
            student=student,
            submission=submission,
            evaluation=evaluation,
            project=project,
            db=db,
        )
    except Exception as exc:
        print("[AI DISPATCHER] Feedback email failed.")
        print(traceback.format_exc())

        _set_optional_field(submission, "email_sent", False)
        _set_optional_field(submission, "email_error", f"Feedback email failed: {exc}")

        await db.commit()

    return evaluation