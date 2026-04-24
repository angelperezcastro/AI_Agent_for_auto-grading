from datetime import datetime
from pydantic import BaseModel, Field


class SubjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None


class SubjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = None


class SubjectRead(BaseModel):
    id: int
    name: str
    description: str | None
    professor_id: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    description: str | None = None
    topic: str = Field(min_length=2, max_length=255)
    gmail_account_id: int | None = None


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = None
    topic: str | None = Field(default=None, min_length=2, max_length=255)
    gmail_account_id: int | None = None


class ProjectRead(BaseModel):
    id: int
    subject_id: int
    name: str
    description: str | None
    topic: str
    gmail_account_id: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AssignGmailAccountRequest(BaseModel):
    gmail_account_id: int | None


class EnrollmentCreate(BaseModel):
    project_id: int


class EnrollmentRead(BaseModel):
    id: int
    student_id: int
    project_id: int
    current_deliverable: int
    status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SubmissionCreate(BaseModel):
    enrollment_id: int
    deliverable_number: int = Field(ge=1, le=4)
    content: str = Field(min_length=20)


class SubmissionRead(BaseModel):
    id: int
    enrollment_id: int
    deliverable_number: int
    content: str
    submitted_at: datetime
    email_sent: bool
    email_error: str | None

    model_config = {"from_attributes": True}