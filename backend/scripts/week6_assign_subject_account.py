import argparse
import asyncio
import sys
from pathlib import Path

from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.database import AsyncSessionLocal
from app.models import GmailAccount, Project, Subject, User


async def get_account(db, account_id: int | None, account_email: str | None):
    if account_id:
        return await db.get(GmailAccount, account_id)

    if account_email:
        result = await db.execute(
            select(GmailAccount).where(GmailAccount.account_email == account_email)
        )
        return result.scalars().first()

    raise ValueError("Provide either --account-id or --account-email.")


async def main():
    parser = argparse.ArgumentParser(
        description="Assign a Gmail account as the default sender for a subject."
    )
    parser.add_argument("--subject-id", type=int, required=True)
    parser.add_argument("--account-id", type=int)
    parser.add_argument("--account-email")
    parser.add_argument(
        "--clear-project-accounts",
        action="store_true",
        help="Clear project.gmail_account_id for all projects under this subject so subject-level routing is tested.",
    )

    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        subject = await db.get(Subject, args.subject_id)

        if not subject:
            raise RuntimeError(f"Subject {args.subject_id} not found.")

        professor = await db.get(User, subject.professor_id)
        account = await get_account(db, args.account_id, args.account_email)

        if not account:
            raise RuntimeError("Gmail account not found.")

        if account.professor_id != subject.professor_id:
            raise RuntimeError(
                "This Gmail account does not belong to the professor who owns the subject."
            )

        # Remove previous subject-level account for this subject.
        previous_result = await db.execute(
            select(GmailAccount).where(GmailAccount.subject_id == subject.id)
        )
        previous_accounts = previous_result.scalars().all()

        for previous in previous_accounts:
            previous.subject_id = None

        account.subject_id = subject.id

        if args.clear_project_accounts:
            projects_result = await db.execute(
                select(Project).where(Project.subject_id == subject.id)
            )
            projects = projects_result.scalars().all()

            for project in projects:
                project.gmail_account_id = None

        await db.commit()

        print("\nSUBJECT GMAIL ASSIGNMENT UPDATED")
        print("=" * 80)
        print(f"Subject ID:       {subject.id}")
        print(f"Subject name:     {subject.name}")
        print(f"Professor:        {professor.email if professor else subject.professor_id}")
        print(f"Gmail account ID: {account.id}")
        print(f"Gmail email:      {account.account_email}")

        if args.clear_project_accounts:
            print("Project accounts: cleared for this subject")

        print("=" * 80)
        print("OK\n")


if __name__ == "__main__":
    asyncio.run(main())