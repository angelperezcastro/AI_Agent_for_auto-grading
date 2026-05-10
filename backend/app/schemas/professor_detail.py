from datetime import datetime
from typing import Any

from pydantic import BaseModel

from app.schemas.core import EvaluationRead


class ProfessorEmailLogRead(BaseModel):
    id: int
    email_type: str
    recipient_email: str
    gmail_account_used: str | None
    sent_at: datetime
    error_message: str | None


class ProfessorDeliverableDetailRead(BaseModel):
    deliverable_number: int
    submitted: bool
    status: str

    submission_id: int | None = None
    content: str | None = None
    submitted_at: datetime | None = None
    deadline_at: datetime | None = None

    evaluation: EvaluationRead | None = None

    confirmation_email_sent: bool = False
    feedback_email_sent: bool = False
    override_feedback_email_sent: bool = False

    email_failed: bool = False
    email_error: str | None = None
    email_logs: list[ProfessorEmailLogRead] = []


class ProfessorEnrollmentDetailRead(BaseModel):
    enrollment_id: int
    enrollment_status: str
    current_deliverable: int
    enrolled_at: datetime

    student_id: int
    student_name: str
    student_email: str

    subject_id: int
    subject_name: str

    project_id: int
    project_name: str
    project_topic: str
    project_description: str | None

    deliverables: list[ProfessorDeliverableDetailRead]