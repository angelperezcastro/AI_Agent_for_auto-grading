from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.deps import get_current_professor
from app.models import GmailAccount, Subject, User
from app.schemas.settings import GmailAccountResponse, SetDefaultGmailAccountRequest

router = APIRouter(prefix="/settings", tags=["settings"])


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


@router.delete("/gmail-accounts/{gmail_account_id}", status_code=status.HTTP_204_NO_CONTENT)
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

    # Quita cualquier otra cuenta por defecto previa de esa asignatura
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

    # Marca esta cuenta como la cuenta por defecto de la asignatura
    gmail_account.subject_id = subject.id
    gmail_account.is_active = True

    await db.commit()
    await db.refresh(gmail_account)

    return gmail_account