from fastapi import FastAPI

from app import models  # noqa: F401


app = FastAPI(
    title="SE Autograder API",
    version="0.1.0",
)


@app.get("/")
async def root():
    return {"message": "SE Autograder backend is running"}


@app.get("/health")
async def health():
    return {"status": "ok"}