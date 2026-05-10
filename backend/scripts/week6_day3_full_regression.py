import argparse
import asyncio
import json
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

try:
    from app.database import AsyncSessionLocal
except ImportError:
    from app.database import async_session_maker as AsyncSessionLocal

from app.core.security import create_access_token, hash_password
from app.models import (
    EmailLog,
    Enrollment,
    Evaluation,
    GmailAccount,
    Project,
    Subject,
    Submission,
    User,
)


DELIVERABLE_CONTENT = {
    1: """
Research + Motivation Letter

This project explores the need for a lightweight academic task tracking platform for university students and professors. The motivation comes from repeated coordination problems in software engineering courses: students often lose visibility over deadlines, professors need structured progress data, and feedback loops become slow when deliverables are handled manually.

The research indicates that learning platforms are effective when they provide immediate feedback, clear milestones, and transparent progress indicators. Existing tools such as Moodle, Trello, and GitHub Projects partially solve the problem, but they are either too general, too administrative, or not focused on requirements engineering deliverables.

The personal motivation for this project is to improve the learning experience in software engineering courses by combining structured workflows, automatic feedback, and professor supervision. The expected outcome is a system that reduces manual overhead while preserving academic control.
""",
    2: """
User Requirements List

REQ-001: The system shall allow students to register and authenticate using an email and password.
REQ-002: The system shall allow professors to create and manage academic subjects.
REQ-003: The system shall allow professors to create projects inside their own subjects.
REQ-004: The system shall allow students to enroll in one active project per subject.
REQ-005: The system shall allow students to submit four sequential deliverables.
REQ-006: The system shall prevent students from submitting deliverable N+1 until deliverable N has been evaluated.
REQ-007: The system shall automatically evaluate each submitted deliverable using an AI agent.
REQ-008: The system shall send confirmation and feedback emails using the Gmail account configured for the project or subject.
REQ-009: The system shall allow professors to override AI-generated scores.
REQ-010: The system shall keep an audit log of every email attempt.
""",
    3: """
Target Group Interview Questions

1. What difficulties do you usually face when tracking software engineering coursework deadlines?
2. How do you currently know whether a previous deliverable has been accepted or evaluated?
3. What type of feedback helps you improve a requirements document the most?
4. Would an automatic score be useful if the professor can still override it?
5. What information should appear in an email notification after submitting a deliverable?
6. How would you expect the platform to behave if an email cannot be delivered?
7. What progress indicators would help you understand your current status in a project?
8. What concerns would you have about an AI agent evaluating academic work?
9. What should professors be able to see in a progress dashboard?
10. How should the system handle multiple subjects with different Gmail sender accounts?
""",
    4: """
Updated Requirements List

REQ-001: The system shall allow students and professors to authenticate with role-based access.
REQ-002: The system shall allow professors to create subjects and projects.
REQ-003: The system shall enforce one active project per student per subject.
REQ-004: The system shall enforce sequential deliverable submission.
REQ-005: The system shall automatically evaluate each deliverable and store a score, criteria breakdown, and feedback.
REQ-006: The system shall display clear progress indicators to both students and professors.
REQ-007: The system shall send confirmation, professor notification, AI feedback, and override feedback emails.
REQ-008: The system shall select the Gmail sender account through a deterministic fallback chain: project account, subject account, professor account, then clear failure.
REQ-009: The system shall show non-technical error messages when email delivery fails.
REQ-010: The system shall allow professors to override AI scores while preserving original AI feedback.
REQ-011: The system shall provide email audit logs for transparency and debugging.
REQ-012: The system shall prevent users from accessing resources outside their role or ownership scope.
""",
}


def enum_value(value: Any) -> str:
    if hasattr(value, "value"):
        return value.value
    return str(value)


def set_if_exists(obj, field_name: str, value: Any):
    if hasattr(obj, field_name):
        setattr(obj, field_name, value)


def make_token(user: User) -> str:
    return create_access_token(str(user.id))


def api_request(
    method: str,
    url: str,
    token: str | None = None,
    payload: dict | None = None,
) -> tuple[int, Any]:
    headers = {"Accept": "application/json"}

    body = None

    if payload is not None:
        body = json.dumps(payload).encode("utf-8")
        headers["Content-Type"] = "application/json"

    if token:
        headers["Authorization"] = f"Bearer {token}"

    request = urllib.request.Request(
        url=url,
        data=body,
        headers=headers,
        method=method.upper(),
    )

    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8")

            if raw:
                try:
                    return response.status, json.loads(raw)
                except json.JSONDecodeError:
                    return response.status, raw

            return response.status, None

    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")

        if raw:
            try:
                return exc.code, json.loads(raw)
            except json.JSONDecodeError:
                return exc.code, raw

        return exc.code, None

    except urllib.error.URLError as exc:
        raise RuntimeError(
            "Could not connect to backend API. Start backend with: "
            "uvicorn app.main:app --reload"
        ) from exc


def print_step(message: str):
    print(f"\n▶ {message}")
    print("-" * 100)


def print_ok(message: str):
    print(f"[OK] {message}")


def print_fail(message: str):
    print(f"[FAIL] {message}")


async def get_user_by_email(db, email: str) -> User | None:
    result = await db.execute(select(User).where(User.email == email))
    return result.scalars().first()


async def get_or_create_student(db, email: str, password: str) -> User:
    existing = await get_user_by_email(db, email)

    if existing:
        return existing

    user = User()
    user.email = email
    user.role = "student"

    if hasattr(user, "hashed_password"):
        user.hashed_password = hash_password(password)
    elif hasattr(user, "password_hash"):
        user.password_hash = hash_password(password)
    else:
        raise RuntimeError("User model has no hashed_password/password_hash field.")

    set_if_exists(user, "full_name", "Week 6 Day 3 Regression Student")
    set_if_exists(user, "name", "Week 6 Day 3 Regression Student")
    set_if_exists(user, "is_active", True)

    db.add(user)
    await db.flush()

    return user


async def get_or_create_subject(db, professor_id: int, run_id: str) -> Subject:
    subject_name = f"Week 6 Day 3 Regression Subject {run_id}"

    result = await db.execute(
        select(Subject)
        .where(Subject.professor_id == professor_id)
        .where(Subject.name == subject_name)
    )
    existing = result.scalars().first()

    if existing:
        return existing

    subject = Subject()
    subject.name = subject_name
    subject.professor_id = professor_id

    set_if_exists(
        subject,
        "description",
        "Automated Week 6 Day 3 full regression subject.",
    )

    db.add(subject)
    await db.flush()

    return subject


async def get_or_create_project(
    db,
    subject_id: int,
    gmail_account_id: int,
    run_id: str,
) -> Project:
    project_name = f"Week 6 Day 3 Regression Project {run_id}"

    result = await db.execute(
        select(Project)
        .where(Project.subject_id == subject_id)
        .where(Project.name == project_name)
    )
    existing = result.scalars().first()

    if existing:
        existing.gmail_account_id = gmail_account_id
        await db.flush()
        return existing

    project = Project()
    project.subject_id = subject_id
    project.name = project_name
    project.description = (
        "Automated full regression project for Week 6 Day 3."
    )
    project.topic = (
        "Automated regression testing of AI auto-grading, Gmail delivery, "
        "EmailLog auditing, and professor override workflow."
    )
    project.gmail_account_id = gmail_account_id

    db.add(project)
    await db.flush()

    return project


async def get_sample_enrollment_status(db):
    result = await db.execute(select(Enrollment).limit(1))
    sample = result.scalars().first()

    if sample and hasattr(sample, "status"):
        return sample.status

    return "active"


async def create_enrollment(db, student_id: int, project_id: int) -> Enrollment:
    enrollment = Enrollment()
    enrollment.student_id = student_id
    enrollment.project_id = project_id

    if hasattr(enrollment, "status"):
        enrollment.status = await get_sample_enrollment_status(db)

    if hasattr(enrollment, "current_deliverable"):
        enrollment.current_deliverable = 1

    db.add(enrollment)
    await db.flush()

    return enrollment


async def find_submission(db, submission_id: int) -> Submission:
    submission = await db.get(Submission, submission_id)

    if not submission:
        raise RuntimeError(f"Submission {submission_id} not found.")

    return submission


async def wait_for_evaluation(
    db_factory,
    submission_id: int,
    timeout_seconds: int,
    poll_seconds: int,
) -> Evaluation:
    deadline = time.time() + timeout_seconds

    while time.time() < deadline:
        async with db_factory() as db:
            result = await db.execute(
                select(Evaluation).where(Evaluation.submission_id == submission_id)
            )
            evaluation = result.scalars().first()

            if evaluation:
                return evaluation

        time.sleep(poll_seconds)

    raise RuntimeError(
        f"Timed out waiting for Evaluation for submission_id={submission_id}."
    )


async def get_email_logs_for_submission(db, submission_id: int):
    result = await db.execute(
        select(EmailLog)
        .where(EmailLog.submission_id == submission_id)
        .order_by(EmailLog.id.asc())
    )
    return result.scalars().all()


async def assert_email_logs(
    db,
    submission_id: int,
    expected_sender: str,
    required_types: set[str],
):
    logs = await get_email_logs_for_submission(db, submission_id)

    found_types = set()
    failures = []

    for log in logs:
        email_type = enum_value(getattr(log, "email_type", "unknown"))
        sender = (
            getattr(log, "gmail_account_used", None)
            or getattr(log, "gmail_account_email", None)
            or getattr(log, "sender_email", None)
        )
        error_message = getattr(log, "error_message", None)

        if email_type in required_types:
            found_types.add(email_type)

            if sender != expected_sender:
                failures.append(
                    f"{email_type}: expected sender {expected_sender}, got {sender}"
                )

            if error_message:
                failures.append(
                    f"{email_type}: error_message={error_message}"
                )

    missing = required_types - found_types

    if missing:
        failures.append(f"missing email types: {sorted(missing)}")

    if failures:
        raise RuntimeError(
            f"EmailLog verification failed for submission {submission_id}: "
            + " | ".join(failures)
        )

    return logs


def extract_submission_id(response: Any) -> int:
    if not isinstance(response, dict):
        raise RuntimeError(f"Submission response is not a JSON object: {response}")

    submission_id = response.get("id") or response.get("submission_id")

    if not submission_id:
        raise RuntimeError(f"Could not extract submission id from response: {response}")

    return int(submission_id)


async def main():
    parser = argparse.ArgumentParser(
        description="Week 6 Day 3 automated full regression test."
    )

    parser.add_argument("--base-url", default="http://127.0.0.1:8000")
    parser.add_argument("--professor-email", default="angelpeka44@gmail.com")
    parser.add_argument("--gmail-account-email", default="angelpeka44@gmail.com")
    parser.add_argument(
        "--student-email",
        default=None,
        help="Optional real/alias student email. If omitted, a local regression email is used.",
    )
    parser.add_argument("--student-password", default="Password123!")
    parser.add_argument("--evaluation-timeout", type=int, default=180)
    parser.add_argument("--poll-seconds", type=int, default=5)

    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")

    run_id = datetime.now(timezone.utc).strftime("%Y%m%d%H%M%S")
    student_email = (
        args.student_email
        or f"week6.day3.regression.{run_id}@se-autograder.local"
    )

    print("\nWEEK 6 DAY 3 — FULL AUTOMATED REGRESSION")
    print("=" * 100)
    print(f"Backend URL:      {base_url}")
    print(f"Professor email:  {args.professor_email}")
    print(f"Gmail account:    {args.gmail_account_email}")
    print(f"Student email:    {student_email}")
    print(f"Run ID:           {run_id}")
    print("=" * 100)

    async with AsyncSessionLocal() as db:
        professor = await get_user_by_email(db, args.professor_email)

        if not professor:
            raise RuntimeError(f"Professor not found: {args.professor_email}")

        gmail_result = await db.execute(
            select(GmailAccount)
            .where(GmailAccount.account_email == args.gmail_account_email)
            .where(GmailAccount.professor_id == professor.id)
            .where(GmailAccount.is_active.is_(True))
            .order_by(GmailAccount.id.desc())
        )
        gmail_account = gmail_result.scalars().first()

        if not gmail_account:
            raise RuntimeError(
                f"Active GmailAccount not found for {args.gmail_account_email} "
                f"and professor {args.professor_email}."
            )

        student = await get_or_create_student(
            db=db,
            email=student_email,
            password=args.student_password,
        )

        subject = await get_or_create_subject(
            db=db,
            professor_id=professor.id,
            run_id=run_id,
        )

        project = await get_or_create_project(
            db=db,
            subject_id=subject.id,
            gmail_account_id=gmail_account.id,
            run_id=run_id,
        )

        enrollment = await create_enrollment(
            db=db,
            student_id=student.id,
            project_id=project.id,
        )

        await db.commit()
        await db.refresh(professor)
        await db.refresh(student)
        await db.refresh(subject)
        await db.refresh(project)
        await db.refresh(enrollment)

        print_ok(f"Professor ready: {professor.id} | {professor.email}")
        print_ok(f"Gmail account assigned to project: {gmail_account.account_email}")
        print_ok(f"Subject created: {subject.id} | {subject.name}")
        print_ok(f"Project created: {project.id} | {project.name}")
        print_ok(f"Student ready: {student.id} | {student.email}")
        print_ok(f"Enrollment created: {enrollment.id}")

        professor_token = make_token(professor)
        student_token = make_token(student)

    submission_ids = {}
    evaluation_ids = {}

    for deliverable_number in [1, 2, 3, 4]:
        print_step(f"Submitting Deliverable {deliverable_number}")

        status_code, response = api_request(
            method="POST",
            url=f"{base_url}/submissions",
            token=student_token,
            payload={
                "enrollment_id": enrollment.id,
                "deliverable_number": deliverable_number,
                "content": DELIVERABLE_CONTENT[deliverable_number],
            },
        )

        if status_code not in {200, 201}:
            raise RuntimeError(
                f"Deliverable {deliverable_number} submission failed. "
                f"status={status_code}, response={response}"
            )

        submission_id = extract_submission_id(response)
        submission_ids[deliverable_number] = submission_id

        print_ok(
            f"Deliverable {deliverable_number} submitted. submission_id={submission_id}"
        )

        print_step(f"Waiting for AI evaluation of Deliverable {deliverable_number}")

        evaluation = await wait_for_evaluation(
            db_factory=AsyncSessionLocal,
            submission_id=submission_id,
            timeout_seconds=args.evaluation_timeout,
            poll_seconds=args.poll_seconds,
        )

        evaluation_ids[deliverable_number] = evaluation.id

        print_ok(
            f"Evaluation ready. evaluation_id={evaluation.id}, ai_score={evaluation.ai_score}"
        )

        async with AsyncSessionLocal() as db:
            await assert_email_logs(
                db=db,
                submission_id=submission_id,
                expected_sender=args.gmail_account_email,
                required_types={
                    "confirmation",
                    "professor_notification",
                    "feedback",
                },
            )

        print_ok(
            f"EmailLog verified for Deliverable {deliverable_number}: "
            "confirmation, professor_notification, feedback"
        )

    print_step("Professor override for Deliverable 2")

    d2_evaluation_id = evaluation_ids[2]

    status_code, response = api_request(
        method="PATCH",
        url=f"{base_url}/evaluations/{d2_evaluation_id}/override",
        token=professor_token,
        payload={
            "override_score": 91,
            "override_comment": (
                "Week 6 Day 3 full regression override. "
                "This verifies that professor override feedback emails are sent "
                "through the correctly resolved Gmail account."
            ),
        },
    )

    if status_code not in {200, 201}:
        raise RuntimeError(
            f"Override failed. status={status_code}, response={response}"
        )

    print_ok(f"Override request accepted for evaluation_id={d2_evaluation_id}")

    print_step("Waiting for override_feedback EmailLog")

    deadline = time.time() + 90

    while time.time() < deadline:
        async with AsyncSessionLocal() as db:
            logs = await get_email_logs_for_submission(
                db=db,
                submission_id=submission_ids[2],
            )

            override_logs = [
                log
                for log in logs
                if enum_value(getattr(log, "email_type", "")) == "override_feedback"
            ]

            if override_logs:
                await assert_email_logs(
                    db=db,
                    submission_id=submission_ids[2],
                    expected_sender=args.gmail_account_email,
                    required_types={"override_feedback"},
                )
                print_ok("override_feedback EmailLog verified.")
                break

        time.sleep(3)
    else:
        raise RuntimeError("Timed out waiting for override_feedback EmailLog.")

    print("\n" + "=" * 100)
    print("FULL REGRESSION PASSED")
    print("=" * 100)
    print(f"Subject ID:      {subject.id}")
    print(f"Project ID:      {project.id}")
    print(f"Enrollment ID:   {enrollment.id}")
    print(f"Submissions:     {submission_ids}")
    print(f"Evaluations:     {evaluation_ids}")
    print("Emails verified: confirmation, professor_notification, feedback, override_feedback")
    print("Journey verified: professor setup -> student D1-D4 -> AI feedback -> professor override")
    print("=" * 100 + "\n")


if __name__ == "__main__":
    asyncio.run(main())