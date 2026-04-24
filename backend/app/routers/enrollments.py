from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Enrollment, Project, Subject, User
from app.schemas.core import EnrollmentCreate, EnrollmentRead

router = APIRouter(prefix="/enrollments", tags=["Enrollments"])


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


@router.get("", response_model=list[EnrollmentRead])
async def list_my_enrollments(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role == "student":
        result = await db.execute(
            select(Enrollment).where(Enrollment.student_id == current_user.id)
        )
        return result.scalars().all()

    result = await db.execute(
        select(Enrollment)
        .join(Project, Enrollment.project_id == Project.id)
        .join(Subject, Project.subject_id == Subject.id)
        .where(Subject.professor_id == current_user.id)
    )

    return result.scalars().all()