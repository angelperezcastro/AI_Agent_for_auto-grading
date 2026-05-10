import base64
import json
from datetime import datetime, timezone
from email.mime.text import MIMEText
from typing import Any

from fastapi import HTTPException, status
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import decrypt_text, encrypt_text
from app.models import GmailAccount


DEFAULT_GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
DEFAULT_GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"


def parse_expiry(expiry_value: str | None):
    """
    Converts the stored OAuth expiry value into the naive UTC datetime
    expected by google-auth.

    Supports:
    - 2026-05-22T10:30:00
    - 2026-05-22T10:30:00+00:00
    - 2026-05-22T10:30:00Z
    """

    if not expiry_value:
        return None

    expiry_text = str(expiry_value).strip()

    if expiry_text.endswith("Z"):
        expiry_text = expiry_text[:-1] + "+00:00"

    parsed = datetime.fromisoformat(expiry_text)

    if parsed.tzinfo is not None:
        return parsed.astimezone(timezone.utc).replace(tzinfo=None)

    return parsed


def serialize_expiry(expiry: datetime | None) -> str | None:
    """
    Stores expiry as an explicit UTC ISO string ending in Z.
    """

    if expiry is None:
        return None

    if expiry.tzinfo is None:
        expiry = expiry.replace(tzinfo=timezone.utc)
    else:
        expiry = expiry.astimezone(timezone.utc)

    return expiry.isoformat().replace("+00:00", "Z")


def get_payload_value(payload: dict[str, Any], *keys: str, default=None):
    for key in keys:
        value = payload.get(key)

        if value is not None:
            return value

    return default


def build_credentials_from_payload(credentials_payload: dict[str, Any]) -> Credentials:
    """
    Builds Google OAuth credentials from the encrypted DB payload.

    The project has used slightly different field names in different scripts:
    - token / access_token
    - expiry / token_expiry / expires_at

    This function supports all of them to avoid breaking old connected accounts.
    """

    token = get_payload_value(
        credentials_payload,
        "token",
        "access_token",
    )

    refresh_token = credentials_payload.get("refresh_token")

    token_uri = credentials_payload.get("token_uri") or DEFAULT_GOOGLE_TOKEN_URI

    client_id = credentials_payload.get("client_id")
    client_secret = credentials_payload.get("client_secret")

    scopes = credentials_payload.get("scopes") or DEFAULT_GMAIL_SCOPES

    expiry_value = get_payload_value(
        credentials_payload,
        "expiry",
        "token_expiry",
        "expires_at",
    )

    credentials = Credentials(
        token=token,
        refresh_token=refresh_token,
        token_uri=token_uri,
        client_id=client_id,
        client_secret=client_secret,
        scopes=scopes,
        id_token=credentials_payload.get("id_token"),
    )

    credentials.expiry = parse_expiry(expiry_value)

    return credentials


def serialize_credentials(
    credentials: Credentials,
    previous_payload: dict[str, Any],
) -> dict[str, Any]:
    """
    Serializes refreshed credentials back to DB.

    Important:
    Google usually does not return a new refresh_token on refresh.
    Therefore, we preserve the previous refresh_token if needed.
    """

    expiry = serialize_expiry(credentials.expiry)

    refresh_token = (
        credentials.refresh_token
        or previous_payload.get("refresh_token")
    )

    token_uri = (
        credentials.token_uri
        or previous_payload.get("token_uri")
        or DEFAULT_GOOGLE_TOKEN_URI
    )

    client_id = (
        credentials.client_id
        or previous_payload.get("client_id")
    )

    client_secret = (
        credentials.client_secret
        or previous_payload.get("client_secret")
    )

    scopes = list(
        credentials.scopes
        or previous_payload.get("scopes")
        or DEFAULT_GMAIL_SCOPES
    )

    return {
        "token": credentials.token,
        "access_token": credentials.token,
        "refresh_token": refresh_token,
        "token_uri": token_uri,
        "client_id": client_id,
        "client_secret": client_secret,
        "scopes": scopes,
        "expiry": expiry,
        "token_expiry": expiry,
        "id_token": getattr(credentials, "id_token", None),
    }


async def get_gmail_account_by_email(
    account_email: str,
    db: AsyncSession,
) -> GmailAccount:
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

    return gmail_account


async def refresh_credentials_if_needed(
    gmail_account: GmailAccount,
    credentials: Credentials,
    credentials_payload: dict[str, Any],
    db: AsyncSession,
) -> Credentials:
    """
    Refreshes expired Gmail OAuth credentials and persists the new encrypted
    token payload back into GmailAccount.credentials_json.

    This is the critical behavior needed for Week 6:
    if token_expiry is manually set to the past, the next email send must
    refresh the token automatically and continue without manual intervention.
    """

    if not credentials.expired:
        return credentials

    if not credentials.refresh_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=(
                f"Gmail account {gmail_account.account_email} has an expired "
                "OAuth token but no refresh_token. Reconnect this Gmail account "
                "from Settings."
            ),
        )

    credentials.refresh(GoogleRequest())

    refreshed_payload = serialize_credentials(
        credentials=credentials,
        previous_payload=credentials_payload,
    )

    gmail_account.credentials_json = encrypt_text(
        json.dumps(refreshed_payload, ensure_ascii=False)
    )

    await db.commit()
    await db.refresh(gmail_account)

    return credentials


async def get_gmail_service(
    account_email: str,
    db: AsyncSession,
):
    gmail_account = await get_gmail_account_by_email(
        account_email=account_email,
        db=db,
    )

    try:
        decrypted_credentials = decrypt_text(gmail_account.credentials_json)
        credentials_payload = json.loads(decrypted_credentials)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=(
                f"Could not decrypt Gmail credentials for "
                f"{gmail_account.account_email}: {exc}"
            ),
        ) from exc

    credentials = build_credentials_from_payload(credentials_payload)

    credentials = await refresh_credentials_if_needed(
        gmail_account=gmail_account,
        credentials=credentials,
        credentials_payload=credentials_payload,
        db=db,
    )

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