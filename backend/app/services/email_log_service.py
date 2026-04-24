from __future__ import annotations

from sqlalchemy.ext.asyncio import AsyncSession

from app.models import EmailLog, EmailType


async def log_email_attempt(
    db: AsyncSession,
    *,
    submission_id: int,
    email_type: EmailType,
    recipient_email: str,
    gmail_account_used: str | None,
    error_message: str | None = None,
) -> EmailLog:
    """
    Records every email attempt, successful or failed.

    A row with error_message=None means the email was sent successfully.
    A row with error_message!=None means the attempt failed.
    """
    log = EmailLog(
        submission_id=submission_id,
        email_type=email_type,
        recipient_email=recipient_email,
        gmail_account_used=gmail_account_used,
        error_message=error_message,
    )

    db.add(log)
    await db.commit()
    await db.refresh(log)

    return log