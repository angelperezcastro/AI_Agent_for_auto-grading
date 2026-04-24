from __future__ import annotations

import inspect
import traceback
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import (
    EmailType,
    Enrollment,
    Evaluation,
    Project,
    Subject,
    Submission,
    User,
)
from app.services.email_log_service import log_email_attempt
from app.services.email_resolver import resolve_sender_account
from app.services.email_service import send_email
from app.services.email_templates import confirmation_email, professor_notification_email


async def _maybe_await(value: Any) -> Any:
    if inspect.isawaitable(value):
        return await value
    return value


def _student_display_name(student: User) -> str:
    if student.name:
        return student.name

    if student.email:
        return student.email.split("@")[0]

    return "student"


def _submission_preview(content: str, max_length: int = 700) -> str:
    clean = content.strip()

    if len(clean) <= max_length:
        return clean

    return clean[:max_length].rstrip() + "..."


async def _fetch_submission_graph(
    submission_id: int,
    db: AsyncSession,
) -> tuple[Submission, Enrollment, User, Project, Subject, User]:
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

    subject = await db.get(Subject, project.subject_id)

    if subject is None:
        raise ValueError(f"Subject {project.subject_id} not found.")

    professor = await db.get(User, subject.professor_id)

    if professor is None:
        raise ValueError(f"Professor {subject.professor_id} not found.")

    return submission, enrollment, student, project, subject, professor


async def send_submission_emails(
    submission_id: int,
    db: AsyncSession,
) -> None:
    """
    Sends and logs the first two email triggers:
    1. Confirmation email to student.
    2. Professor notification email.

    The AI feedback email is sent from app.ai.dispatcher.
    """
    submission, enrollment, student, project, subject, professor = await _fetch_submission_graph(
        submission_id=submission_id,
        db=db,
    )

    sender_account = await _maybe_await(resolve_sender_account(project.id, db))
    sender_email = sender_account.account_email

    confirmation_error: str | None = None
    professor_notification_error: str | None = None

    try:
        html_body = confirmation_email(
            student_name=_student_display_name(student),
            deliverable_num=submission.deliverable_number,
            project_name=project.name,
            deadline_next=submission.deadline_at,
        )

        await _maybe_await(
            send_email(
                to=student.email,
                subject=f"Deliverable {submission.deliverable_number} received",
                body_html=html_body,
                gmail_account_email=sender_email,
                db=db,
            )
        )

        await log_email_attempt(
            db=db,
            submission_id=submission.id,
            email_type=EmailType.CONFIRMATION,
            recipient_email=student.email,
            gmail_account_used=sender_email,
            error_message=None,
        )

    except Exception as exc:
        confirmation_error = str(exc)

        await log_email_attempt(
            db=db,
            submission_id=submission.id,
            email_type=EmailType.CONFIRMATION,
            recipient_email=student.email,
            gmail_account_used=sender_email,
            error_message=confirmation_error[:1000],
        )

        print("[EMAIL DISPATCH] Confirmation email failed.")
        print(traceback.format_exc())

    try:
        html_body = professor_notification_email(
            student_name=_student_display_name(student),
            deliverable_num=submission.deliverable_number,
            project_name=project.name,
            submission_preview=_submission_preview(submission.content),
        )

        await _maybe_await(
            send_email(
                to=professor.email,
                subject=f"New submission: Deliverable {submission.deliverable_number}",
                body_html=html_body,
                gmail_account_email=sender_email,
                db=db,
            )
        )

        await log_email_attempt(
            db=db,
            submission_id=submission.id,
            email_type=EmailType.PROFESSOR_NOTIFICATION,
            recipient_email=professor.email,
            gmail_account_used=sender_email,
            error_message=None,
        )

    except Exception as exc:
        professor_notification_error = str(exc)

        await log_email_attempt(
            db=db,
            submission_id=submission.id,
            email_type=EmailType.PROFESSOR_NOTIFICATION,
            recipient_email=professor.email,
            gmail_account_used=sender_email,
            error_message=professor_notification_error[:1000],
        )

        print("[EMAIL DISPATCH] Professor notification email failed.")
        print(traceback.format_exc())

    if confirmation_error or professor_notification_error:
        errors = []

        if confirmation_error:
            errors.append(f"confirmation: {confirmation_error[:500]}")

        if professor_notification_error:
            errors.append(f"professor_notification: {professor_notification_error[:500]}")

        submission.email_sent = False
        submission.email_error = " | ".join(errors)
    else:
        submission.email_sent = True
        submission.email_error = None

    await db.commit()


async def send_override_feedback_email(
    *args: Any,
    **kwargs: Any,
) -> None:
    """
    Compatibility function used by app.routers.evaluations.

    Supports common call styles:
    - await send_override_feedback_email(evaluation_id, db)
    - await send_override_feedback_email(evaluation_id=evaluation_id, db=db)
    - await send_override_feedback_email(evaluation, db)
    - await send_override_feedback_email(evaluation=evaluation, db=db)

    The actual HTML email + EmailLog writing is delegated to
    app.ai.dispatcher.send_feedback_email.
    """
    db: AsyncSession | None = kwargs.get("db")
    evaluation: Evaluation | None = kwargs.get("evaluation")
    evaluation_id: int | None = kwargs.get("evaluation_id")

    if args:
        first_arg = args[0]

        if isinstance(first_arg, Evaluation):
            evaluation = first_arg
        elif isinstance(first_arg, int):
            evaluation_id = first_arg

    if len(args) >= 2 and db is None:
        db = args[1]

    if db is None:
        raise ValueError("send_override_feedback_email requires a database session.")

    if evaluation is None:
        if evaluation_id is None:
            raise ValueError(
                "send_override_feedback_email requires evaluation or evaluation_id."
            )

        evaluation = await db.get(Evaluation, evaluation_id)

    if evaluation is None:
        raise ValueError(f"Evaluation {evaluation_id} not found.")

    submission = await db.get(Submission, evaluation.submission_id)

    if submission is None:
        raise ValueError(f"Submission {evaluation.submission_id} not found.")

    enrollment = await db.get(Enrollment, submission.enrollment_id)

    if enrollment is None:
        raise ValueError(f"Enrollment {submission.enrollment_id} not found.")

    student = await db.get(User, enrollment.student_id)

    if student is None:
        raise ValueError(f"Student {enrollment.student_id} not found.")

    project = await db.get(Project, enrollment.project_id)

    if project is None:
        raise ValueError(f"Project {enrollment.project_id} not found.")

    from app.ai.dispatcher import send_feedback_email

    await send_feedback_email(
        student=student,
        submission=submission,
        evaluation=evaluation,
        project=project,
        db=db,
        is_override=True,
        professor_comment=evaluation.override_comment,
        ai_score=evaluation.ai_score,
    )