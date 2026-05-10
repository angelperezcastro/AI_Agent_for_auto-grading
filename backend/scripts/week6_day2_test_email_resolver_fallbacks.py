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

from app.models import GmailAccount, Project, Subject
from app.services.email_resolver import (
    GmailAccountResolutionError,
    resolve_sender_account,
)


def print_result(name: str, passed: bool, details: str = ""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}")

    if details:
        print(f"       {details}")


async def get_professor_accounts(db, professor_id: int):
    result = await db.execute(
        select(GmailAccount)
        .where(GmailAccount.professor_id == professor_id)
        .order_by(GmailAccount.id.asc())
    )
    return result.scalars().all()


async def restore_state(db, project, account_snapshots):
    project.gmail_account_id = account_snapshots["project_gmail_account_id"]

    for account_id, snapshot in account_snapshots["accounts"].items():
        account = await db.get(GmailAccount, account_id)

        if account:
            account.subject_id = snapshot["subject_id"]
            account.is_active = snapshot["is_active"]

    await db.commit()


async def main():
    parser = argparse.ArgumentParser(
        description="Week 6 Day 2 automated fallback-chain test for email_resolver."
    )

    parser.add_argument("--project-id", type=int, default=2)
    parser.add_argument("--subject-id", type=int, default=2)
    parser.add_argument("--project-account-id", type=int, default=2)
    parser.add_argument("--subject-account-id", type=int, default=1)
    parser.add_argument("--personal-account-id", type=int, default=1)

    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        project = await db.get(Project, args.project_id)
        subject = await db.get(Subject, args.subject_id)

        if not project:
            raise RuntimeError(f"Project {args.project_id} not found.")

        if not subject:
            raise RuntimeError(f"Subject {args.subject_id} not found.")

        if project.subject_id != subject.id:
            raise RuntimeError(
                f"Project {project.id} does not belong to Subject {subject.id}."
            )

        professor_id = subject.professor_id

        professor_accounts = await get_professor_accounts(db, professor_id)

        if not professor_accounts:
            raise RuntimeError(
                f"No Gmail accounts found for professor_id={professor_id}."
            )

        project_account = await db.get(GmailAccount, args.project_account_id)
        subject_account = await db.get(GmailAccount, args.subject_account_id)
        personal_account = await db.get(GmailAccount, args.personal_account_id)

        if not project_account:
            raise RuntimeError(f"Project account {args.project_account_id} not found.")

        if not subject_account:
            raise RuntimeError(f"Subject account {args.subject_account_id} not found.")

        if not personal_account:
            raise RuntimeError(f"Personal account {args.personal_account_id} not found.")

        if project_account.professor_id != professor_id:
            raise RuntimeError("Project account does not belong to the subject professor.")

        if subject_account.professor_id != professor_id:
            raise RuntimeError("Subject account does not belong to the subject professor.")

        if personal_account.professor_id != professor_id:
            raise RuntimeError("Personal account does not belong to the subject professor.")

        snapshots = {
            "project_gmail_account_id": project.gmail_account_id,
            "accounts": {
                account.id: {
                    "subject_id": account.subject_id,
                    "is_active": account.is_active,
                }
                for account in professor_accounts
            },
        }

        print("\nWEEK 6 DAY 2 — EMAIL RESOLVER FALLBACK TEST")
        print("=" * 100)
        print(f"Project:   {project.id} | {project.name}")
        print(f"Subject:   {subject.id} | {subject.name}")
        print(f"Professor: {professor_id}")
        print("=" * 100)

        failures = []

        try:
            # Reset all professor accounts to a neutral active state.
            for account in professor_accounts:
                account.subject_id = None
                account.is_active = True

            await db.commit()

            # Scenario 1:
            # project.gmail_account_id set -> project account must be used.
            project.gmail_account_id = project_account.id
            subject_account.subject_id = subject.id
            project_account.is_active = True
            subject_account.is_active = True
            await db.commit()

            resolved = await resolve_sender_account(project.id, db)
            expected = project_account.account_email
            passed = resolved.id == project_account.id

            print_result(
                "Scenario 1: project.gmail_account_id set -> project account used",
                passed,
                f"expected={expected}, resolved={resolved.account_email}",
            )

            if not passed:
                failures.append("Scenario 1 failed.")

            # Scenario 2:
            # project account cleared, subject default exists -> subject account used.
            project.gmail_account_id = None

            for account in professor_accounts:
                account.subject_id = None
                account.is_active = True

            subject_account.subject_id = subject.id
            await db.commit()

            resolved = await resolve_sender_account(project.id, db)
            expected = subject_account.account_email
            passed = resolved.id == subject_account.id

            print_result(
                "Scenario 2: no project account, subject default exists -> subject account used",
                passed,
                f"expected={expected}, resolved={resolved.account_email}",
            )

            if not passed:
                failures.append("Scenario 2 failed.")

            # Scenario 3:
            # no project account, no subject account, professor personal account exists -> personal account used.
            project.gmail_account_id = None

            for account in professor_accounts:
                account.subject_id = None
                account.is_active = True

            personal_account.subject_id = None
            personal_account.is_active = True
            await db.commit()

            resolved = await resolve_sender_account(project.id, db)
            expected = personal_account.account_email
            passed = resolved.id == personal_account.id

            print_result(
                "Scenario 3: no project/subject account, professor personal account exists -> personal account used",
                passed,
                f"expected={expected}, resolved={resolved.account_email}",
            )

            if not passed:
                failures.append("Scenario 3 failed.")

            # Scenario 4:
            # no account anywhere -> clear error.
            project.gmail_account_id = None

            for account in professor_accounts:
                account.subject_id = None
                account.is_active = False

            await db.commit()

            try:
                await resolve_sender_account(project.id, db)

                print_result(
                    "Scenario 4: no account anywhere -> clear error",
                    False,
                    "resolver returned an account instead of raising an error",
                )
                failures.append("Scenario 4 failed.")

            except GmailAccountResolutionError as exc:
                message = str(exc)
                passed = "No Gmail account configured" in message

                print_result(
                    "Scenario 4: no account anywhere -> clear error",
                    passed,
                    message,
                )

                if not passed:
                    failures.append("Scenario 4 failed with wrong error message.")

        finally:
            await restore_state(db, project, snapshots)

        print("=" * 100)

        if failures:
            print("\nFALLBACK CHAIN TEST FAILED")
            for failure in failures:
                print(f"- {failure}")

            raise SystemExit(1)

        print("\nFALLBACK CHAIN TEST PASSED")
        print("All 4 resolver scenarios behave correctly.")
        print("Original database state restored.\n")


if __name__ == "__main__":
    asyncio.run(main())