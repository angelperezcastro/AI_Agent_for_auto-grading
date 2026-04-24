import base64
import json
from datetime import datetime, timezone
from email.mime.text import MIMEText

from fastapi import HTTPException, status
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_text, encrypt_text
from app.models import GmailAccount


def parse_expiry(expiry_str: str | None):
    if not expiry_str:
        return None

    parsed = datetime.fromisoformat(expiry_str)

    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)

    return parsed


def serialize_credentials(credentials: Credentials) -> dict:
    return {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": list(credentials.scopes) if credentials.scopes else [],
        "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
        "id_token": getattr(credentials, "id_token", None),
    }


async def get_gmail_service(
    account_email: str,
    db: AsyncSession,
):
    result = await db.execute(
        select(GmailAccount)
        .where(
            GmailAccount.account_email == account_email,
            GmailAccount.is_active.is_(True),
        )
        .order_by(GmailAccount.id.desc())
    )

    gmail_account = result.scalars().first()

    if gmail_account is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No active GmailAccount found for {account_email}",
        )

    credentials_payload = json.loads(decrypt_text(gmail_account.credentials_json))

    credentials = Credentials(
        token=credentials_payload.get("token"),
        refresh_token=credentials_payload.get("refresh_token"),
        token_uri=credentials_payload.get("token_uri"),
        client_id=credentials_payload.get("client_id"),
        client_secret=credentials_payload.get("client_secret"),
        scopes=credentials_payload.get("scopes"),
        id_token=credentials_payload.get("id_token"),
    )

    credentials.expiry = parse_expiry(credentials_payload.get("expiry"))

    if credentials.expired and credentials.refresh_token:
        credentials.refresh(GoogleRequest())

        refreshed_payload = serialize_credentials(credentials)
        gmail_account.credentials_json = encrypt_text(json.dumps(refreshed_payload))

        await db.commit()
        await db.refresh(gmail_account)

    service = build(
        "gmail",
        "v1",
        credentials=credentials,
        cache_discovery=False,
    )

    return service


async def send_email(
    to: str,
    subject: str,
    body_html: str,
    gmail_account_email: str,
    db: AsyncSession,
):
    if not to:
        raise ValueError("Recipient email is required.")

    if not subject:
        raise ValueError("Email subject is required.")

    if not body_html:
        raise ValueError("Email body_html is required.")

    if not gmail_account_email:
        raise ValueError("Gmail account email is required.")

    service = await get_gmail_service(
        account_email=gmail_account_email,
        db=db,
    )

    message = MIMEText(body_html, "html", "utf-8")
    message["to"] = to
    message["from"] = gmail_account_email
    message["subject"] = subject

    raw_message = base64.urlsafe_b64encode(
        message.as_bytes()
    ).decode("utf-8")

    sent_message = (
        service.users()
        .messages()
        .send(
            userId="me",
            body={"raw": raw_message},
        )
        .execute()
    )

    return sent_message