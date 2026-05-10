import asyncio
import sys
from pathlib import Path

from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

try:
    from app.database import AsyncSessionLocal
except ImportError:
    from app.database import async_session_maker as AsyncSessionLocal

from app.core.security import hash_password
from app.models import Enrollment, Project, Subject, User


PASSWORD = "Password123!"

AUDIT_STUDENTS = [
    {
        "email": "week6.audit.student1@se-autograder.local",
        "project_id": 2,
    },
    {
        "email": "week6.audit.student2@se-autograder.local",
        "project_id": 3,
    },
]


def set_if_exists(obj, field_name, value):
    if hasattr(obj, field_name):
        setattr(obj, field_name, value)


async def get_or_create_student(db, email: str) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if user:
        return user

    user = User()
    user.email = email
    user.role = "student"

    if hasattr(user, "hashed_password"):
        user.hashed_password = hash_password(PASSWORD)
    elif hasattr(user, "password_hash"):
        user.password_hash = hash_password(PASSWORD)
    else:
        raise RuntimeError("User model has no hashed_password/password_hash field.")

    set_if_exists(user, "full_name", email.split("@")[0])
    set_if_exists(user, "name", email.split("@")[0])
    set_if_exists(user, "is_active", True)

    db.add(user)
    await db.flush()

    return user


async def get_sample_enrollment_status(db):
    result = await db.execute(select(Enrollment).limit(1))
    sample = result.scalars().first()

    if sample and hasattr(sample, "status"):
        return sample.status

    return "active"


async def get_or_create_enrollment(db, student_id: int, project_id: int):
    result = await db.execute(
        select(Enrollment)
        .where(Enrollment.student_id == student_id)
        .where(Enrollment.project_id == project_id)
    )
    enrollment = result.scalars().first()

    if enrollment:
        return enrollment

    enrollment = Enrollment()
    enrollment.student_id = student_id
    enrollment.project_id = project_id

    if hasattr(enrollment, "status"):
        enrollment.status = await get_sample_enrollment_status(db)

    if hasattr(enrollment, "current_deliverable"):
        enrollment.current_deliverable = 1

    db.add(enrollment)
    await db.flush()

    return enrollment


async def main():
    async with AsyncSessionLocal() as db:
        print("\nWEEK 6 DAY 2 — PREPARE SECURITY AUDIT DATA")
        print("=" * 100)

        for item in AUDIT_STUDENTS:
            project = await db.get(Project, item["project_id"])

            if not project:
                raise RuntimeError(f"Project {item['project_id']} not found.")

            subject = await db.get(Subject, project.subject_id)

            if not subject:
                raise RuntimeError(f"Subject {project.subject_id} not found.")

            student = await get_or_create_student(db, item["email"])
            enrollment = await get_or_create_enrollment(
                db=db,
                student_id=student.id,
                project_id=project.id,
            )

            print(
                f"[OK] Student {student.id}: {student.email} | "
                f"Enrollment {enrollment.id} | "
                f"Project {project.id}: {project.name} | "
                f"Subject {subject.id}: {subject.name} | "
                f"Professor ID: {subject.professor_id}"
            )

        await db.commit()

        print("=" * 100)
        print("Security audit data ready.")
        print(f"Password for created students: {PASSWORD}\n")


if __name__ == "__main__":
    asyncio.run(main())