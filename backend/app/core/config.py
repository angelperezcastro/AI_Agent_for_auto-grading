import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str

    GEMINI_API_KEY: str
    FERNET_KEY: str

    OAUTHLIB_INSECURE_TRANSPORT: str | None = None

    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL.startswith("postgresql+asyncpg://"):
            return self.DATABASE_URL.replace(
                "postgresql+asyncpg://",
                "postgresql+psycopg2://",
                1,
            )
        return self.DATABASE_URL


@lru_cache
def get_settings() -> Settings:
    loaded_settings = Settings()

    # Solo para desarrollo local.
    if loaded_settings.OAUTHLIB_INSECURE_TRANSPORT:
        os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = loaded_settings.OAUTHLIB_INSECURE_TRANSPORT

    return loaded_settings


settings = get_settings()