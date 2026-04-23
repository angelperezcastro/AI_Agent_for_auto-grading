import json
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import JSONResponse, RedirectResponse
from google.auth.transport.requests import Request as GoogleRequest
from google.oauth2 import id_token as google_id_token
from google_auth_oauthlib.flow import Flow
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.crypto import decrypt_text, encrypt_text
from app.db.session import get_db
from app.deps import get_current_professor
from app.models import GmailAccount, User

router = APIRouter(prefix="/auth/gmail", tags=["gmail auth"])

GMAIL_OAUTH_SCOPES = [
    "https://www.googleapis.com/auth/gmail.send",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]


def build_google_client_config() -> dict:
    return {
        "web": {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
        }
    }


def create_flow(*, state: str | None = None, code_verifier: str | None = None) -> Flow:
    return Flow.from_client_config(
        build_google_client_config(),
        scopes=GMAIL_OAUTH_SCOPES,
        redirect_uri=settings.GOOGLE_REDIRECT_URI,
        state=state,
        code_verifier=code_verifier,
    )


def create_oauth_state(professor_id: int, code_verifier: str) -> str:
    payload = {
        "purpose": "gmail_oauth_connect",
        "professor_id": professor_id,
        "code_verifier": code_verifier,
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_oauth_state(state: str) -> tuple[int, str]:
    try:
        payload = jwt.decode(
            state,
            settings.SECRET_KEY,
            algorithms=[settings.ALGORITHM],
        )

        if payload.get("purpose") != "gmail_oauth_connect":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid OAuth state purpose",
            )

        professor_id = payload.get("professor_id")
        code_verifier = payload.get("code_verifier")

        if professor_id is None or not code_verifier:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing professor id or code_verifier in OAuth state",
            )

        return int(professor_id), str(code_verifier)

    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired OAuth state",
        ) from exc


def serialize_credentials(credentials) -> dict:
    return {
        "token": credentials.token,
        "refresh_token": credentials.refresh_token,
        "token_uri": credentials.token_uri,
        "client_id": credentials.client_id,
        "client_secret": credentials.client_secret,
        "scopes": list(credentials.scopes) if credentials.scopes else GMAIL_OAUTH_SCOPES,
        "expiry": credentials.expiry.isoformat() if credentials.expiry else None,
        "id_token": credentials.id_token,
    }


@router.get("/authorize")
async def gmail_authorize(
    return_url: bool = Query(
        default=False,
        description="If true, return the Google consent URL as JSON instead of redirecting. Useful for testing in Swagger.",
    ),
    current_professor: User = Depends(get_current_professor),
):
    code_verifier = secrets.token_urlsafe(64)
    state = create_oauth_state(current_professor.id, code_verifier)

    flow = create_flow(
        state=state,
        code_verifier=code_verifier,
    )

    authorization_url, _ = flow.authorization_url(
        access_type="offline",
        include_granted_scopes="true",
        prompt="consent",
        state=state,
    )

    if return_url:
        return {"authorization_url": authorization_url}

    return RedirectResponse(url=authorization_url)


@router.get("/callback")
async def gmail_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    error = request.query_params.get("error")
    if error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google OAuth error: {error}",
        )

    state = request.query_params.get("state")
    if not state:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Missing state in Google callback",
        )

    professor_id, code_verifier = decode_oauth_state(state)

    flow = create_flow(
        state=state,
        code_verifier=code_verifier,
    )

    flow.fetch_token(authorization_response=str(request.url))
    credentials = flow.credentials

    if not credentials.id_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not return an ID token. Check requested scopes.",
        )

    id_info = google_id_token.verify_oauth2_token(
        credentials.id_token,
        GoogleRequest(),
        settings.GOOGLE_CLIENT_ID,
    )

    account_email = id_info.get("email")
    email_verified = id_info.get("email_verified", False)

    if not account_email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Could not determine the authorized Google account email",
        )

    if not email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email is not verified",
        )

    result = await db.execute(
        select(GmailAccount).where(
            GmailAccount.professor_id == professor_id,
            GmailAccount.account_email == account_email,
        )
    )
    existing_account = result.scalar_one_or_none()

    credentials_payload = serialize_credentials(credentials)

    if existing_account is not None:
        existing_payload = json.loads(decrypt_text(existing_account.credentials_json))
        if not credentials_payload.get("refresh_token"):
            credentials_payload["refresh_token"] = existing_payload.get("refresh_token")

        existing_account.credentials_json = encrypt_text(json.dumps(credentials_payload))
        existing_account.is_active = True
        gmail_account = existing_account
    else:
        gmail_account = GmailAccount(
            account_email=account_email,
            credentials_json=encrypt_text(json.dumps(credentials_payload)),
            professor_id=professor_id,
            subject_id=None,
            is_active=True,
        )
        db.add(gmail_account)

    await db.commit()
    await db.refresh(gmail_account)

    return JSONResponse(
        status_code=status.HTTP_200_OK,
        content={
            "message": "Gmail account connected successfully",
            "gmail_account_id": gmail_account.id,
            "account_email": gmail_account.account_email,
            "scopes": credentials_payload.get("scopes", []),
        },
    )