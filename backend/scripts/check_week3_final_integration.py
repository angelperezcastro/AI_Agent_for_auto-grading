import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_ROOT))

from app.database import async_session_maker


async def get_latest_submission_id() -> int | None:
    async with async_session_maker() as db:
        result = await db.execute(
            text("SELECT id FROM submissions ORDER BY id DESC LIMIT 1;")
        )
        row = result.mappings().first()
        return int(row["id"]) if row else None


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--submission-id", type=int, default=None)
    args = parser.parse_args()

    submission_id = args.submission_id

    if submission_id is None:
        submission_id = await get_latest_submission_id()

    if submission_id is None:
        print("No submissions found.")
        return

    async with async_session_maker() as db:
        print("\nWEEK 3 FINAL INTEGRATION CHECK")
        print("=" * 100)
        print(f"submission_id = {submission_id}")

        print("\nSubmission:")
        print("-" * 100)
        submission_result = await db.execute(
            text(
                """
                SELECT
                    id,
                    enrollment_id,
                    deliverable_number,
                    status,
                    email_sent,
                    email_error,
                    submitted_at,
                    deadline_at
                FROM submissions
                WHERE id = :submission_id;
                """
            ),
            {"submission_id": submission_id},
        )
        submission = submission_result.mappings().first()

        if not submission:
            print("Submission not found.")
            return

        print(dict(submission))

        print("\nEvaluation:")
        print("-" * 100)
        evaluation_result = await db.execute(
            text(
                """
                SELECT
                    id,
                    submission_id,
                    ai_score,
                    criteria_breakdown,
                    LEFT(feedback, 250) AS feedback_preview,
                    evaluated_at,
                    is_overridden,
                    override_score,
                    override_comment
                FROM evaluations
                WHERE submission_id = :submission_id
                ORDER BY id DESC;
                """
            ),
            {"submission_id": submission_id},
        )
        evaluations = evaluation_result.mappings().all()

        if not evaluations:
            print("No evaluation found yet.")
        else:
            for row in evaluations:
                print(dict(row))

        print("\nEmail logs:")
        print("-" * 100)
        logs_result = await db.execute(
            text(
                """
                SELECT
                    id,
                    submission_id,
                    email_type,
                    recipient_email,
                    gmail_account_used,
                    sent_at,
                    LEFT(COALESCE(error_message, ''), 250) AS error_preview
                FROM email_logs
                WHERE submission_id = :submission_id
                ORDER BY id ASC;
                """
            ),
            {"submission_id": submission_id},
        )
        logs = logs_result.mappings().all()

        if not logs:
            print("No email logs found.")
        else:
            for row in logs:
                print(dict(row))

        print("\nExpected success criteria:")
        print("-" * 100)
        print("1. Submission exists.")
        print("2. Evaluation exists.")
        print("3. Email logs include confirmation, professor_notification and feedback.")
        print("4. Successful emails have empty error_preview.")
        print("5. If Gemini failed due quota, ai_score=0 fallback is acceptable for failure path.")


if __name__ == "__main__":
    asyncio.run(main())