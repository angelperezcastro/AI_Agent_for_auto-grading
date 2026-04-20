from __future__ import annotations

from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import (
    JSON,
    Boolean,
    CheckConstraint,
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


class UserRole(str, PyEnum):
    STUDENT = "student"
    PROFESSOR = "professor"


class EnrollmentStatus(str, PyEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    DROPPED = "dropped"


class SubmissionStatus(str, PyEnum):
    SUBMITTED = "submitted"
    EVALUATED = "evaluated"
    OVERDUE = "overdue"


def enum_values(enum_cls) -> list[str]:
    return [item.value for item in enum_cls]


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(
            UserRole,
            name="user_role",
            values_callable=enum_values,
        ),
        nullable=False,
    )
    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )

    subjects: Mapped[list["Subject"]] = relationship(
        "Subject",
        back_populates="professor",
        cascade="all, delete-orphan",
        foreign_keys="Subject.professor_id",
    )
    enrollments: Mapped[list["Enrollment"]] = relationship(
        "Enrollment",
        back_populates="student",
        cascade="all, delete-orphan",
        foreign_keys="Enrollment.student_id",
    )
    gmail_accounts: Mapped[list["GmailAccount"]] = relationship(
        "GmailAccount",
        back_populates="professor",
        cascade="all, delete-orphan",
        foreign_keys="GmailAccount.professor_id",
    )
    evaluation_overrides: Mapped[list["Evaluation"]] = relationship(
        "Evaluation",
        back_populates="override_by_professor",
        foreign_keys="Evaluation.override_by_professor_id",
    )


class Subject(TimestampMixin, Base):
    __tablename__ = "subjects"
    __table_args__ = (
        UniqueConstraint("professor_id", "name", name="uq_subjects_professor_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    professor_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    professor: Mapped["User"] = relationship(
        "User",
        back_populates="subjects",
        foreign_keys=[professor_id],
    )
    projects: Mapped[list["Project"]] = relationship(
        "Project",
        back_populates="subject",
        cascade="all, delete-orphan",
    )
    gmail_accounts: Mapped[list["GmailAccount"]] = relationship(
        "GmailAccount",
        back_populates="subject",
    )


class Project(TimestampMixin, Base):
    __tablename__ = "projects"
    __table_args__ = (
        UniqueConstraint("subject_id", "name", name="uq_projects_subject_name"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(150), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    topic: Mapped[str] = mapped_column(String(255), nullable=False)

    subject_id: Mapped[int] = mapped_column(
        ForeignKey("subjects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    subject: Mapped["Subject"] = relationship("Subject", back_populates="projects")
    enrollments: Mapped[list["Enrollment"]] = relationship(
        "Enrollment",
        back_populates="project",
        cascade="all, delete-orphan",
    )


class Enrollment(TimestampMixin, Base):
    __tablename__ = "enrollments"
    __table_args__ = (
        UniqueConstraint("student_id", "project_id", name="uq_enrollments_student_project"),
        CheckConstraint(
            "current_deliverable >= 1 AND current_deliverable <= 4",
            name="ck_enrollments_current_deliverable_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    student_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    status: Mapped[EnrollmentStatus] = mapped_column(
        Enum(
            EnrollmentStatus,
            name="enrollment_status",
            values_callable=enum_values,
        ),
        nullable=False,
        default=EnrollmentStatus.ACTIVE,
        server_default=EnrollmentStatus.ACTIVE.value,
    )

    current_deliverable: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=1,
        server_default=text("1"),
    )

    enrolled_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    student: Mapped["User"] = relationship(
        "User",
        back_populates="enrollments",
        foreign_keys=[student_id],
    )
    project: Mapped["Project"] = relationship("Project", back_populates="enrollments")
    submissions: Mapped[list["Submission"]] = relationship(
        "Submission",
        back_populates="enrollment",
        cascade="all, delete-orphan",
        order_by="Submission.deliverable_number",
    )


class Submission(Base):
    __tablename__ = "submissions"
    __table_args__ = (
        UniqueConstraint(
            "enrollment_id",
            "deliverable_number",
            name="uq_submissions_enrollment_deliverable",
        ),
        CheckConstraint(
            "deliverable_number >= 1 AND deliverable_number <= 4",
            name="ck_submissions_deliverable_number_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    enrollment_id: Mapped[int] = mapped_column(
        ForeignKey("enrollments.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    deliverable_number: Mapped[int] = mapped_column(Integer, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)

    status: Mapped[SubmissionStatus] = mapped_column(
        Enum(
            SubmissionStatus,
            name="submission_status",
            values_callable=enum_values,
        ),
        nullable=False,
        default=SubmissionStatus.SUBMITTED,
        server_default=SubmissionStatus.SUBMITTED.value,
    )

    submitted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    deadline_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
    )

    enrollment: Mapped["Enrollment"] = relationship("Enrollment", back_populates="submissions")
    evaluation: Mapped["Evaluation | None"] = relationship(
        "Evaluation",
        back_populates="submission",
        uselist=False,
        cascade="all, delete-orphan",
    )


class Evaluation(Base):
    __tablename__ = "evaluations"
    __table_args__ = (
        UniqueConstraint("submission_id", name="uq_evaluations_submission"),
        CheckConstraint("ai_score >= 0 AND ai_score <= 100", name="ck_evaluations_ai_score_range"),
        CheckConstraint(
            "(override_score IS NULL) OR (override_score >= 0 AND override_score <= 100)",
            name="ck_evaluations_override_score_range",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    submission_id: Mapped[int] = mapped_column(
        ForeignKey("submissions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    ai_score: Mapped[int] = mapped_column(Integer, nullable=False)
    criteria_breakdown: Mapped[dict] = mapped_column(JSON, nullable=False)
    feedback: Mapped[str] = mapped_column(Text, nullable=False)

    evaluated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    is_overridden: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default=text("false"),
    )
    override_score: Mapped[int | None] = mapped_column(Integer, nullable=True)
    override_comment: Mapped[str | None] = mapped_column(Text, nullable=True)
    override_by_professor_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    override_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    submission: Mapped["Submission"] = relationship("Submission", back_populates="evaluation")
    override_by_professor: Mapped["User | None"] = relationship(
        "User",
        back_populates="evaluation_overrides",
        foreign_keys=[override_by_professor_id],
    )


class GmailAccount(Base):
    __tablename__ = "gmail_accounts"
    __table_args__ = (
        UniqueConstraint(
            "professor_id",
            "account_email",
            name="uq_gmail_accounts_professor_email",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)

    account_email: Mapped[str] = mapped_column(String(255), nullable=False, index=True)
    credentials_json: Mapped[str] = mapped_column(Text, nullable=False)

    subject_id: Mapped[int | None] = mapped_column(
        ForeignKey("subjects.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    professor_id: Mapped[int] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    is_active: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        server_default=text("true"),
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    professor: Mapped["User"] = relationship(
        "User",
        back_populates="gmail_accounts",
        foreign_keys=[professor_id],
    )
    subject: Mapped["Subject | None"] = relationship(
        "Subject",
        back_populates="gmail_accounts",
        foreign_keys=[subject_id],
    )