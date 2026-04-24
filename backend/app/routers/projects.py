from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.deps import get_current_user
from app.models import Enrollment, Evaluation, Project, Subject, Submission, User
from app.schemas.core import ProjectEnrollmentRead

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("/{project_id}/enrollments", response_model=list[ProjectEnrollmentRead])
async def list_project_enrollments(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "professor":
        raise HTTPException(status_code=403, detail="Professor role required.")

    project = await db.get(Project, project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    subject = await db.get(Subject, project.subject_id)

    if not subject or subject.professor_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your project.")

    enrollments_result = await db.execute(
        select(Enrollment)
        .where(Enrollment.project_id == project_id)
        .order_by(Enrollment.enrolled_at.desc())
    )
    enrollments = enrollments_result.scalars().all()

    response = []

    for enrollment in enrollments:
        student = await db.get(User, enrollment.student_id)

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

        response.append(
            ProjectEnrollmentRead(
                enrollment_id=enrollment.id,
                student_id=student.id,
                student_name=student.name,
                student_email=student.email,
                project_id=project.id,
                project_name=project.name,
                current_deliverable=enrollment.current_deliverable,
                status=enrollment.status.value if hasattr(enrollment.status, "value") else enrollment.status,
                submitted_count=submitted_count,
                evaluated_count=evaluated_count,
                latest_score=latest_score,
                latest_submission_at=latest_submission_at,
                enrolled_at=enrollment.enrolled_at,
            )
        )

    return response