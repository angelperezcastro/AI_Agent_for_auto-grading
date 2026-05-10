import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database import AsyncSessionLocal
from app.models import EmailLog, Enrollment, Project, Subject, Submission


def enum_value(value):
    if hasattr(value, "value"):
        return value.value
    return str(value)


def get_log_sender(log: EmailLog) -> str | None:
    return (
        getattr(log, "gmail_account_used", None)
        or getattr(log, "gmail_account_email", None)
        or getattr(log, "sender_email", None)
    )


def parse_email_types(raw_types: list[str] | None) -> set[str] | None:
    if not raw_types:
        return None

    parsed = set()

    for item in raw_types:
        for part in item.split(","):
            clean = part.strip()

            if clean:
                parsed.add(clean)

    return parsed or None


async def main():
    parser = argparse.ArgumentParser(
        description="Verify multi-account Gmail routing from EmailLog."
    )

    parser.add_argument("--subject-a-id", type=int, required=True)
    parser.add_argument("--expected-a", required=True)

    parser.add_argument("--subject-b-id", type=int, required=True)
    parser.add_argument("--expected-b", required=True)

    parser.add_argument(
        "--min-log-id",
        type=int,
        default=None,
        help="Only check EmailLog rows with id >= this value. Useful to ignore old failing logs.",
    )

    parser.add_argument(
        "--email-types",
        nargs="*",
        default=None,
        help=(
            "Optional list of email types to check. "
            "Example: --email-types confirmation professor_notification feedback override_feedback"
        ),
    )

    parser.add_argument("--limit", type=int, default=200)

    args = parser.parse_args()

    allowed_email_types = parse_email_types(args.email_types)

    expected_by_subject = {
        args.subject_a_id: args.expected_a.lower(),
        args.subject_b_id: args.expected_b.lower(),
    }

    async with AsyncSessionLocal() as db:
        stmt = (
            select(EmailLog, Submission, Enrollment, Project, Subject)
            .join(Submission, EmailLog.submission_id == Submission.id)
            .join(Enrollment, Submission.enrollment_id == Enrollment.id)
            .join(Project, Enrollment.project_id == Project.id)
            .join(Subject, Project.subject_id == Subject.id)
            .where(Subject.id.in_([args.subject_a_id, args.subject_b_id]))
            .order_by(EmailLog.id.desc())
            .limit(args.limit)
        )

        if args.min_log_id is not None:
            stmt = stmt.where(EmailLog.id >= args.min_log_id)

        result = await db.execute(stmt)
        rows = result.all()

        print("\nMULTI-ACCOUNT GMAIL ROUTING CHECK")
        print("=" * 120)

        if args.min_log_id is not None:
            print(f"Checking only logs with id >= {args.min_log_id}")

        if allowed_email_types:
            print(f"Checking only email types: {', '.join(sorted(allowed_email_types))}")

        print("=" * 120)

        if not rows:
            print("No EmailLog rows found for those subjects with the selected filters.")
            print("Generate new emails first, then run this script again.")
            raise SystemExit(1)

        failures = []
        checked_rows = 0

        counts_by_subject = {
            args.subject_a_id: 0,
            args.subject_b_id: 0,
        }

        for log, submission, enrollment, project, subject in rows:
            email_type = enum_value(getattr(log, "email_type", "unknown"))

            if allowed_email_types and email_type not in allowed_email_types:
                continue

            sender = get_log_sender(log)
            sender_normalized = sender.lower() if sender else None
            expected = expected_by_subject[subject.id]
            error_message = getattr(log, "error_message", None)

            checked_rows += 1
            counts_by_subject[subject.id] += 1

            ok_sender = sender_normalized == expected
            ok_error = not error_message
            ok = ok_sender and ok_error

            print(
                f"[{'OK' if ok else 'FAIL'}] "
                f"log_id={log.id} | "
                f"subject={subject.id}:{subject.name} | "
                f"project={project.id}:{project.name} | "
                f"submission={submission.id} | "
                f"type={email_type} | "
                f"sender={sender} | "
                f"expected={expected} | "
                f"error={error_message}"
            )

            if not ok:
                failures.append(
                    {
                        "log_id": log.id,
                        "subject_id": subject.id,
                        "sender": sender,
                        "expected": expected,
                        "error": error_message,
                    }
                )

        print("=" * 120)
        print(f"Checked logs:   {checked_rows}")
        print(f"Subject A logs: {counts_by_subject[args.subject_a_id]}")
        print(f"Subject B logs: {counts_by_subject[args.subject_b_id]}")

        if checked_rows == 0:
            print("\nNo logs matched the selected email type filters.")
            raise SystemExit(1)

        if counts_by_subject[args.subject_a_id] == 0:
            print("\nWARNING: No checked logs found for Subject A.")

        if counts_by_subject[args.subject_b_id] == 0:
            print("\nWARNING: No checked logs found for Subject B.")

        if failures:
            print("\nROUTING CHECK FAILED")
            for failure in failures:
                print(failure)
            raise SystemExit(1)

        print("\nROUTING CHECK PASSED")
        print("All checked emails were sent by the expected Gmail account.\n")


if __name__ == "__main__":
    asyncio.run(main())