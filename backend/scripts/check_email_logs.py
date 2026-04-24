import asyncio
import sys
from pathlib import Path

from sqlalchemy import text

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_ROOT))

from app.database import async_session_maker


async def main() -> None:
    async with async_session_maker() as db:
        result = await db.execute(
            text(
                """
                SELECT
                    id,
                    submission_id,
                    email_type,
                    recipient_email,
                    gmail_account_used,
                    sent_at,
                    LEFT(COALESCE(error_message, ''), 160) AS error_preview
                FROM email_logs
                ORDER BY id DESC
                LIMIT 20;
                """
            )
        )

        rows = result.mappings().all()

        if not rows:
            print("No email logs found.")
            return

        for row in rows:
            print(dict(row))


if __name__ == "__main__":
    asyncio.run(main())