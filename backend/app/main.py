from app.routers.professor import router as professor_router
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401
from app.routers.auth import router as auth_router
from app.routers.enrollments import router as enrollments_router
from app.routers.evaluations import router as evaluations_router
from app.routers.gmail_auth import router as gmail_auth_router
from app.routers.projects import router as projects_router
from app.routers.settings import router as settings_router
from app.routers.subjects import router as subjects_router
from app.routers.submissions import router as submissions_router
from app.routers.professor_detail import router as professor_detail_router

app = FastAPI(
    title="SE Autograder API",
    version="0.1.0",
)

# CORS configuration for the React + Vite frontend.
# Local frontend: http://localhost:5173
# Local backend:  http://127.0.0.1:8000
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
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
    return {"message": "SE Autograder backend is running"}


@app.get("/health")
async def health():
    return {"status": "ok"}