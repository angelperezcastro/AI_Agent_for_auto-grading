import asyncio
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

# Make backend/ importable when running: python scripts/seed.py
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from sqlalchemy import select

from app.core.crypto import encrypt_text
from app.core.security import hash_password
from app.database import async_session_maker
from app.models import (
    EmailLog,
    EmailType,
    Enrollment,
    EnrollmentStatus,
    Evaluation,
    GmailAccount,
    Project,
    Subject,
    Submission,
    SubmissionStatus,
    User,
    UserRole,
)

SEED_PASSWORD = "Password123!"
SEED_PROFESSOR_EMAIL = "professor.seed@se-autograder.local"
SEED_STUDENT_EMAILS = [
    "student1.seed@se-autograder.local",
    "student2.seed@se-autograder.local",
    "student3.seed@se-autograder.local",
    "student4.seed@se-autograder.local",
    "student5.seed@se-autograder.local",
]

SEED_GMAIL_ACCOUNT_EMAIL = os.getenv(
    "SEED_GMAIL_ACCOUNT_EMAIL",
    "se.autograder.test@gmail.com",
)


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


def build_mock_credentials() -> str:
    """
    This is intentionally mock OAuth data.

    It lets the UI list and assign a GmailAccount, but it will not send real
    emails. For real email sending, connect a Gmail account through the Settings
    OAuth flow.
    """
    payload = {
        "token": "seed-mock-access-token",
        "refresh_token": "seed-mock-refresh-token",
        "token_uri": "https://oauth2.googleapis.com/token",
        "client_id": "seed-mock-client-id",
        "client_secret": "seed-mock-client-secret",
        "scopes": ["https://www.googleapis.com/auth/gmail.send"],
        "expiry": (utc_now() + timedelta(hours=1)).isoformat(),
        "id_token": None,
    }

    return encrypt_text(json.dumps(payload))


async def delete_existing_seed_data(db) -> None:
    seed_emails = [SEED_PROFESSOR_EMAIL, *SEED_STUDENT_EMAILS]

    result = await db.execute(select(User).where(User.email.in_(seed_emails)))
    users = result.scalars().all()

    for user in users:
        await db.delete(user)

    await db.commit()


def get_deliverable_content(deliverable_number: int, student_name: str, project_name: str) -> str:
    if deliverable_number == 1:
        return (
            f"{student_name} - Research + Motivation Letter for {project_name}.\n\n"
            "This deliverable analyses the target problem, identifies relevant stakeholders, "
            "summarizes early findings from academic and professional sources, and explains "
            "the personal motivation for addressing this project. The research highlights "
            "pain points, current alternatives, expected users, and the educational or practical "
            "value of the proposed solution."
        )

    if deliverable_number == 2:
        return (
            f"{student_name} - User Requirements List for {project_name}.\n\n"
            "REQ-001: The system shall allow users to create an account using an email and password.\n"
            "REQ-002: The system shall allow users to manage their own project data.\n"
            "REQ-003: The system shall provide clear feedback after every relevant action.\n"
            "REQ-004: The system shall preserve traceability between initial research and requirements."
        )

    if deliverable_number == 3:
        return (
            f"{student_name} - Target Group Questions for {project_name}.\n\n"
            "1. What is the most frustrating part of your current workflow?\n"
            "2. Which features would make the system useful on a weekly basis?\n"
            "3. What information would you expect the system to show first?\n"
            "4. Which edge cases or exceptions should the system support?\n"
            "5. What would make you stop using this solution?"
        )

    return (
        f"{student_name} - Updated Requirements List for {project_name}.\n\n"
        "This final version integrates the findings derived from the target group questions. "
        "The requirements have been reorganized, clarified, and expanded to include new user "
        "needs, edge cases, validation rules, and usability constraints. The document now "
        "reflects a more mature and coherent requirement specification."
    )


def get_criteria_breakdown(deliverable_number: int) -> dict:
    if deliverable_number == 1:
        return {
            "Research depth": 22,
            "Source quality": 17,
            "Motivation clarity": 26,
            "Writing structure": 20,
        }

    if deliverable_number == 2:
        return {
            "REQ format correctness": 18,
            "No ambiguity": 21,
            "Completeness": 25,
            "Traceability to D1": 20,
        }

    if deliverable_number == 3:
        return {
            "Question quality": 31,
            "Coverage of new use cases": 28,
            "Variety and depth": 24,
        }

    return {
        "Integration of D3 findings": 35,
        "Consistency with D1+D2": 26,
        "Document maturity": 27,
    }


def get_ai_score(deliverable_number: int, enrollment_index: int) -> int:
    base_scores = {
        1: 85,
        2: 84,
        3: 83,
        4: 88,
    }

    return max(0, min(100, base_scores[deliverable_number] - (enrollment_index % 4) * 3))


async def create_seed_data(db) -> None:
    professor = User(
        name="Seed Professor",
        email=SEED_PROFESSOR_EMAIL,
        hashed_password=hash_password(SEED_PASSWORD),
        role=UserRole.PROFESSOR,
        is_active=True,
    )

    db.add(professor)
    await db.flush()

    gmail_account = GmailAccount(
        account_email=SEED_GMAIL_ACCOUNT_EMAIL,
        credentials_json=build_mock_credentials(),
        professor_id=professor.id,
        subject_id=None,
        is_active=True,
    )

    db.add(gmail_account)
    await db.flush()

    students = []

    for index, email in enumerate(SEED_STUDENT_EMAILS, start=1):
        student = User(
            name=f"Seed Student {index}",
            email=email,
            hashed_password=hash_password(SEED_PASSWORD),
            role=UserRole.STUDENT,
            is_active=True,
        )

        db.add(student)
        students.append(student)

    await db.flush()

    subject_specs = [
        {
            "name": "Software Engineering I",
            "description": "Requirements engineering, elicitation and structured deliverables.",
            "projects": [
                {
                    "name": "Campus Booking Platform",
                    "topic": "Room reservation and academic space management",
                    "description": "A platform for booking university rooms and shared spaces.",
                },
                {
                    "name": "Student Mentoring App",
                    "topic": "Academic mentoring and student support",
                    "description": "A tool to connect students with mentors and track sessions.",
                },
            ],
        },
        {
            "name": "Software Engineering II",
            "description": "Project management, validation and quality control.",
            "projects": [
                {
                    "name": "Bug Tracking System",
                    "topic": "Issue tracking and software maintenance",
                    "description": "A bug reporting and prioritization platform.",
                },
                {
                    "name": "Sprint Planning Assistant",
                    "topic": "Agile planning and workload estimation",
                    "description": "A planning assistant for student software teams.",
                },
            ],
        },
        {
            "name": "AI for Software Engineering",
            "description": "AI-assisted workflows for software development.",
            "projects": [
                {
                    "name": "AI Feedback Assistant",
                    "topic": "Automated feedback for academic deliverables",
                    "description": "An AI assistant that evaluates structured coursework submissions.",
                },
                {
                    "name": "Requirements Classifier",
                    "topic": "NLP classification of software requirements",
                    "description": "A classifier for functional and non-functional requirements.",
                },
            ],
        },
    ]

    subjects = []
    projects = []

    for subject_spec in subject_specs:
        subject = Subject(
            name=subject_spec["name"],
            description=subject_spec["description"],
            professor_id=professor.id,
        )

        db.add(subject)
        await db.flush()

        # Make the same seed Gmail account the default for the first subject.
        if len(subjects) == 0:
            gmail_account.subject_id = subject.id

        subjects.append(subject)

        for project_spec in subject_spec["projects"]:
            project = Project(
                subject_id=subject.id,
                name=project_spec["name"],
                description=project_spec["description"],
                topic=project_spec["topic"],
                gmail_account_id=gmail_account.id,
            )

            db.add(project)
            projects.append(project)

    await db.flush()

    enrollment_index = 0

    for student_index, student in enumerate(students):
        for subject_index, subject in enumerate(subjects):
            subject_projects = [
                project for project in projects if project.subject_id == subject.id
            ]

            project = subject_projects[(student_index + subject_index) % len(subject_projects)]
            enrollment_index += 1

            pattern = enrollment_index % 5

            if pattern == 0:
                evaluated_count = 0
                pending_submission = False
                is_overdue = False
            elif pattern == 1:
                evaluated_count = 1
                pending_submission = False
                is_overdue = False
            elif pattern == 2:
                evaluated_count = 2
                pending_submission = False
                is_overdue = False
            elif pattern == 3:
                evaluated_count = 2
                pending_submission = True
                is_overdue = False
            else:
                evaluated_count = 3
                pending_submission = False
                is_overdue = True

            current_deliverable = min(4, evaluated_count + 1)

            enrollment = Enrollment(
                student_id=student.id,
                project_id=project.id,
                status=EnrollmentStatus.OVERDUE if is_overdue else EnrollmentStatus.ACTIVE,
                current_deliverable=current_deliverable,
                enrolled_at=utc_now() - timedelta(days=14 - enrollment_index),
            )

            db.add(enrollment)
            await db.flush()

            for deliverable_number in range(1, evaluated_count + 1):
                submitted_at = utc_now() - timedelta(days=10 - deliverable_number)

                submission = Submission(
                    enrollment_id=enrollment.id,
                    deliverable_number=deliverable_number,
                    content=get_deliverable_content(
                        deliverable_number=deliverable_number,
                        student_name=student.name,
                        project_name=project.name,
                    ),
                    status=SubmissionStatus.EVALUATED,
                    submitted_at=submitted_at,
                    deadline_at=submitted_at + timedelta(days=7),
                    email_sent=True,
                    email_error=None,
                )

                db.add(submission)
                await db.flush()

                evaluation = Evaluation(
                    submission_id=submission.id,
                    ai_score=get_ai_score(deliverable_number, enrollment_index),
                    criteria_breakdown=get_criteria_breakdown(deliverable_number),
                    feedback=(
                        "Seed AI feedback: the submission is generally well structured, "
                        "shows a reasonable understanding of the project context, and "
                        "contains useful material for the next deliverable. Further "
                        "improvement would come from adding more explicit traceability, "
                        "clearer justification of decisions, and more concrete examples."
                    ),
                    is_overridden=False,
                    override_score=None,
                    override_comment=None,
                    override_by_professor_id=None,
                    override_at=None,
                )

                db.add(evaluation)
                await db.flush()

                db.add(
                    EmailLog(
                        submission_id=submission.id,
                        email_type=EmailType.CONFIRMATION,
                        recipient_email=student.email,
                        gmail_account_used=gmail_account.account_email,
                        error_message=None,
                    )
                )

                db.add(
                    EmailLog(
                        submission_id=submission.id,
                        email_type=EmailType.PROFESSOR_NOTIFICATION,
                        recipient_email=professor.email,
                        gmail_account_used=gmail_account.account_email,
                        error_message=None,
                    )
                )

                failed_feedback = is_overdue and deliverable_number == evaluated_count

                db.add(
                    EmailLog(
                        submission_id=submission.id,
                        email_type=EmailType.FEEDBACK,
                        recipient_email=student.email,
                        gmail_account_used=gmail_account.account_email,
                        error_message=(
                            "Seed simulated email delivery failure."
                            if failed_feedback
                            else None
                        ),
                    )
                )

                if failed_feedback:
                    submission.email_sent = False
                    submission.email_error = "Seed simulated feedback email failure."

            if pending_submission:
                deliverable_number = evaluated_count + 1
                submitted_at = utc_now() - timedelta(days=1)

                submission = Submission(
                    enrollment_id=enrollment.id,
                    deliverable_number=deliverable_number,
                    content=get_deliverable_content(
                        deliverable_number=deliverable_number,
                        student_name=student.name,
                        project_name=project.name,
                    ),
                    status=SubmissionStatus.SUBMITTED,
                    submitted_at=submitted_at,
                    deadline_at=submitted_at + timedelta(days=7),
                    email_sent=True,
                    email_error=None,
                )

                db.add(submission)
                await db.flush()

                db.add(
                    EmailLog(
                        submission_id=submission.id,
                        email_type=EmailType.CONFIRMATION,
                        recipient_email=student.email,
                        gmail_account_used=gmail_account.account_email,
                        error_message=None,
                    )
                )

                db.add(
                    EmailLog(
                        submission_id=submission.id,
                        email_type=EmailType.PROFESSOR_NOTIFICATION,
                        recipient_email=professor.email,
                        gmail_account_used=gmail_account.account_email,
                        error_message=None,
                    )
                )

    await db.commit()


async def main() -> None:
    async with async_session_maker() as db:
        print("Deleting previous seed data...")
        await delete_existing_seed_data(db)

        print("Creating seed data...")
        await create_seed_data(db)

    print("")
    print("Seed completed successfully.")
    print("")
    print("Professor login:")
    print(f"  email:    {SEED_PROFESSOR_EMAIL}")
    print(f"  password: {SEED_PASSWORD}")
    print("")
    print("Student logins:")
    for email in SEED_STUDENT_EMAILS:
        print(f"  email:    {email}")
        print(f"  password: {SEED_PASSWORD}")
        print("")
    print("Important:")
    print("  The seeded GmailAccount uses mock OAuth credentials.")
    print("  It is useful for dashboard/settings UI data, but it cannot send real emails.")
    print("  Use the Settings OAuth flow to connect a real Gmail account for live sending.")


if __name__ == "__main__":
    asyncio.run(main())