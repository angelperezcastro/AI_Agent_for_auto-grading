import json
from datetime import datetime, timezone
from typing import Any

from cryptography.fernet import Fernet
from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models import GmailAccount


GMAIL_SCOPES = ["https://www.googleapis.com/auth/gmail.send"]
GOOGLE_TOKEN_URI = "https://oauth2.googleapis.com/token"


def _get_setting(name: str, default: Any = None) -> Any:
    """
    Supports both uppercase and lowercase Pydantic settings attributes.
    Example: settings.FERNET_KEY or settings.fernet_key.
    """
    return getattr(settings, name, getattr(settings, name.lower(), default))


def _get_fernet() -> Fernet:
    fernet_key = _get_setting("FERNET_KEY")

    if not fernet_key:
        raise RuntimeError("FERNET_KEY is missing from settings/.env")

    if isinstance(fernet_key, str):
        fernet_key = fernet_key.encode("utf-8")

    return Fernet(fernet_key)


def decrypt_credentials(credentials_json: str) -> dict:
    if not credentials_json:
        raise RuntimeError("Gmail credentials_json is empty.")

    encrypted = credentials_json.encode("utf-8")
    decrypted = _get_fernet().decrypt(encrypted).decode("utf-8")

    return json.loads(decrypted)


def encrypt_credentials(payload: dict) -> str:
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    return _get_fernet().encrypt(raw).decode("utf-8")


def _parse_expiry(value: Any) -> datetime | None:
    if not value:
        return None

    if isinstance(value, datetime):
        dt = value
    else:
        text = str(value).strip()

        if text.endswith("Z"):
            text = text[:-1] + "+00:00"

        dt = datetime.fromisoformat(text)

    # google-auth works best with naive UTC expiry datetimes.
    if dt.tzinfo is not None:
        dt = dt.astimezone(timezone.utc).replace(tzinfo=None)

    return dt


def _serialize_expiry(value: datetime | None) -> str | None:
    if not value:
        return None

    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)

    return value.isoformat().replace("+00:00", "Z")


def build_credentials_from_payload(payload: dict) -> Credentials:
    client_id = payload.get("client_id") or _get_setting("GOOGLE_CLIENT_ID")
    client_secret = payload.get("client_secret") or _get_setting("GOOGLE_CLIENT_SECRET")

    if not client_id:
        raise RuntimeError("GOOGLE_CLIENT_ID is missing.")
    if not client_secret:
        raise RuntimeError("GOOGLE_CLIENT_SECRET is missing.")

    expiry_value = (
        payload.get("expiry")
        or payload.get("token_expiry")
        or payload.get("expires_at")
    )

    credentials = Credentials(
        token=payload.get("token") or payload.get("access_token"),
        refresh_token=payload.get("refresh_token"),
        token_uri=payload.get("token_uri") or GOOGLE_TOKEN_URI,
        client_id=client_id,
        client_secret=client_secret,
        scopes=payload.get("scopes") or GMAIL_SCOPES,
        expiry=_parse_expiry(expiry_value),
    )

    return credentials


async def build_gmail_service_from_account(
    gmail_account: GmailAccount,
    db: AsyncSession,
):
    """
    Builds an authenticated Gmail API service.

    Critical behavior:
    - If the access token is expired, refresh it using refresh_token.
    - Persist the new token and expiry back into encrypted credentials_json.
    """

    payload = decrypt_credentials(gmail_account.credentials_json)
    credentials = build_credentials_from_payload(payload)

    if credentials.expired:
        if not credentials.refresh_token:
            raise RuntimeError(
                f"Gmail account {gmail_account.account_email} has an expired token "
                "but no refresh_token. Reconnect the Gmail account from Settings."
            )

        credentials.refresh(Request())

        new_expiry = _serialize_expiry(credentials.expiry)

        payload["token"] = credentials.token
        payload["access_token"] = credentials.token
        payload["refresh_token"] = credentials.refresh_token or payload.get("refresh_token")
        payload["token_uri"] = credentials.token_uri or GOOGLE_TOKEN_URI
        payload["client_id"] = credentials.client_id or payload.get("client_id")
        payload["client_secret"] = credentials.client_secret or payload.get("client_secret")
        payload["scopes"] = list(credentials.scopes or payload.get("scopes") or GMAIL_SCOPES)

        # Store both names so the rest of your code/scripts remain compatible.
        payload["expiry"] = new_expiry
        payload["token_expiry"] = new_expiry

        gmail_account.credentials_json = encrypt_credentials(payload)

        await db.commit()
        await db.refresh(gmail_account)

    return build("gmail", "v1", credentials=credentials)