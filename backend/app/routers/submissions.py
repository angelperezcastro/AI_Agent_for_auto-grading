import logging
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.dispatcher import trigger_ai_evaluation
from app.database import async_session_maker, get_db
from app.deps import get_current_user
from app.models import Enrollment, Project, Subject, Submission, User
from app.schemas.core import SubmissionCreate, SubmissionRead
from app.services.email_dispatch import send_submission_emails
from app.services.submission_rules import check_submission_allowed

router = APIRouter(prefix="/submissions", tags=["Submissions"])

logger = logging.getLogger(__name__)


async def send_submission_emails_background(submission_id: int) -> None:
    async with async_session_maker() as db:
        await send_submission_emails(
            submission_id=submission_id,
            db=db,
        )


async def trigger_ai_evaluation_background(submission_id: int) -> None:
    await trigger_ai_evaluation(submission_id=submission_id)


@router.post("", response_model=SubmissionRead, status_code=status.HTTP_201_CREATED)
async def create_submission(
    payload: SubmissionCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "student":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Student role required.",
        )

    enrollment = await db.get(Enrollment, payload.enrollment_id)

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found.",
        )

    if enrollment.student_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not your enrollment.",
        )

    allowed, reason = await check_submission_allowed(
        enrollment_id=payload.enrollment_id,
        deliverable_number=payload.deliverable_number,
        db=db,
    )

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=reason,
        )

    now = datetime.now(timezone.utc)

    submission = Submission(
        enrollment_id=payload.enrollment_id,
        deliverable_number=payload.deliverable_number,
        content=payload.content,
        submitted_at=now,
        deadline_at=now + timedelta(days=7),
        email_sent=False,
        email_error=None,
    )

    db.add(submission)
    enrollment.current_deliverable = payload.deliverable_number

    await db.commit()
    await db.refresh(submission)

    background_tasks.add_task(send_submission_emails_background, submission.id)
    background_tasks.add_task(trigger_ai_evaluation_background, submission.id)

    return submission


@router.get("/{submission_id}", response_model=SubmissionRead)
async def get_submission(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = await db.get(Submission, submission_id)

    if not submission:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Submission not found.",
        )

    enrollment = await db.get(Enrollment, submission.enrollment_id)

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found.",
        )

    if current_user.role == "student":
        if enrollment.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not your submission.",
            )

    elif current_user.role == "professor":
        project = await db.get(Project, enrollment.project_id)
        subject = await db.get(Subject, project.subject_id)

        if not subject or subject.professor_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not your project.",
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user role.",
        )

    return submission


@router.get("/enrollment/{enrollment_id}", response_model=list[SubmissionRead])
async def list_submissions_for_enrollment(
    enrollment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enrollment = await db.get(Enrollment, enrollment_id)

    if not enrollment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Enrollment not found.",
        )

    if current_user.role == "student":
        if enrollment.student_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not your enrollment.",
            )

    elif current_user.role == "professor":
        project = await db.get(Project, enrollment.project_id)
        subject = await db.get(Subject, project.subject_id)

        if not subject or subject.professor_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not your project.",
            )

    else:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Invalid user role.",
        )

    result = await db.execute(
        select(Submission)
        .where(Submission.enrollment_id == enrollment_id)
        .order_by(Submission.deliverable_number.asc())
    )

    return result.scalars().all()