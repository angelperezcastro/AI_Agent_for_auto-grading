import asyncio
import sys
from pathlib import Path

from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database import AsyncSessionLocal
from app.models import Project, Subject, User


async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Subject, User)
            .join(User, Subject.professor_id == User.id)
            .order_by(Subject.id.asc())
        )

        rows = result.all()

        print("\nSUBJECTS AND PROJECTS")
        print("=" * 100)

        for subject, professor in rows:
            print(f"\nSubject ID:   {subject.id}")
            print(f"Subject name: {subject.name}")
            print(f"Professor:    {professor.email}")
            print(f"Professor ID: {professor.id}")

            project_result = await db.execute(
                select(Project)
                .where(Project.subject_id == subject.id)
                .order_by(Project.id.asc())
            )

            projects = project_result.scalars().all()

            if not projects:
                print("Projects:      none")
            else:
                print("Projects:")

                for project in projects:
                    gmail_account_id = getattr(project, "gmail_account_id", None)

                    print(
                        f"  - Project ID: {project.id} | "
                        f"name: {project.name} | "
                        f"gmail_account_id: {gmail_account_id}"
                    )

        print("\n")


if __name__ == "__main__":
    asyncio.run(main())