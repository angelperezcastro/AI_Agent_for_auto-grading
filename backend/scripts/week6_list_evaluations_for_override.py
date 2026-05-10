import asyncio
import sys
from pathlib import Path

from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database import AsyncSessionLocal
from app.models import Enrollment, Evaluation, Project, Subject, Submission, User


async def main():
    async with AsyncSessionLocal() as db:
        stmt = (
            select(Evaluation, Submission, Enrollment, Project, Subject, User)
            .join(Submission, Evaluation.submission_id == Submission.id)
            .join(Enrollment, Submission.enrollment_id == Enrollment.id)
            .join(Project, Enrollment.project_id == Project.id)
            .join(Subject, Project.subject_id == Subject.id)
            .join(User, Enrollment.student_id == User.id)
            .where(Subject.id.in_([2, 3]))
            .order_by(Evaluation.id.desc())
        )

        result = await db.execute(stmt)
        rows = result.all()

        print("\nEVALUATIONS AVAILABLE FOR WEEK 6 OVERRIDE TEST")
        print("=" * 120)

        if not rows:
            print("No evaluations found for Subject 2 or Subject 3.")
            return

        for evaluation, submission, enrollment, project, subject, student in rows:
            print(
                f"Evaluation ID: {evaluation.id} | "
                f"Subject {subject.id}: {subject.name} | "
                f"Project {project.id}: {project.name} | "
                f"Submission ID: {submission.id} | "
                f"Deliverable: {submission.deliverable_number} | "
                f"Student: {student.email} | "
                f"AI score: {evaluation.ai_score} | "
                f"Override score: {evaluation.override_score}"
            )

        print("=" * 120)
        print("\nUse one Evaluation ID from Subject 2 and one from Subject 3.\n")


if __name__ == "__main__":
    asyncio.run(main())