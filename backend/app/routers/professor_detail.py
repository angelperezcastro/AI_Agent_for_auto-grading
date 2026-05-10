from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.deps import get_current_user
from app.models import EmailLog, Enrollment, Project, Subject, Submission, User
from app.schemas.core import EvaluationRead
from app.schemas.professor_detail import (
    ProfessorDeliverableDetailRead,
    ProfessorEmailLogRead,
    ProfessorEnrollmentDetailRead,
)

router = APIRouter(prefix="/professor", tags=["Professor Detail"])


def enum_value(value) -> str:
    if value is None:
        return ""
    return value.value if hasattr(value, "value") else str(value)


def require_professor(user: User) -> None:
    if enum_value(user.role) != "professor":
        raise HTTPException(status_code=403, detail="Professor role required.")


def user_display_name(user: User) -> str:
    return user.name or user.email.split("@")[0]


def email_log_type(log: EmailLog) -> str:
    return enum_value(log.email_type)


def has_successful_email(logs: list[EmailLog], email_type: str) -> bool:
    return any(
        email_log_type(log) == email_type and not log.error_message
        for log in logs
    )


def has_failed_email(logs: list[EmailLog]) -> bool:
    return any(bool(log.error_message) for log in logs)


def build_email_logs(logs: list[EmailLog]) -> list[ProfessorEmailLogRead]:
    return [
        ProfessorEmailLogRead(
            id=log.id,
            email_type=email_log_type(log),
            recipient_email=log.recipient_email,
            gmail_account_used=log.gmail_account_used,
            sent_at=log.sent_at,
            error_message=log.error_message,
        )
        for log in logs
    ]


@router.get(
    "/enrollments/{enrollment_id}/detail",
    response_model=ProfessorEnrollmentDetailRead,
)
async def get_professor_enrollment_detail(
    enrollment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_professor(current_user)

    enrollment = await db.get(Enrollment, enrollment_id)

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found.")

    student = await db.get(User, enrollment.student_id)

    if not student:
        raise HTTPException(status_code=404, detail="Student not found.")

    project = await db.get(Project, enrollment.project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    subject = await db.get(Subject, project.subject_id)

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    if subject.professor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your enrollment.")

    submissions_result = await db.execute(
        select(Submission)
        .options(
            selectinload(Submission.evaluation),
            selectinload(Submission.email_logs),
        )
        .where(Submission.enrollment_id == enrollment.id)
        .order_by(Submission.deliverable_number.asc())
    )

    submissions = submissions_result.scalars().all()
    submissions_by_number = {
        submission.deliverable_number: submission
        for submission in submissions
    }

    deliverables: list[ProfessorDeliverableDetailRead] = []

    for deliverable_number in range(1, 5):
        submission = submissions_by_number.get(deliverable_number)

        if not submission:
            deliverables.append(
                ProfessorDeliverableDetailRead(
                    deliverable_number=deliverable_number,
                    submitted=False,
                    status="not_submitted",
                )
            )
            continue

        logs = list(submission.email_logs or [])

        confirmation_sent = has_successful_email(logs, "confirmation")
        feedback_sent = has_successful_email(logs, "feedback")
        override_feedback_sent = has_successful_email(logs, "override_feedback")

        # Fallback for older submissions that only used Submission.email_sent.
        if not confirmation_sent and submission.email_sent and not submission.email_error:
            confirmation_sent = True

        evaluation = (
            EvaluationRead.model_validate(submission.evaluation)
            if submission.evaluation
            else None
        )

        deliverables.append(
            ProfessorDeliverableDetailRead(
                deliverable_number=deliverable_number,
                submitted=True,
                status=enum_value(submission.status),
                submission_id=submission.id,
                content=submission.content,
                submitted_at=submission.submitted_at,
                deadline_at=submission.deadline_at,
                evaluation=evaluation,
                confirmation_email_sent=confirmation_sent,
                feedback_email_sent=feedback_sent,
                override_feedback_email_sent=override_feedback_sent,
                email_failed=bool(submission.email_error) or has_failed_email(logs),
                email_error=submission.email_error,
                email_logs=build_email_logs(logs),
            )
        )

    return ProfessorEnrollmentDetailRead(
        enrollment_id=enrollment.id,
        enrollment_status=enum_value(enrollment.status),
        current_deliverable=enrollment.current_deliverable,
        enrolled_at=enrollment.enrolled_at,
        student_id=student.id,
        student_name=user_display_name(student),
        student_email=student.email,
        subject_id=subject.id,
        subject_name=subject.name,
        project_id=project.id,
        project_name=project.name,
        project_topic=project.topic,
        project_description=project.description,
        deliverables=deliverables,
    )