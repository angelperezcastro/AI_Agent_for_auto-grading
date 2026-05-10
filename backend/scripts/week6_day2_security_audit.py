import argparse
import asyncio
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

try:
    from app.database import AsyncSessionLocal
except ImportError:
    from app.database import async_session_maker as AsyncSessionLocal

from app.core.crypto import decrypt_text
from app.core.security import create_access_token
from app.models import (
    Enrollment,
    Evaluation,
    GmailAccount,
    Project,
    Subject,
    Submission,
    User,
)


SENSITIVE_KEYS = {
    "credentials_json",
    "credentials",
    "refresh_token",
    "access_token",
    "client_secret",
    "id_token",
    "token",
    "token_uri",
    "expiry",
    "token_expiry",
}


def print_check(name: str, passed: bool, details: str = ""):
    status = "PASS" if passed else "FAIL"
    print(f"[{status}] {name}")

    if details:
        print(f"       {details}")


def make_token(user: User) -> str:
    """
    This project expects JWT 'sub' to contain the numeric user ID.

    app/deps.py reads the JWT subject and does:
        int(user_id)

    Therefore we must pass str(user.id) to create_access_token().
    Do NOT pass {"sub": ...}.
    Do NOT pass user.email.
    """
    return create_access_token(str(user.id))


def api_request(
    method: str,
    url: str,
    token: str | None = None,
    payload: dict | None = None,
) -> tuple[int, Any]:
    headers = {
        "Accept": "application/json",
    }

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
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8")

            if raw:
                try:
                    parsed = json.loads(raw)
                except json.JSONDecodeError:
                    parsed = raw
            else:
                parsed = None

            return response.status, parsed

    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")

        if raw:
            try:
                parsed = json.loads(raw)
            except json.JSONDecodeError:
                parsed = raw
        else:
            parsed = None

        return exc.code, parsed

    except urllib.error.URLError as exc:
        raise RuntimeError(
            f"Could not connect to backend API at {url}. "
            "Start the backend with: uvicorn app.main:app --reload"
        ) from exc


def contains_sensitive_key(value: Any) -> list[str]:
    found = []

    if isinstance(value, dict):
        for key, nested in value.items():
            normalized = str(key).lower()

            if normalized in SENSITIVE_KEYS:
                found.append(str(key))

            found.extend(contains_sensitive_key(nested))

    elif isinstance(value, list):
        for item in value:
            found.extend(contains_sensitive_key(item))

    return found


async def find_owner_professor(db, professor_email: str | None):
    query = select(User)

    if professor_email:
        query = query.where(User.email == professor_email)

    query = query.where(User.role == "professor")

    result = await db.execute(query.order_by(User.id.asc()))
    return result.scalars().first()


async def find_other_professor(db, owner_professor: User):
    result = await db.execute(
        select(User)
        .where(User.role == "professor")
        .where(User.id != owner_professor.id)
        .order_by(User.id.asc())
    )
    return result.scalars().first()


async def find_students_with_enrollments(db, owner_professor: User):
    stmt = (
        select(User, Enrollment, Project, Subject)
        .join(Enrollment, Enrollment.student_id == User.id)
        .join(Project, Enrollment.project_id == Project.id)
        .join(Subject, Project.subject_id == Subject.id)
        .where(User.role == "student")
        .where(Subject.professor_id == owner_professor.id)
        .order_by(User.id.asc())
    )

    result = await db.execute(stmt)
    rows = result.all()

    unique = {}

    for user, enrollment, project, subject in rows:
        if user.id not in unique:
            unique[user.id] = {
                "user": user,
                "enrollment": enrollment,
                "project": project,
                "subject": subject,
            }

    return list(unique.values())


async def find_evaluation_owned_by_professor(db, owner_professor: User):
    stmt = (
        select(Evaluation, Submission, Enrollment, Project, Subject)
        .join(Submission, Evaluation.submission_id == Submission.id)
        .join(Enrollment, Submission.enrollment_id == Enrollment.id)
        .join(Project, Enrollment.project_id == Project.id)
        .join(Subject, Project.subject_id == Subject.id)
        .where(Subject.professor_id == owner_professor.id)
        .order_by(Evaluation.id.desc())
    )

    result = await db.execute(stmt)
    return result.first()


async def check_credentials_encrypted(db, professor_id: int) -> tuple[bool, str]:
    result = await db.execute(
        select(GmailAccount)
        .where(GmailAccount.professor_id == professor_id)
        .order_by(GmailAccount.id.asc())
    )

    accounts = result.scalars().all()

    if not accounts:
        return False, "No GmailAccount rows found for the owner professor."

    problems = []

    for account in accounts:
        raw = account.credentials_json or ""

        if raw.strip().startswith("{"):
            problems.append(
                f"{account.account_email}: credentials_json looks like plaintext JSON."
            )
            continue

        plaintext_markers = [
            "refresh_token",
            "access_token",
            "client_secret",
            "ya29.",
            "1//",
        ]

        for marker in plaintext_markers:
            if marker in raw:
                problems.append(
                    f"{account.account_email}: encrypted payload contains plaintext marker {marker}."
                )

        try:
            decrypted = decrypt_text(raw)
            parsed = json.loads(decrypted)

            if not isinstance(parsed, dict):
                problems.append(
                    f"{account.account_email}: decrypted credentials are not a JSON object."
                )

        except Exception as exc:
            problems.append(
                f"{account.account_email}: credentials could not be decrypted: {exc}"
            )

    if problems:
        return False, " | ".join(problems)

    return True, f"{len(accounts)} GmailAccount credential payload(s) are encrypted and decryptable."


def fail_on_500(check_name: str, status_code: int, response: Any, failures: list[str]) -> bool:
    """
    Returns True if status_code is 500 and records it as an internal backend crash.

    A 500 is not a valid security result. It means the endpoint crashed.
    """
    if status_code == 500:
        print_check(
            check_name,
            False,
            f"status=500 INTERNAL SERVER ERROR, response={response}",
        )
        failures.append(f"{check_name}: endpoint returned 500.")
        return True

    return False


async def main():
    parser = argparse.ArgumentParser(
        description="Week 6 Day 2 backend security and permission audit."
    )

    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:8000",
        help="Backend API base URL.",
    )

    parser.add_argument(
        "--professor-email",
        default="angelpeka44@gmail.com",
        help="Owner professor to audit.",
    )

    args = parser.parse_args()
    base_url = args.base_url.rstrip("/")

    async with AsyncSessionLocal() as db:
        owner_professor = await find_owner_professor(
            db=db,
            professor_email=args.professor_email,
        )

        if not owner_professor:
            raise RuntimeError(
                f"Owner professor not found: {args.professor_email}"
            )

        other_professor = await find_other_professor(
            db=db,
            owner_professor=owner_professor,
        )

        if not other_professor:
            raise RuntimeError(
                "No second professor found. Create or seed another professor first."
            )

        student_entries = await find_students_with_enrollments(
            db=db,
            owner_professor=owner_professor,
        )

        if len(student_entries) < 2:
            raise RuntimeError(
                "Need at least 2 different students enrolled in projects owned by "
                f"{owner_professor.email} to test cross-student access. "
                "Run: python scripts/week6_day2_prepare_security_audit_data.py"
            )

        student_a = student_entries[0]["user"]
        student_b = student_entries[1]["user"]
        student_b_enrollment = student_entries[1]["enrollment"]

        evaluation_row = await find_evaluation_owned_by_professor(
            db=db,
            owner_professor=owner_professor,
        )

        if not evaluation_row:
            raise RuntimeError(
                f"No Evaluation found for projects owned by {owner_professor.email}. "
                "Submit a deliverable and wait for AI evaluation first."
            )

        evaluation, submission, enrollment, project, subject = evaluation_row

        print("\nWEEK 6 DAY 2 — BACKEND SECURITY AUDIT")
        print("=" * 100)
        print(f"Backend URL:       {base_url}")
        print(f"Owner professor:   {owner_professor.id} | {owner_professor.email}")
        print(f"Other professor:   {other_professor.id} | {other_professor.email}")
        print(f"Student A:         {student_a.id} | {student_a.email}")
        print(f"Student B:         {student_b.id} | {student_b.email}")
        print(f"Student B enroll:  {student_b_enrollment.id}")
        print(f"Evaluation tested: {evaluation.id}")
        print(f"Project tested:    {project.id} | {project.name}")
        print("=" * 100)

        failures = []

        owner_token = make_token(owner_professor)
        other_professor_token = make_token(other_professor)
        student_a_token = make_token(student_a)

        print("JWT subject strategy: numeric user ID")
        print("=" * 100)

        # 1. Students cannot access professor Gmail settings.
        check_name = "Student cannot access /settings/gmail-accounts"
        status_code, response = api_request(
            method="GET",
            url=f"{base_url}/settings/gmail-accounts",
            token=student_a_token,
        )

        if not fail_on_500(check_name, status_code, response, failures):
            passed = status_code in {401, 403}
            print_check(
                check_name,
                passed,
                f"status={status_code}",
            )

            if not passed:
                failures.append(
                    f"{check_name}: expected 401/403, got {status_code}."
                )

        # 2. Students cannot access professor project enrollments.
        check_name = "Student cannot access /projects/{project_id}/enrollments"
        status_code, response = api_request(
            method="GET",
            url=f"{base_url}/projects/{project.id}/enrollments",
            token=student_a_token,
        )

        if not fail_on_500(check_name, status_code, response, failures):
            passed = status_code in {401, 403}
            print_check(
                check_name,
                passed,
                f"status={status_code}, project_id={project.id}",
            )

            if not passed:
                failures.append(
                    f"{check_name}: expected 401/403, got {status_code}."
                )

        # 3. Other professor cannot override an evaluation outside their projects.
        check_name = "Other professor cannot override evaluation outside their projects"
        status_code, response = api_request(
            method="PATCH",
            url=f"{base_url}/evaluations/{evaluation.id}/override",
            token=other_professor_token,
            payload={
                "override_score": 77,
                "override_comment": "Week 6 security audit: this override must be rejected.",
            },
        )

        if not fail_on_500(check_name, status_code, response, failures):
            passed = status_code in {401, 403, 404}
            print_check(
                check_name,
                passed,
                f"status={status_code}, evaluation_id={evaluation.id}",
            )

            if not passed:
                failures.append(
                    f"{check_name}: expected 401/403/404, got {status_code}."
                )

        # 4. Student A cannot view Student B submissions.
        check_name = "Student cannot view another student's submissions"
        status_code, response = api_request(
            method="GET",
            url=f"{base_url}/enrollments/{student_b_enrollment.id}/submissions",
            token=student_a_token,
        )

        if not fail_on_500(check_name, status_code, response, failures):
            passed = status_code in {401, 403, 404}
            print_check(
                check_name,
                passed,
                f"status={status_code}, other_enrollment_id={student_b_enrollment.id}",
            )

            if not passed:
                failures.append(
                    f"{check_name}: expected 401/403/404, got {status_code}."
                )

        # 5. Gmail settings response must not expose credentials or tokens.
        check_name = "Gmail settings API does not return credentials/tokens"
        status_code, response = api_request(
            method="GET",
            url=f"{base_url}/settings/gmail-accounts",
            token=owner_token,
        )

        if not fail_on_500(check_name, status_code, response, failures):
            sensitive_keys = contains_sensitive_key(response)
            passed = status_code == 200 and not sensitive_keys

            print_check(
                check_name,
                passed,
                f"status={status_code}, sensitive_keys={sensitive_keys}",
            )

            if not passed:
                failures.append(
                    f"{check_name}: expected status 200 and no sensitive keys, "
                    f"got status={status_code}, sensitive_keys={sensitive_keys}."
                )

        # 6. Gmail credentials are encrypted in DB.
        encrypted_ok, encrypted_details = await check_credentials_encrypted(
            db=db,
            professor_id=owner_professor.id,
        )

        print_check(
            "Gmail credentials are encrypted at rest",
            encrypted_ok,
            encrypted_details,
        )

        if not encrypted_ok:
            failures.append("Gmail credentials are not correctly encrypted at rest.")

        print("=" * 100)

        if failures:
            print("\nSECURITY AUDIT FAILED")
            for failure in failures:
                print(f"- {failure}")

            raise SystemExit(1)

        print("\nSECURITY AUDIT PASSED")
        print("All checked backend permission and credential rules passed.\n")


if __name__ == "__main__":
    asyncio.run(main())