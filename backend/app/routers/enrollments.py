from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Enrollment, Evaluation, Project, Subject, Submission, User
from app.schemas.core import (
    EnrollmentCreate,
    EnrollmentProgressRead,
    EnrollmentRead,
    SubmissionWithEvaluationRead,
)

router = APIRouter(prefix="/enrollments", tags=["Enrollments"])


async def build_enrollment_progress(
    enrollment: Enrollment,
    db: AsyncSession,
) -> EnrollmentProgressRead:
    project = await db.get(Project, enrollment.project_id)
    subject = await db.get(Subject, project.subject_id)

    submissions_result = await db.execute(
        select(Submission)
        .where(Submission.enrollment_id == enrollment.id)
        .order_by(Submission.deliverable_number.asc())
    )
    submissions = submissions_result.scalars().all()

    submitted_count = len(submissions)
    evaluated_count = 0
    latest_score = None
    latest_submission_at = None

    for submission in submissions:
        if latest_submission_at is None or submission.submitted_at > latest_submission_at:
            latest_submission_at = submission.submitted_at

        evaluation_result = await db.execute(
            select(Evaluation).where(Evaluation.submission_id == submission.id)
        )
        evaluation = evaluation_result.scalar_one_or_none()

        if evaluation:
            evaluated_count += 1
            latest_score = (
                evaluation.override_score
                if evaluation.is_overridden and evaluation.override_score is not None
                else evaluation.ai_score
            )

    next_deliverable = None

    if evaluated_count < 4:
        next_deliverable = evaluated_count + 1

    return EnrollmentProgressRead(
        id=enrollment.id,
        student_id=enrollment.student_id,
        project_id=enrollment.project_id,
        project_name=project.name,
        subject_id=subject.id,
        subject_name=subject.name,
        current_deliverable=enrollment.current_deliverable,
        status=enrollment.status.value if hasattr(enrollment.status, "value") else enrollment.status,
        submitted_count=submitted_count,
        evaluated_count=evaluated_count,
        latest_score=latest_score,
        latest_submission_at=latest_submission_at,
        next_deliverable=next_deliverable,
        enrolled_at=enrollment.enrolled_at,
    )


@router.post("", response_model=EnrollmentRead, status_code=status.HTTP_201_CREATED)
async def create_enrollment(
    payload: EnrollmentCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "student":
        raise HTTPException(status_code=403, detail="Student role required.")

    project = await db.get(Project, payload.project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    same_subject_enrollment_result = await db.execute(
        select(Enrollment)
        .join(Project, Enrollment.project_id == Project.id)
        .where(
            Enrollment.student_id == current_user.id,
            Project.subject_id == project.subject_id,
            Enrollment.status == "active",
        )
    )
    existing = same_subject_enrollment_result.scalar_one_or_none()

    if existing:
        raise HTTPException(
            status_code=400,
            detail="You already have an active project for this subject.",
        )

    enrollment = Enrollment(
        student_id=current_user.id,
        project_id=payload.project_id,
        current_deliverable=1,
        status="active",
    )

    db.add(enrollment)
    await db.commit()
    await db.refresh(enrollment)

    return enrollment


@router.get("", response_model=list[EnrollmentProgressRead])
async def list_enrollments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "student":
        result = await db.execute(
            select(Enrollment)
            .where(Enrollment.student_id == current_user.id)
            .order_by(Enrollment.enrolled_at.desc())
        )
        enrollments = result.scalars().all()

    elif current_user.role == "professor":
        result = await db.execute(
            select(Enrollment)
            .join(Project, Enrollment.project_id == Project.id)
            .join(Subject, Project.subject_id == Subject.id)
            .where(Subject.professor_id == current_user.id)
            .order_by(Enrollment.enrolled_at.desc())
        )
        enrollments = result.scalars().all()

    else:
        raise HTTPException(status_code=403, detail="Invalid user role.")

    return [
        await build_enrollment_progress(enrollment=enrollment, db=db)
        for enrollment in enrollments
    ]


@router.get("/{enrollment_id}/submissions", response_model=list[SubmissionWithEvaluationRead])
async def list_enrollment_submissions(
    enrollment_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    enrollment = await db.get(Enrollment, enrollment_id)

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found.")

    if current_user.role == "student":
        if enrollment.student_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your enrollment.")

    elif current_user.role == "professor":
        project = await db.get(Project, enrollment.project_id)
        subject = await db.get(Subject, project.subject_id)

        if not subject or subject.professor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your project.")

    else:
        raise HTTPException(status_code=403, detail="Invalid user role.")

    result = await db.execute(
        select(Submission)
        .where(Submission.enrollment_id == enrollment_id)
        .order_by(Submission.deliverable_number.asc())
    )
    submissions = result.scalars().all()

    return submissions