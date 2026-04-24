from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker, get_db
from app.deps import get_current_user
from app.models import Enrollment, Evaluation, Project, Subject, Submission, User
from app.schemas.core import EvaluationOverrideRequest, EvaluationRead
from app.services.email_dispatch import send_override_feedback_email

router = APIRouter(tags=["Evaluations"])


async def verify_professor_owns_evaluation(
    evaluation: Evaluation,
    professor: User,
    db: AsyncSession,
) -> tuple[Submission, Enrollment, Project, Subject]:
    submission = await db.get(Submission, evaluation.submission_id)

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    enrollment = await db.get(Enrollment, submission.enrollment_id)

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found.")

    project = await db.get(Project, enrollment.project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    subject = await db.get(Subject, project.subject_id)

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    if subject.professor_id != professor.id:
        raise HTTPException(status_code=403, detail="Not your evaluation.")

    return submission, enrollment, project, subject


async def send_override_feedback_background(evaluation_id: int) -> None:
    async with async_session_maker() as db:
        await send_override_feedback_email(
            evaluation_id=evaluation_id,
            db=db,
        )


@router.get("/submissions/{submission_id}/evaluation")
async def get_submission_evaluation(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = await db.get(Submission, submission_id)

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    enrollment = await db.get(Enrollment, submission.enrollment_id)

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found.")

    if current_user.role == "student":
        if enrollment.student_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your submission.")

    elif current_user.role == "professor":
        project = await db.get(Project, enrollment.project_id)

        if not project:
            raise HTTPException(status_code=404, detail="Project not found.")

        subject = await db.get(Subject, project.subject_id)

        if not subject or subject.professor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your project.")

    else:
        raise HTTPException(status_code=403, detail="Invalid user role.")

    evaluation_result = await db.execute(
        select(Evaluation).where(Evaluation.submission_id == submission.id)
    )
    evaluation = evaluation_result.scalar_one_or_none()

    if not evaluation:
        return {"status": "pending"}

    return EvaluationRead.model_validate(evaluation)


@router.post(
    "/evaluations/{evaluation_id}/override",
    response_model=EvaluationRead,
)
async def override_evaluation(
    evaluation_id: int,
    payload: EvaluationOverrideRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    if current_user.role != "professor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Professor role required.",
        )

    evaluation = await db.get(Evaluation, evaluation_id)

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found.")

    await verify_professor_owns_evaluation(
        evaluation=evaluation,
        professor=current_user,
        db=db,
    )

    evaluation.is_overridden = True
    evaluation.override_score = payload.override_score
    evaluation.override_comment = payload.override_comment
    evaluation.override_by_professor_id = current_user.id
    evaluation.override_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(evaluation)

    background_tasks.add_task(
        send_override_feedback_background,
        evaluation.id,
    )

    return evaluation