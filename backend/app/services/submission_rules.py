from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Enrollment, Submission, Evaluation


async def check_submission_allowed(
    enrollment_id: int,
    deliverable_number: int,
    db: AsyncSession,
) -> tuple[bool, str]:
    if deliverable_number < 1 or deliverable_number > 4:
        return False, "Deliverable number must be between 1 and 4."

    enrollment = await db.get(Enrollment, enrollment_id)
    if not enrollment:
        return False, "Enrollment not found."

    existing_submission_result = await db.execute(
        select(Submission).where(
            Submission.enrollment_id == enrollment_id,
            Submission.deliverable_number == deliverable_number,
        )
    )
    existing_submission = existing_submission_result.scalar_one_or_none()

    if existing_submission:
        return False, f"Deliverable {deliverable_number} has already been submitted."

    if deliverable_number == 1:
        return True, "Submission allowed."

    previous_submission_result = await db.execute(
        select(Submission).where(
            Submission.enrollment_id == enrollment_id,
            Submission.deliverable_number == deliverable_number - 1,
        )
    )
    previous_submission = previous_submission_result.scalar_one_or_none()

    if not previous_submission:
        return False, f"Deliverable {deliverable_number - 1} must be submitted first."

    previous_evaluation_result = await db.execute(
        select(Evaluation).where(Evaluation.submission_id == previous_submission.id)
    )
    previous_evaluation = previous_evaluation_result.scalar_one_or_none()

    if not previous_evaluation:
        return False, f"Deliverable {deliverable_number - 1} must be evaluated before submitting deliverable {deliverable_number}."

    return True, "Submission allowed."