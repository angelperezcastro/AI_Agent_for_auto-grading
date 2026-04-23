from fastapi import FastAPI

from app import models  # noqa: F401
from app.routers.auth import router as auth_router
from app.routers.gmail_auth import router as gmail_auth_router
from app.routers.settings import router as settings_router

app = FastAPI(
    title="SE Autograder API",
    version="0.1.0",
)

app.include_router(auth_router)
app.include_router(gmail_auth_router)
app.include_router(settings_router)


@app.get("/")
async def root():
    return {"message": "SE Autograder backend is running"}


@app.get("/health")
async def health():
    return {"status": "ok"}