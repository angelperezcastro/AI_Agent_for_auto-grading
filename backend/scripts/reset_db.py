import os
import sys
from sqlalchemy import create_engine, text


CONFIRMATION_FLAG = "--yes-delete-production-db"


def get_database_url() -> str:
    database_url = (
        os.getenv("DATABASE_URL")
        or os.getenv("DATABASE_PUBLIC_URL")
        or os.getenv("POSTGRES_URL")
        or os.getenv("POSTGRES_PUBLIC_URL")
    )

    if not database_url:
        raise RuntimeError(
            "No database URL found. Expected DATABASE_URL, DATABASE_PUBLIC_URL, "
            "POSTGRES_URL or POSTGRES_PUBLIC_URL."
        )

    # Normalize Railway/Postgres URLs for synchronous SQLAlchemy.
    if database_url.startswith("postgres://"):
        database_url = database_url.replace("postgres://", "postgresql://", 1)

    # If the URL was accidentally configured with asyncpg, convert it to sync.
    if database_url.startswith("postgresql+asyncpg://"):
        database_url = database_url.replace("postgresql+asyncpg://", "postgresql+psycopg2://", 1)

    return database_url


def reset_database() -> None:
    if CONFIRMATION_FLAG not in sys.argv:
        print(
            f"""
DANGEROUS OPERATION BLOCKED.

This script deletes ALL tables, enums, migrations and data
from the configured PostgreSQL database.

To run it, use:

python scripts/reset_db.py {CONFIRMATION_FLAG}
"""
        )
        raise SystemExit(1)

    database_url = get_database_url()

    print("Connecting to database...")
    engine = create_engine(database_url, isolation_level="AUTOCOMMIT")

    with engine.begin() as conn:
        print("Dropping public schema...")
        conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE;"))

        print("Recreating public schema...")
        conn.execute(text("CREATE SCHEMA public;"))

        print("Restoring schema permissions...")
        conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))

    engine.dispose()

    print("Database reset completed successfully.")


if __name__ == "__main__":
    reset_database()