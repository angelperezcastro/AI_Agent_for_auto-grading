import argparse
import asyncio
import json
import sys
from pathlib import Path

from cryptography.fernet import Fernet
from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.core.config import settings
from app.database import AsyncSessionLocal
from app.models import GmailAccount


EXPIRED_TIMESTAMP = "2000-01-01T00:00:00Z"


def get_setting(name: str, default=None):
    return getattr(settings, name, getattr(settings, name.lower(), default))


def get_fernet() -> Fernet:
    fernet_key = get_setting("FERNET_KEY")

    if not fernet_key:
        raise RuntimeError("FERNET_KEY missing from settings/.env")

    if isinstance(fernet_key, str):
        fernet_key = fernet_key.encode("utf-8")

    return Fernet(fernet_key)


def decrypt_credentials(credentials_json: str) -> dict:
    return json.loads(
        get_fernet()
        .decrypt(credentials_json.encode("utf-8"))
        .decode("utf-8")
    )


def encrypt_credentials(payload: dict) -> str:
    return (
        get_fernet()
        .encrypt(json.dumps(payload, ensure_ascii=False).encode("utf-8"))
        .decode("utf-8")
    )


async def get_account(db, account_id: int | None, account_email: str | None):
    if account_id:
        return await db.get(GmailAccount, account_id)

    if account_email:
        result = await db.execute(
            select(GmailAccount).where(GmailAccount.account_email == account_email)
        )
        return result.scalars().first()

    raise ValueError("Provide either --account-id or --account-email.")


async def main():
    parser = argparse.ArgumentParser(
        description="Expire a Gmail OAuth token stored in encrypted credentials_json."
    )
    parser.add_argument("--account-id", type=int)
    parser.add_argument("--account-email")

    args = parser.parse_args()

    async with AsyncSessionLocal() as db:
        account = await get_account(db, args.account_id, args.account_email)

        if not account:
            raise RuntimeError("Gmail account not found.")

        credentials = decrypt_credentials(account.credentials_json)

        old_expiry = (
            credentials.get("expiry")
            or credentials.get("token_expiry")
            or credentials.get("expires_at")
        )

        credentials["expiry"] = EXPIRED_TIMESTAMP
        credentials["token_expiry"] = EXPIRED_TIMESTAMP

        account.credentials_json = encrypt_credentials(credentials)

        await db.commit()

        print("\nGMAIL TOKEN EXPIRED")
        print("=" * 80)
        print(f"Account ID:     {account.id}")
        print(f"Account email:  {account.account_email}")
        print(f"Old expiry:     {old_expiry}")
        print(f"New expiry:     {EXPIRED_TIMESTAMP}")
        print("=" * 80)
        print("Now trigger an email send. The backend should refresh this token automatically.\n")


if __name__ == "__main__":
    asyncio.run(main())