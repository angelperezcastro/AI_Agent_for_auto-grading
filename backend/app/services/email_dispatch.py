import logging

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Enrollment, Project, Subject, Submission, User
from app.services.email_resolver import (
    GmailAccountNotConfiguredError,
    resolve_sender_account,
)
from app.services.email_service import send_email
from app.services.email_templates import (
    confirmation_email,
    professor_notification_email,
)

logger = logging.getLogger(__name__)


def _preview(text: str, limit: int = 600) -> str:
    clean = text.strip()

    if len(clean) <= limit:
        return clean

    return clean[:limit] + "..."


async def _load_submission_context(
    submission_id: int,
    db: AsyncSession,
) -> tuple[Submission, Enrollment, User, Project, Subject, User]:
    submission = await db.get(Submission, submission_id)

    if not submission:
        raise ValueError("Submission not found.")

    enrollment = await db.get(Enrollment, submission.enrollment_id)

    if not enrollment:
        raise ValueError("Enrollment not found.")

    student = await db.get(User, enrollment.student_id)

    if not student:
        raise ValueError("Student not found.")

    project = await db.get(Project, enrollment.project_id)

    if not project:
        raise ValueError("Project not found.")

    subject = await db.get(Subject, project.subject_id)

    if not subject:
        raise ValueError("Subject not found.")

    professor = await db.get(User, subject.professor_id)

    if not professor:
        raise ValueError("Professor not found.")

    return submission, enrollment, student, project, subject, professor


async def send_submission_confirmation(
    submission_id: int,
    db: AsyncSession,
) -> None:
    submission, _, student, project, _, _ = await _load_submission_context(
        submission_id=submission_id,
        db=db,
    )

    try:
        sender_account = await resolve_sender_account(project.id, db)

        html = confirmation_email(
            student_name=student.name,
            deliverable_num=submission.deliverable_number,
            project_name=project.name,
            deadline_next=submission.deadline_at,
        )

        await send_email(
            to=student.email,
            subject=f"Deliverable {submission.deliverable_number} received",
            body_html=html,
            gmail_account_email=sender_account.account_email,
            db=db,
        )

        submission.email_sent = True
        submission.email_error = None

        await db.commit()

    except GmailAccountNotConfiguredError as exc:
        logger.warning("Confirmation email not sent: %s", exc)

        submission.email_sent = False
        submission.email_error = str(exc)

        await db.commit()

    except Exception as exc:
        logger.exception("Confirmation email failed.")

        submission.email_sent = False
        submission.email_error = f"Confirmation email failed: {exc}"

        await db.commit()


async def send_professor_notification(
    submission_id: int,
    db: AsyncSession,
) -> None:
    submission, _, student, project, _, professor = await _load_submission_context(
        submission_id=submission_id,
        db=db,
    )

    try:
        sender_account = await resolve_sender_account(project.id, db)

        html = professor_notification_email(
            student_name=student.name,
            deliverable_num=submission.deliverable_number,
            project_name=project.name,
            submission_preview=_preview(submission.content),
        )

        await send_email(
            to=professor.email,
            subject=f"{student.name} submitted Deliverable {submission.deliverable_number}",
            body_html=html,
            gmail_account_email=sender_account.account_email,
            db=db,
        )

        await db.commit()

    except GmailAccountNotConfiguredError as exc:
        logger.warning("Professor notification email not sent: %s", exc)

        submission.email_sent = False
        submission.email_error = str(exc)

        await db.commit()

    except Exception as exc:
        logger.exception("Professor notification email failed.")

        submission.email_sent = False
        submission.email_error = f"Professor notification email failed: {exc}"

        await db.commit()