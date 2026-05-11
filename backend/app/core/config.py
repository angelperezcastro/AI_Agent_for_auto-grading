import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Database
    DATABASE_URL: str

    # Security / JWT
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 10080

    # Google / Gmail OAuth
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str

    # Gemini
    GEMINI_API_KEY: str
    GEMINI_MODEL: str = "gemini-2.5-flash"
    GEMINI_FALLBACK_MODEL: str = "gemini-2.5-flash-lite"

    # Encryption
    FERNET_KEY: str

    # Frontend / backend public URLs
    BACKEND_URL: str = "http://127.0.0.1:8000"
    FRONTEND_URL: str = "http://localhost:5173"

    # CORS
    #
    # Local example:
    # ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
    #
    # Production example:
    # ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173,http://127.0.0.1:5173
    ALLOWED_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    # Local OAuth helper.
    # Only use this locally with HTTP callbacks.
    # Do NOT set this in Railway production.
    OAUTHLIB_INSECURE_TRANSPORT: str | None = None

    @property
    def allowed_origins_list(self) -> list[str]:
        return [
            origin.strip()
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]

    @property
    def async_database_url(self) -> str:
        """
        URL used by the FastAPI application with SQLAlchemy async engine.

        Railway commonly provides:
            postgresql://...

        SQLAlchemy async engine needs:
            postgresql+asyncpg://...
        """

        url = self.DATABASE_URL

        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)

        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)

        return url

    @property
    def sync_database_url(self) -> str:
        """
        URL used by Alembic migrations with a synchronous PostgreSQL driver.

        Alembic should use:
            postgresql+psycopg2://...
        """

        url = self.DATABASE_URL

        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql://", 1)

        if url.startswith("postgresql+asyncpg://"):
            url = url.replace(
                "postgresql+asyncpg://",
                "postgresql+psycopg2://",
                1,
            )
        elif url.startswith("postgresql://"):
            url = url.replace(
                "postgresql://",
                "postgresql+psycopg2://",
                1,
            )

        return url


@lru_cache
def get_settings() -> Settings:
    loaded_settings = Settings()

    # Only for local development with HTTP OAuth redirect URIs.
    # Never enable this in production.
    if loaded_settings.OAUTHLIB_INSECURE_TRANSPORT:
        os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = (
            loaded_settings.OAUTHLIB_INSECURE_TRANSPORT
        )

    return loaded_settings


settings = get_settings()