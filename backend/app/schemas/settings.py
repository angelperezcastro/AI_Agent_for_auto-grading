from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class GmailAccountResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_email: str
    subject_id: int | None
    professor_id: int
    is_active: bool
    created_at: datetime


class SetDefaultGmailAccountRequest(BaseModel):
    subject_id: int = Field(gt=0)