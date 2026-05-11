from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401
from app.core.config import settings
from app.routers.auth import router as auth_router
from app.routers.enrollments import router as enrollments_router
from app.routers.evaluations import router as evaluations_router
from app.routers.gmail_auth import router as gmail_auth_router
from app.routers.professor import router as professor_router
from app.routers.professor_detail import router as professor_detail_router
from app.routers.projects import router as projects_router
from app.routers.settings import router as settings_router
from app.routers.subjects import router as subjects_router
from app.routers.submissions import router as submissions_router


def get_allowed_origins() -> list[str]:
    """
    Returns the allowed frontend origins for CORS.

    In production, this should come from the ALLOWED_ORIGINS environment variable.

    Example:
        ALLOWED_ORIGINS=https://your-frontend.vercel.app,http://localhost:5173,http://127.0.0.1:5173
    """

    if hasattr(settings, "allowed_origins_list"):
        origins = settings.allowed_origins_list
        if origins:
            return origins

    raw_origins = getattr(
        settings,
        "ALLOWED_ORIGINS",
        "http://localhost:5173,http://127.0.0.1:5173",
    )

    return [
        origin.strip()
        for origin in raw_origins.split(",")
        if origin.strip()
    ]


app = FastAPI(
    title="SE Autograder API",
    version="0.1.0",
    description="Backend API for the AI-powered software engineering autograding platform.",
)

# CORS configuration.
#
# Local frontend:
#   http://localhost:5173
#   http://127.0.0.1:5173
#
# Production frontend:
#   https://your-frontend.vercel.app
#
# Important:
# Because allow_credentials=True is enabled, do not use "*" as allow_origins.
# Explicit origins are required for authenticated requests and OAuth-related flows.
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_allowed_origins(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(gmail_auth_router)
app.include_router(settings_router)
app.include_router(subjects_router)
app.include_router(projects_router)
app.include_router(enrollments_router)
app.include_router(submissions_router)
app.include_router(evaluations_router)
app.include_router(professor_router)
app.include_router(professor_detail_router)


@app.get("/")
async def root():
    return {
        "message": "SE Autograder backend is running",
        "status": "ok",
    }


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "se-autograder-backend",
        "version": "0.1.0",
    }