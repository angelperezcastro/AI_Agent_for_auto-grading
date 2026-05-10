from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GmailAccount, Project, Subject


class GmailAccountResolutionError(RuntimeError):
    pass


async def resolve_sender_account(project_id: int, db: AsyncSession) -> GmailAccount:
    """
    Resolves which Gmail account must send emails for a project.

    Priority:
    1. Project-level Gmail account.
    2. Subject-level Gmail account.
    3. Professor active fallback account.
    4. Clear failure.
    """

    project = await db.get(Project, project_id)

    if not project:
        raise GmailAccountResolutionError(
            f"Project {project_id} not found while resolving Gmail sender."
        )

    subject = await db.get(Subject, project.subject_id)

    if not subject:
        raise GmailAccountResolutionError(
            f"Subject {project.subject_id} not found while resolving Gmail sender."
        )

    # 1. Project-level account.
    if getattr(project, "gmail_account_id", None):
        project_account = await db.get(GmailAccount, project.gmail_account_id)

        if project_account and project_account.is_active:
            return project_account

        raise GmailAccountResolutionError(
            f"Project {project.id} has gmail_account_id={project.gmail_account_id}, "
            "but that account does not exist or is inactive."
        )

    # 2. Subject-level account.
    subject_account_result = await db.execute(
        select(GmailAccount)
        .where(GmailAccount.subject_id == subject.id)
        .where(GmailAccount.professor_id == subject.professor_id)
        .where(GmailAccount.is_active.is_(True))
        .order_by(GmailAccount.id.asc())
    )
    subject_account = subject_account_result.scalars().first()

    if subject_account:
        return subject_account

    # 3. Professor fallback account.
    professor_account_result = await db.execute(
        select(GmailAccount)
        .where(GmailAccount.professor_id == subject.professor_id)
        .where(GmailAccount.is_active.is_(True))
        .order_by(GmailAccount.id.asc())
    )
    professor_account = professor_account_result.scalars().first()

    if professor_account:
        return professor_account

    # 4. No account configured.
    raise GmailAccountResolutionError(
        "No Gmail account configured for this project. "
        "Please configure one in Settings before sending emails."
    )