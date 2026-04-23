import json
from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import select

from app.core.crypto import decrypt_text, encrypt_text
from app.models import GmailAccount, User, UserRole
from app.services import email_service


@pytest.mark.asyncio
async def test_get_gmail_service_decrypts_and_refreshes_expired_tokens(session_maker, monkeypatch):
    async with session_maker() as session:
        professor = User(
            name="Professor Gmail",
            email="prof.gmail@example.com",
            hashed_password="hashed_password",
            role=UserRole.PROFESSOR,
            is_active=True,
        )
        session.add(professor)
        await session.commit()
        await session.refresh(professor)

        expired_credentials_payload = {
            "token": "expired-access-token",
            "refresh_token": "refresh-token-123",
            "token_uri": "https://oauth2.googleapis.com/token",
            "client_id": "fake-client-id",
            "client_secret": "fake-client-secret",
            "scopes": [
                "https://www.googleapis.com/auth/gmail.send",
                "openid",
                "https://www.googleapis.com/auth/userinfo.email",
            ],
            "expiry": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat(),
            "id_token": "fake-id-token",
        }

        gmail_account = GmailAccount(
            account_email="sender@example.com",
            credentials_json=encrypt_text(json.dumps(expired_credentials_payload)),
            subject_id=None,
            professor_id=professor.id,
            is_active=True,
        )
        session.add(gmail_account)
        await session.commit()

    captured = {}

    class DummyService:
        pass

    def fake_build(service_name, version, credentials, cache_discovery=False):
        captured["service_name"] = service_name
        captured["version"] = version
        captured["token"] = credentials.token
        captured["cache_discovery"] = cache_discovery
        return DummyService()

    def fake_refresh(self, request):
        self.token = "refreshed-access-token"
        self.expiry = datetime.now(timezone.utc) + timedelta(hours=1)

    monkeypatch.setattr(email_service, "build", fake_build)
    monkeypatch.setattr(email_service.Credentials, "refresh", fake_refresh, raising=True)

    async with session_maker() as session:
        service = await email_service.get_gmail_service("sender@example.com", session)

        assert isinstance(service, DummyService)
        assert captured["service_name"] == "gmail"
        assert captured["version"] == "v1"
        assert captured["token"] == "refreshed-access-token"
        assert captured["cache_discovery"] is False

        result = await session.execute(
            select(GmailAccount).where(GmailAccount.account_email == "sender@example.com")
        )
        stored_account = result.scalar_one()

        decrypted_payload = json.loads(decrypt_text(stored_account.credentials_json))

        assert decrypted_payload["token"] == "refreshed-access-token"
        assert decrypted_payload["refresh_token"] == "refresh-token-123"
        assert decrypted_payload["client_id"] == "fake-client-id"