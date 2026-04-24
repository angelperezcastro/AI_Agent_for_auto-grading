import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_ROOT))

from app.database import async_session_maker


async def main() -> None:
    async with async_session_maker() as db:
        print("\nLatest evaluations:")
        print("=" * 100)

        evaluations_result = await db.execute(
            text(
                """
                SELECT 
                    id,
                    submission_id,
                    ai_score,
                    criteria_breakdown,
                    LEFT(feedback, 120) AS feedback_preview,
                    evaluated_at
                FROM evaluations
                ORDER BY id DESC
                LIMIT 5;
                """
            )
        )

        evaluations = evaluations_result.mappings().all()

        if not evaluations:
            print("No evaluations found.")
        else:
            for row in evaluations:
                print(dict(row))

        print("\nLatest submissions:")
        print("=" * 100)

        submissions_result = await db.execute(
            text(
                """
                SELECT 
                    id,
                    enrollment_id,
                    deliverable_number,
                    status,
                    email_sent,
                    email_error
                FROM submissions
                ORDER BY id DESC
                LIMIT 5;
                """
            )
        )

        submissions = submissions_result.mappings().all()

        if not submissions:
            print("No submissions found.")
        else:
            for row in submissions:
                print(dict(row))


if __name__ == "__main__":
    asyncio.run(main())