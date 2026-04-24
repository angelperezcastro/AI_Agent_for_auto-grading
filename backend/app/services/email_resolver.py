from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GmailAccount, Project, Subject


class GmailAccountNotConfiguredError(Exception):
    pass


async def resolve_sender_account(
    project_id: int,
    db: AsyncSession,
) -> GmailAccount:
    project = await db.get(Project, project_id)

    if not project:
        raise GmailAccountNotConfiguredError("Project not found.")

    if project.gmail_account_id is not None:
        project_account = await db.get(GmailAccount, project.gmail_account_id)

        if project_account and project_account.is_active:
            return project_account

    subject = await db.get(Subject, project.subject_id)

    if not subject:
        raise GmailAccountNotConfiguredError("Subject not found.")

    subject_account_result = await db.execute(
        select(GmailAccount)
        .where(
            GmailAccount.subject_id == subject.id,
            GmailAccount.professor_id == subject.professor_id,
            GmailAccount.is_active.is_(True),
        )
        .order_by(GmailAccount.created_at.asc())
    )
    subject_account = subject_account_result.scalars().first()

    if subject_account:
        return subject_account

    professor_account_result = await db.execute(
        select(GmailAccount)
        .where(
            GmailAccount.professor_id == subject.professor_id,
            GmailAccount.is_active.is_(True),
        )
        .order_by(GmailAccount.created_at.asc())
    )
    professor_account = professor_account_result.scalars().first()

    if professor_account:
        return professor_account

    raise GmailAccountNotConfiguredError(
        "No Gmail account configured for this project — please configure one in Settings."
    )