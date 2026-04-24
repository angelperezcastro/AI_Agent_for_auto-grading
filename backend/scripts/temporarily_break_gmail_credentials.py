import argparse
import asyncio
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.append(str(BACKEND_ROOT))

from app.database import async_session_maker
from app.models import GmailAccount


async def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--gmail-account-id", type=int, required=True)
    args = parser.parse_args()

    async with async_session_maker() as db:
        account = await db.get(GmailAccount, args.gmail_account_id)

        if account is None:
            print(f"GmailAccount {args.gmail_account_id} not found.")
            return

        original_credentials_json = account.credentials_json
        original_is_active = account.is_active

        print("\nGmail account selected:")
        print("=" * 100)
        print(f"id: {account.id}")
        print(f"account_email: {account.account_email}")
        print("\nThe script will now temporarily corrupt credentials_json.")
        print("Do NOT close this terminal until the script restores the credentials.")

        try:
            account.credentials_json = "BROKEN_CREDENTIALS_FOR_WEEK3_FAILURE_TEST"
            account.is_active = True

            await db.commit()

            print("\nCredentials are now temporarily broken.")
            print("Now perform a submission from Swagger to test Gmail failure handling.")
            print("Expected result:")
            print("- POST /submissions returns 201 Created.")
            print("- Backend does not crash.")
            print("- EmailLog records failed email attempts.")
            print("- submission.email_error contains the failure reason.")
            print("\nAfter you finish the Swagger test, return here and press ENTER.")
            input("\nPress ENTER to restore Gmail credentials...")

        finally:
            account.credentials_json = original_credentials_json
            account.is_active = original_is_active

            await db.commit()

            print("\nGmail credentials restored.")
            print("You can now send emails normally again.")


if __name__ == "__main__":
    asyncio.run(main())