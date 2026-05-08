from datetime import timedelta
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.deps import get_current_user
from app.models import User
from app.schemas.auth import Token, UserRegister, UserResponse


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    payload: UserRegister,
    db: AsyncSession = Depends(get_db),
) -> UserResponse:
    normalized_email = payload.email.strip().lower()

    result = await db.execute(select(User).where(User.email == normalized_email))
    existing_user = result.scalar_one_or_none()

    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered",
        )

    user = User(
        name=payload.name.strip(),
        email=normalized_email,
        hashed_password=hash_password(payload.password),
        role=payload.role,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return user


async def _extract_login_payload(request: Request) -> tuple[str, str]:
    """
    Accepts both:
    1. JSON body from React:
       { "email": "...", "password": "..." }

    2. OAuth2-compatible form body:
       username=...&password=...
    """
    content_type = request.headers.get("content-type", "").lower()

    email: Any = None
    password: Any = None

    if "application/json" in content_type:
        try:
            body = await request.json()
        except Exception:
            body = {}

        email = body.get("email") or body.get("username")
        password = body.get("password")
    else:
        form = await request.form()
        email = form.get("email") or form.get("username")
        password = form.get("password")

    if not email or not password:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email and password are required",
        )

    return str(email).strip().lower(), str(password)


async def _authenticate_user(
    email: str,
    password: str,
    db: AsyncSession,
) -> User:
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()

    if user is None or not verify_password(password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Inactive user",
        )

    return user


@router.post("/login", response_model=Token)
async def login(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Token:
    normalized_email, password = await _extract_login_payload(request)

    user = await _authenticate_user(
        email=normalized_email,
        password=password,
        db=db,
    )

    access_token = create_access_token(
        subject=user.id,
        expires_delta=timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )

    return Token(access_token=access_token)


@router.get("/me", response_model=UserResponse)
async def read_me(current_user: User = Depends(get_current_user)) -> UserResponse:
    return current_user