from fastapi import FastAPI

from app import models  # noqa: F401
from app.routers.auth import router as auth_router
from app.routers.enrollments import router as enrollments_router
from app.routers.evaluations import router as evaluations_router
from app.routers.gmail_auth import router as gmail_auth_router
from app.routers.projects import router as projects_router
from app.routers.settings import router as settings_router
from app.routers.subjects import router as subjects_router
from app.routers.submissions import router as submissions_router

app = FastAPI(
    title="SE Autograder API",
    version="0.1.0",
)

app.include_router(auth_router)
app.include_router(gmail_auth_router)
app.include_router(settings_router)
app.include_router(subjects_router)
app.include_router(projects_router)
app.include_router(enrollments_router)
app.include_router(submissions_router)
app.include_router(evaluations_router)


@app.get("/")
async def root():
    return {"message": "SE Autograder backend is running"}


@app.get("/health")
async def health():
    return {"status": "ok"}