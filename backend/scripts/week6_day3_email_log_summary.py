import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

try:
    from app.database import AsyncSessionLocal
except ImportError:
    from app.database import async_session_maker as AsyncSessionLocal

from app.models import EmailLog, Enrollment, Project, Subject, Submission, User


def enum_value(value):
    if hasattr(value, "value"):
        return value.value
    return str(value)


async def main():
    parser = argparse.ArgumentParser(
        description="Week 6 Day 3 EmailLog summary."
    )

    parser.add_argument("--student-email", required=False)
    parser.add_argument("--project-name-contains", default="Week 6 Day 3 Regression")

    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        stmt = (
            select(EmailLog, Submission, Enrollment, Project, Subject, User)
            .join(Submission, EmailLog.submission_id == Submission.id)
            .join(Enrollment, Submission.enrollment_id == Enrollment.id)
            .join(Project, Enrollment.project_id == Project.id)
            .join(Subject, Project.subject_id == Subject.id)
            .join(User, Enrollment.student_id == User.id)
            .where(Project.name.ilike(f"%{args.project_name_contains}%"))
            .order_by(EmailLog.id.asc())
        )

        if args.student_email:
            stmt = stmt.where(User.email == args.student_email)

        result = await db.execute(stmt)
        rows = result.all()

        print("\nWEEK 6 DAY 3 — EMAIL LOG SUMMARY")
        print("=" * 120)

        if not rows:
            print("No EmailLog rows found with the selected filters.")
            raise SystemExit(1)

        failures = []

        for log, submission, enrollment, project, subject, student in rows:
            email_type = enum_value(log.email_type)
            sender = (
                getattr(log, "gmail_account_used", None)
                or getattr(log, "gmail_account_email", None)
                or getattr(log, "sender_email", None)
            )
            error_message = getattr(log, "error_message", None)

            status = "OK" if not error_message else "FAIL"

            print(
                f"[{status}] log_id={log.id} | "
                f"type={email_type} | "
                f"student={student.email} | "
                f"subject={subject.name} | "
                f"project={project.name} | "
                f"submission={submission.id} | "
                f"D{submission.deliverable_number} | "
                f"sender={sender} | "
                f"error={error_message}"
            )

            if error_message:
                failures.append(log.id)

        print("=" * 120)

        if failures:
            print(f"EMAIL LOG SUMMARY FAILED. Failed log IDs: {failures}")
            raise SystemExit(1)

        print("EMAIL LOG SUMMARY PASSED")
        print("No EmailLog errors found for Week 6 Day 3 regression data.\n")


if __name__ == "__main__":
    asyncio.run(main())