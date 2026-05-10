import asyncio
import json
import sys
from pathlib import Path

from cryptography.fernet import Fernet
from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.database import AsyncSessionLocal
from app.models import GmailAccount, User


def get_setting(name: str, default=None):
    return getattr(settings, name, getattr(settings, name.lower(), default))


def decrypt_credentials(credentials_json: str) -> dict:
    fernet_key = get_setting("FERNET_KEY")

    if isinstance(fernet_key, str):
        fernet_key = fernet_key.encode("utf-8")

    raw = Fernet(fernet_key).decrypt(credentials_json.encode("utf-8")).decode("utf-8")
    return json.loads(raw)


def mask(value: str | None, keep: int = 8) -> str:
    if not value:
        return "NO"

    if len(value) <= keep:
        return "*" * len(value)

    return value[:keep] + "..."


async def main():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(GmailAccount).order_by(GmailAccount.id.asc())
        )
        accounts = result.scalars().all()

        if not accounts:
            print("No Gmail accounts found.")
            return

        print("\nCONNECTED GMAIL ACCOUNTS")
        print("=" * 100)

        for account in accounts:
            professor = await db.get(User, account.professor_id)

            try:
                credentials = decrypt_credentials(account.credentials_json)
                token = credentials.get("token") or credentials.get("access_token")
                refresh_token = credentials.get("refresh_token")
                expiry = (
                    credentials.get("expiry")
                    or credentials.get("token_expiry")
                    or credentials.get("expires_at")
                )
                decrypt_status = "OK"
            except Exception as exc:
                token = None
                refresh_token = None
                expiry = None
                decrypt_status = f"ERROR: {exc}"

            print(f"\nID:             {account.id}")
            print(f"Email:          {account.account_email}")
            print(f"Active:         {account.is_active}")
            print(f"Professor ID:   {account.professor_id}")
            print(f"Professor:      {professor.email if professor else 'UNKNOWN'}")
            print(f"Subject ID:     {account.subject_id}")
            print(f"Token:          {mask(token)}")
            print(f"Refresh token:  {mask(refresh_token)}")
            print(f"Token expiry:   {expiry}")
            print(f"Decrypt status: {decrypt_status}")

        print("\n")


if __name__ == "__main__":
    asyncio.run(main())