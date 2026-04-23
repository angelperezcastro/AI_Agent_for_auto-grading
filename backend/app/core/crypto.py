from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


fernet = Fernet(settings.FERNET_KEY.encode())


def encrypt_text(value: str) -> str:
    return fernet.encrypt(value.encode()).decode()


def decrypt_text(value: str) -> str:
    try:
        return fernet.decrypt(value.encode()).decode()
    except InvalidToken as exc:
        raise ValueError("Invalid encrypted payload or wrong FERNET_KEY") from exc