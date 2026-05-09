from collections import defaultdict
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import (
    EmailLog,
    Enrollment,
    Evaluation,
    Project,
    Subject,
    Submission,
    User,
)
from app.schemas.professor import ProfessorEnrollmentRow

router = APIRouter(prefix="/professor", tags=["professor"])


def enum_value(value: Any) -> str:
    if value is None:
        return ""
    return value.value if hasattr(value, "value") else str(value)


def ensure_professor(current_user: User) -> None:
    role = enum_value(current_user.role)
    if role != "professor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only professors can access this resource.",
        )


def get_user_display_name(user: User) -> str:
    possible_name = (
        getattr(user, "name", None)
        or getattr(user, "full_name", None)
        or getattr(user, "username", None)
    )

    if possible_name:
        return possible_name

    if user.email:
        return user.email.split("@")[0]

    return f"Student {user.id}"


def effective_score(evaluation: Evaluation | None) -> int | None:
    if not evaluation:
        return None

    override_score = getattr(evaluation, "override_score", None)
    ai_score = getattr(evaluation, "ai_score", None)

    return override_score if override_score is not None else ai_score


@router.get(
    "/dashboard/enrollments",
    response_model=list[ProfessorEnrollmentRow],
)
async def get_professor_dashboard_enrollments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Returns one normalized row per enrollment belonging to the logged professor.

    This endpoint is designed specifically for the professor dashboard table.
    It avoids forcing the frontend to call many project/enrollment/submission/email endpoints.
    """
    ensure_professor(current_user)

    enrollments_stmt = (
        select(Enrollment, User, Project, Subject)
        .join(User, Enrollment.student_id == User.id)
        .join(Project, Enrollment.project_id == Project.id)
        .join(Subject, Project.subject_id == Subject.id)
        .where(Subject.professor_id == current_user.id)
        .order_by(Subject.name.asc(), Project.name.asc(), User.email.asc())
    )

    enrollment_result = await db.execute(enrollments_stmt)
    enrollment_rows = enrollment_result.all()

    if not enrollment_rows:
        return []

    enrollment_ids = [row.Enrollment.id for row in enrollment_rows]

    submissions_stmt = (
        select(Submission)
        .where(Submission.enrollment_id.in_(enrollment_ids))
        .order_by(Submission.submitted_at.asc())
    )

    submissions_result = await db.execute(submissions_stmt)
    submissions = submissions_result.scalars().all()

    submission_ids = [submission.id for submission in submissions]

    evaluations_by_submission_id: dict[int, Evaluation] = {}
    logs_by_submission_id: dict[int, list[EmailLog]] = defaultdict(list)

    if submission_ids:
        evaluations_stmt = select(Evaluation).where(
            Evaluation.submission_id.in_(submission_ids)
        )
        evaluations_result = await db.execute(evaluations_stmt)
        evaluations = evaluations_result.scalars().all()

        evaluations_by_submission_id = {
            evaluation.submission_id: evaluation for evaluation in evaluations
        }

        email_logs_stmt = select(EmailLog).where(
            EmailLog.submission_id.in_(submission_ids)
        )
        email_logs_result = await db.execute(email_logs_stmt)
        email_logs = email_logs_result.scalars().all()

        for log in email_logs:
            logs_by_submission_id[log.submission_id].append(log)

    submissions_by_enrollment_id: dict[int, list[Submission]] = defaultdict(list)

    for submission in submissions:
        submissions_by_enrollment_id[submission.enrollment_id].append(submission)

    response: list[ProfessorEnrollmentRow] = []

    for enrollment, student, project, subject in enrollment_rows:
        enrollment_submissions = submissions_by_enrollment_id.get(enrollment.id, [])

        latest_submission = (
            max(
                enrollment_submissions,
                key=lambda item: item.submitted_at,
            )
            if enrollment_submissions
            else None
        )

        evaluated_count = 0
        for submission in enrollment_submissions:
            submission_status = enum_value(submission.status)
            has_evaluation = submission.id in evaluations_by_submission_id

            if submission_status == "evaluated" or has_evaluation:
                evaluated_count += 1

        latest_evaluation = (
            evaluations_by_submission_id.get(latest_submission.id)
            if latest_submission
            else None
        )

        latest_score = effective_score(latest_evaluation)

        email_failed = False

        for submission in enrollment_submissions:
            submission_email_sent = bool(getattr(submission, "email_sent", True))
            submission_email_error = getattr(submission, "email_error", None)

            if submission_email_sent is False or submission_email_error:
                email_failed = True

            for log in logs_by_submission_id.get(submission.id, []):
                if getattr(log, "error_message", None):
                    email_failed = True

        enrollment_status = enum_value(getattr(enrollment, "status", "active"))

        has_overdue_submission = any(
            enum_value(submission.status) == "overdue"
            for submission in enrollment_submissions
        )

        computed_status = (
            "overdue"
            if enrollment_status == "overdue" or has_overdue_submission
            else "active"
        )

        current_deliverable = getattr(enrollment, "current_deliverable", 1) or 1

        response.append(
            ProfessorEnrollmentRow(
                enrollment_id=enrollment.id,
                student_id=student.id,
                student_name=get_user_display_name(student),
                student_email=student.email,
                subject_id=subject.id,
                subject_name=subject.name,
                project_id=project.id,
                project_name=project.name,
                current_deliverable=current_deliverable,
                evaluated_count=evaluated_count,
                progress_label=f"{evaluated_count}/4",
                latest_submission_id=latest_submission.id if latest_submission else None,
                latest_score=latest_score,
                latest_submission_status=(
                    enum_value(latest_submission.status) if latest_submission else None
                ),
                last_activity=latest_submission.submitted_at if latest_submission else None,
                email_failed=email_failed,
                email_status_text=(
                    "Email issue detected" if email_failed else "Emails OK"
                ),
                status=computed_status,
            )
        )

    return response