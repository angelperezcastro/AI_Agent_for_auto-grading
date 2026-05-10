from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import GmailAccount, Project, Subject


class GmailAccountResolutionError(RuntimeError):
    pass


async def resolve_sender_account(
    project_id: int,
    db: AsyncSession,
) -> GmailAccount:
    """
    Resolves which Gmail account must send emails for a project.

    Priority:
    1. Project-level Gmail account.
    2. Subject-level Gmail account.
    3. Professor personal active account, preferably unassigned to any subject.
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

    professor_id = subject.professor_id

    # 1. Project-level account.
    if getattr(project, "gmail_account_id", None):
        project_account = await db.get(GmailAccount, project.gmail_account_id)

        if (
            project_account
            and project_account.is_active
            and project_account.professor_id == professor_id
        ):
            return project_account

        raise GmailAccountResolutionError(
            f"Project {project.id} has gmail_account_id={project.gmail_account_id}, "
            "but that account does not exist, is inactive, or does not belong to "
            "the professor who owns the subject."
        )

    # 2. Subject-level account.
    subject_account_result = await db.execute(
        select(GmailAccount)
        .where(GmailAccount.professor_id == professor_id)
        .where(GmailAccount.subject_id == subject.id)
        .where(GmailAccount.is_active.is_(True))
        .order_by(GmailAccount.id.asc())
    )
    subject_account = subject_account_result.scalars().first()

    if subject_account:
        return subject_account

    # 3A. Professor personal account, preferably not assigned to any subject.
    personal_account_result = await db.execute(
        select(GmailAccount)
        .where(GmailAccount.professor_id == professor_id)
        .where(GmailAccount.subject_id.is_(None))
        .where(GmailAccount.is_active.is_(True))
        .order_by(GmailAccount.id.asc())
    )
    personal_account = personal_account_result.scalars().first()

    if personal_account:
        return personal_account

    # 3B. Last-resort professor account.
    # This keeps the app usable even if the professor has accounts connected
    # but none marked as personal.
    fallback_account_result = await db.execute(
        select(GmailAccount)
        .where(GmailAccount.professor_id == professor_id)
        .where(GmailAccount.is_active.is_(True))
        .order_by(GmailAccount.id.asc())
    )
    fallback_account = fallback_account_result.scalars().first()

    if fallback_account:
        return fallback_account

    # 4. No account configured.
    raise GmailAccountResolutionError(
        "No Gmail account configured for this project. "
        "Please configure one in Settings before sending emails."
    )