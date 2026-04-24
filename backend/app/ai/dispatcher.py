from __future__ import annotations

import inspect
import os
import traceback
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.ai.evaluator import evaluate_by_deliverable_number
from app.ai.prompts import CRITERIA_BY_DELIVERABLE
from app.models import (
    EmailType,
    Enrollment,
    EnrollmentStatus,
    Evaluation,
    Project,
    Submission,
    SubmissionStatus,
    User,
)
from app.services.email_log_service import log_email_attempt
from app.services.email_resolver import resolve_sender_account
from app.services.email_service import send_email
from app.services.email_templates import feedback_email


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def _maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


def _get_platform_url() -> str:
    return os.getenv("FRONTEND_URL", "http://localhost:5173")


def _student_display_name(student: User) -> str:
    if getattr(student, "name", None):
        return student.name

    if getattr(student, "email", None):
        return student.email.split("@")[0]

    return "student"


def _get_project_topic(project: Project) -> str:
    if getattr(project, "topic", None):
        return project.topic

    if getattr(project, "description", None):
        return project.description

    if getattr(project, "name", None):
        return project.name

    return "Software Engineering project"


def _build_previous_submissions_context(
    previous_submissions: list[Submission],
) -> list[dict[str, Any]]:
    context: list[dict[str, Any]] = []

    for previous_submission in previous_submissions:
        previous_evaluation = previous_submission.evaluation

        item: dict[str, Any] = {
            "deliverable_number": previous_submission.deliverable_number,
            "content": previous_submission.content,
        }

        if previous_evaluation is not None:
            item["score"] = previous_evaluation.ai_score
            item["feedback"] = previous_evaluation.feedback

        context.append(item)

    return context


async def _fetch_submission_graph(
    submission_id: int,
    db: AsyncSession,
) -> tuple[Submission, Enrollment, User, Project]:
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
    stmt = (
        select(Submission)
        .options(selectinload(Submission.evaluation))
        .where(
            Submission.enrollment_id == enrollment_id,
            Submission.deliverable_number < deliverable_number,
        )
        .order_by(Submission.deliverable_number.asc())
    )

    result = await db.execute(stmt)
    return list(result.scalars().all())


async def _get_existing_evaluation(
    submission_id: int,
    db: AsyncSession,
) -> Evaluation | None:
    stmt = select(Evaluation).where(Evaluation.submission_id == submission_id)
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def _save_success_evaluation(
    submission: Submission,
    enrollment: Enrollment,
    result: dict[str, Any],
    db: AsyncSession,
) -> Evaluation:
    evaluation = Evaluation(
        submission_id=submission.id,
        ai_score=int(result["score"]),
        criteria_breakdown=dict(result["criteria"]),
        feedback=str(result["feedback"]),
    )

    submission.status = SubmissionStatus.EVALUATED

    if submission.deliverable_number < 4:
        enrollment.current_deliverable = max(
            enrollment.current_deliverable,
            submission.deliverable_number + 1,
        )
    else:
        enrollment.status = EnrollmentStatus.COMPLETED

    db.add(evaluation)
    await db.commit()
    await db.refresh(evaluation)

    return evaluation


async def _save_fallback_evaluation(
    submission: Submission,
    enrollment: Enrollment,
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
        ai_score=0,
        criteria_breakdown=fallback_criteria,
        feedback=fallback_feedback,
    )

    submission.status = SubmissionStatus.EVALUATED
    submission.email_error = f"AI evaluation fallback used: {str(error)[:500]}"

    if submission.deliverable_number < 4:
        enrollment.current_deliverable = max(
            enrollment.current_deliverable,
            submission.deliverable_number + 1,
        )
    else:
        enrollment.status = EnrollmentStatus.COMPLETED

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
    sender_account = await _maybe_await(
        resolve_sender_account(project.id, db)
    )

    sender_email = sender_account.account_email

    criteria_max_points = CRITERIA_BY_DELIVERABLE.get(
        submission.deliverable_number,
        {},
    )

    score = (
        evaluation.override_score
        if is_override and evaluation.override_score is not None
        else evaluation.ai_score
    )

    html_body = feedback_email(
        student_name=_student_display_name(student),
        deliverable_num=submission.deliverable_number,
        score=score,
        criteria_breakdown=evaluation.criteria_breakdown,
        feedback_text=evaluation.feedback,
        project_name=project.name,
        platform_url=_get_platform_url(),
        criteria_max_points=criteria_max_points,
        is_override=is_override,
        professor_comment=professor_comment,
        ai_score=ai_score,
    )

    subject = (
        f"Feedback ready: Deliverable {submission.deliverable_number} "
        f"for {project.name}"
    )

    email_type = (
        EmailType.OVERRIDE_FEEDBACK
        if is_override
        else EmailType.FEEDBACK
    )

    try:
        await _maybe_await(
            send_email(
                to=student.email,
                subject=subject,
                body_html=html_body,
                gmail_account_email=sender_email,
                db=db,
            )
        )

        await log_email_attempt(
            db=db,
            submission_id=submission.id,
            email_type=email_type,
            recipient_email=student.email,
            gmail_account_used=sender_email,
            error_message=None,
        )

    except Exception as exc:
        await log_email_attempt(
            db=db,
            submission_id=submission.id,
            email_type=email_type,
            recipient_email=student.email,
            gmail_account_used=sender_email,
            error_message=str(exc)[:1000],
        )

        raise


async def run_evaluation(
    submission_id: int,
    db: AsyncSession,
) -> Evaluation:
    submission, enrollment, student, project = await _fetch_submission_graph(
        submission_id=submission_id,
        db=db,
    )

    existing_evaluation = await _get_existing_evaluation(
        submission_id=submission.id,
        db=db,
    )

    if existing_evaluation is not None:
        try:
            await send_feedback_email(
                student=student,
                submission=submission,
                evaluation=existing_evaluation,
                project=project,
                db=db,
            )
        except Exception:
            print("[AI DISPATCHER] Existing evaluation email resend failed.")
            print(traceback.format_exc())

        return existing_evaluation

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
            enrollment=enrollment,
            result=result,
            db=db,
        )

    except Exception as exc:
        print("[AI DISPATCHER] Gemini evaluation failed. Creating fallback evaluation.")
        print(traceback.format_exc())

        evaluation = await _save_fallback_evaluation(
            submission=submission,
            enrollment=enrollment,
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

        submission.email_sent = True
        submission.email_error = None
        await db.commit()

    except Exception as exc:
        print("[AI DISPATCHER] Feedback email failed.")
        print(traceback.format_exc())

        submission.email_sent = False
        submission.email_error = f"Feedback email failed: {str(exc)[:1000]}"
        await db.commit()

    return evaluation


async def run_evaluation_in_new_session(submission_id: int) -> None:
    from app.database import async_session_maker

    async with async_session_maker() as db:
        await run_evaluation(
            submission_id=submission_id,
            db=db,
        )