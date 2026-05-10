from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps import get_current_professor
from app.models import GmailAccount, Subject, User
from app.schemas.settings import GmailAccountResponse, SetDefaultGmailAccountRequest
from app.services.email_service import send_email

router = APIRouter(prefix="/settings", tags=["settings"])


def test_email_html(professor_name: str, gmail_account_email: str) -> str:
    sent_at = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    return f"""
    <!doctype html>
    <html>
      <body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
        <div style="max-width:680px;margin:0 auto;padding:32px;">
          <div style="background:#ffffff;border:1px solid #e2e8f0;border-radius:20px;padding:28px;">
            <h1 style="margin:0 0 12px;font-size:24px;color:#0f172a;">
              Gmail test email successful
            </h1>

            <p style="margin:0 0 18px;font-size:15px;line-height:1.7;color:#475569;">
              Hello {professor_name}, this is a test email from your SE Autograder platform.
            </p>

            <div style="background:#ecfdf5;border:1px solid #bbf7d0;border-radius:14px;padding:16px;margin:22px 0;">
              <p style="margin:0;font-size:14px;color:#047857;">
                This Gmail account is correctly connected and can be used to send project emails.
              </p>
            </div>

            <table style="width:100%;border-collapse:collapse;margin-top:20px;">
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">
                  Gmail account
                </td>
                <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#0f172a;">
                  {gmail_account_email}
                </td>
              </tr>
              <tr>
                <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px;color:#64748b;">
                  Test recipient
                </td>
                <td style="padding:10px;border-bottom:1px solid #e2e8f0;font-size:13px;font-weight:700;color:#0f172a;">
                  {professor_name}
                </td>
              </tr>
              <tr>
                <td style="padding:10px;font-size:13px;color:#64748b;">
                  Sent at
                </td>
                <td style="padding:10px;font-size:13px;font-weight:700;color:#0f172a;">
                  {sent_at}
                </td>
              </tr>
            </table>

            <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
              SE Autograder · Gmail Integration Test
            </p>
          </div>
        </div>
      </body>
    </html>
    """


@router.get("/gmail-accounts", response_model=list[GmailAccountResponse])
async def list_gmail_accounts(
    current_professor: User = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
) -> list[GmailAccountResponse]:
    result = await db.execute(
        select(GmailAccount)
        .where(GmailAccount.professor_id == current_professor.id)
        .order_by(GmailAccount.created_at.desc())
    )
    accounts = result.scalars().all()
    return list(accounts)


@router.delete(
    "/gmail-accounts/{gmail_account_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_gmail_account(
    gmail_account_id: int,
    current_professor: User = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
) -> Response:
    result = await db.execute(
        select(GmailAccount).where(
            GmailAccount.id == gmail_account_id,
            GmailAccount.professor_id == current_professor.id,
        )
    )
    gmail_account = result.scalar_one_or_none()

    if gmail_account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gmail account not found",
        )

    await db.delete(gmail_account)
    await db.commit()

    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/gmail-accounts/{gmail_account_id}/set-default",
    response_model=GmailAccountResponse,
)
async def set_default_gmail_account_for_subject(
    gmail_account_id: int,
    payload: SetDefaultGmailAccountRequest,
    current_professor: User = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
) -> GmailAccountResponse:
    subject_result = await db.execute(
        select(Subject).where(
            Subject.id == payload.subject_id,
            Subject.professor_id == current_professor.id,
        )
    )
    subject = subject_result.scalar_one_or_none()

    if subject is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found",
        )

    account_result = await db.execute(
        select(GmailAccount).where(
            GmailAccount.id == gmail_account_id,
            GmailAccount.professor_id == current_professor.id,
        )
    )
    gmail_account = account_result.scalar_one_or_none()

    if gmail_account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gmail account not found",
        )

    existing_defaults_result = await db.execute(
        select(GmailAccount).where(
            GmailAccount.professor_id == current_professor.id,
            GmailAccount.subject_id == subject.id,
            GmailAccount.id != gmail_account.id,
        )
    )
    existing_defaults = existing_defaults_result.scalars().all()

    for other_account in existing_defaults:
        other_account.subject_id = None

    gmail_account.subject_id = subject.id
    gmail_account.is_active = True

    await db.commit()
    await db.refresh(gmail_account)

    return gmail_account


@router.post("/gmail-accounts/{gmail_account_id}/test")
async def send_gmail_account_test_email(
    gmail_account_id: int,
    current_professor: User = Depends(get_current_professor),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GmailAccount).where(
            GmailAccount.id == gmail_account_id,
            GmailAccount.professor_id == current_professor.id,
        )
    )
    gmail_account = result.scalar_one_or_none()

    if gmail_account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Gmail account not found",
        )

    if not gmail_account.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This Gmail account is inactive",
        )

    try:
        await send_email(
            to=current_professor.email,
            subject="SE Autograder · Gmail test email",
            body_html=test_email_html(
                professor_name=current_professor.name or current_professor.email,
                gmail_account_email=gmail_account.account_email,
            ),
            gmail_account_email=gmail_account.account_email,
            db=db,
        )

    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Test email failed: {str(exc)}",
        ) from exc

    return {
        "message": "Test email sent successfully",
        "recipient_email": current_professor.email,
        "gmail_account_used": gmail_account.account_email,
    }