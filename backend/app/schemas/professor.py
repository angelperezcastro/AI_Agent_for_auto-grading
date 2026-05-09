from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProfessorEnrollmentRow(BaseModel):
    enrollment_id: int

    student_id: int
    student_name: str
    student_email: str

    subject_id: int
    subject_name: str

    project_id: int
    project_name: str

    current_deliverable: int
    evaluated_count: int
    progress_label: str

    latest_submission_id: Optional[int] = None
    latest_score: Optional[int] = None
    latest_submission_status: Optional[str] = None
    last_activity: Optional[datetime] = None

    email_failed: bool
    email_status_text: str

    status: str