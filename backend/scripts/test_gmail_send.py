import argparse
import asyncio

from app.db.session import AsyncSessionLocal
from app.services.email_service import send_email


async def main():
    parser = argparse.ArgumentParser(description="Send a Gmail API test email")
    parser.add_argument("--gmail-account-email", required=True, help="Connected Gmail account email stored in gmail_accounts")
    parser.add_argument("--to", required=True, help="Recipient email")
    parser.add_argument("--subject", default="SE Autograder Gmail API test")
    parser.add_argument(
        "--body-html",
        default="<p>This is a test email sent by SE Autograder via Gmail API.</p>",
    )
    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        result = await send_email(
            to=args.to,
            subject=args.subject,
            body_html=args.body_html,
            gmail_account_email=args.gmail_account_email,
            db=db,
        )
        print("Email sent successfully.")
        print(result)


if __name__ == "__main__":
    asyncio.run(main())