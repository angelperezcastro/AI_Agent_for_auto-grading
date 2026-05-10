import asyncio
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path

from sqlalchemy import select

sys.path.append(str(Path(__file__).resolve().parents[1]))

try:
    from app.database import AsyncSessionLocal
except ImportError:
    from app.database import async_session_maker as AsyncSessionLocal

from app.core.security import create_access_token
from app.models import Enrollment, Evaluation, Project, Subject, Submission, User


BASE_URL = "http://127.0.0.1:8000"
OWNER_PROFESSOR_EMAIL = "angelpeka44@gmail.com"


def make_token(user: User) -> str:
    """
    This project expects JWT 'sub' to contain the numeric user ID.

    app/deps.py reads the JWT subject and does:
        int(user_id)

    Therefore we must pass str(user.id) to create_access_token().
    """
    return create_access_token(str(user.id))


def api_request(
    method: str,
    url: str,
    token: str | None = None,
    payload: dict | None = None,
):
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
        method=method,
    )

    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read().decode("utf-8")
            return response.status, raw

    except urllib.error.HTTPError as exc:
        raw = exc.read().decode("utf-8")
        return exc.code, raw

    except Exception as exc:
        return 0, repr(exc)


async def main():
    async with AsyncSessionLocal() as db:
        owner_professor_result = await db.execute(
            select(User).where(User.email == OWNER_PROFESSOR_EMAIL)
        )
        owner_professor = owner_professor_result.scalars().first()

        if not owner_professor:
            raise RuntimeError(f"Owner professor not found: {OWNER_PROFESSOR_EMAIL}")

        other_professor_result = await db.execute(
            select(User)
            .where(User.role == "professor")
            .where(User.id != owner_professor.id)
            .order_by(User.id.asc())
        )
        other_professor = other_professor_result.scalars().first()

        if not other_professor:
            raise RuntimeError("Other professor not found.")

        students_result = await db.execute(
            select(User)
            .where(User.role == "student")
            .order_by(User.id.asc())
        )
        students = students_result.scalars().all()

        if len(students) < 2:
            raise RuntimeError(
                "Need at least 2 students. Run: "
                "python scripts/week6_day2_prepare_security_audit_data.py"
            )

        evaluation_result = await db.execute(
            select(Evaluation, Submission, Enrollment, Project, Subject)
            .join(Submission, Evaluation.submission_id == Submission.id)
            .join(Enrollment, Submission.enrollment_id == Enrollment.id)
            .join(Project, Enrollment.project_id == Project.id)
            .join(Subject, Project.subject_id == Subject.id)
            .where(Subject.professor_id == owner_professor.id)
            .order_by(Evaluation.id.desc())
        )
        evaluation_row = evaluation_result.first()

        if not evaluation_row:
            raise RuntimeError(
                "No evaluation found for owner professor. Submit/evaluate at least one deliverable first."
            )

        evaluation, submission, enrollment, project, subject = evaluation_row

        student_a = students[0]
        student_b = students[1]

        student_b_enrollment_result = await db.execute(
            select(Enrollment)
            .where(Enrollment.student_id == student_b.id)
            .order_by(Enrollment.id.asc())
        )
        student_b_enrollment = student_b_enrollment_result.scalars().first()

        if not student_b_enrollment:
            raise RuntimeError("Student B has no enrollment.")

        student_a_token = make_token(student_a)
        owner_token = make_token(owner_professor)
        other_professor_token = make_token(other_professor)

        tests = [
            {
                "name": "Student -> GET /settings/gmail-accounts",
                "method": "GET",
                "url": f"{BASE_URL}/settings/gmail-accounts",
                "token": student_a_token,
                "payload": None,
            },
            {
                "name": "Owner professor -> GET /settings/gmail-accounts",
                "method": "GET",
                "url": f"{BASE_URL}/settings/gmail-accounts",
                "token": owner_token,
                "payload": None,
            },
            {
                "name": "Student -> GET /projects/{project_id}/enrollments",
                "method": "GET",
                "url": f"{BASE_URL}/projects/{project.id}/enrollments",
                "token": student_a_token,
                "payload": None,
            },
            {
                "name": "Other professor -> PATCH /evaluations/{evaluation_id}/override",
                "method": "PATCH",
                "url": f"{BASE_URL}/evaluations/{evaluation.id}/override",
                "token": other_professor_token,
                "payload": {
                    "override_score": 77,
                    "override_comment": "Week 6 security audit. This must be rejected.",
                },
            },
            {
                "name": "Student A -> GET Student B submissions",
                "method": "GET",
                "url": f"{BASE_URL}/enrollments/{student_b_enrollment.id}/submissions",
                "token": student_a_token,
                "payload": None,
            },
        ]

        print("\nWEEK 6 DAY 2 — DEBUG SECURITY ENDPOINTS")
        print("=" * 100)
        print(f"Owner professor:       {owner_professor.id} | {owner_professor.email}")
        print(f"Other professor:       {other_professor.id} | {other_professor.email}")
        print(f"Student A:             {student_a.id} | {student_a.email}")
        print(f"Student B:             {student_b.id} | {student_b.email}")
        print(f"Student B enrollment:  {student_b_enrollment.id}")
        print(f"Project tested:        {project.id} | {project.name}")
        print(f"Evaluation tested:     {evaluation.id}")
        print("JWT subject strategy:  numeric user ID")
        print("=" * 100)

        for test in tests:
            status, body = api_request(
                method=test["method"],
                url=test["url"],
                token=test["token"],
                payload=test["payload"],
            )

            print(f"\n{test['name']}")
            print("-" * 100)
            print(f"URL:    {test['url']}")
            print(f"Status: {status}")
            print("Body:")
            print(body[:3000] if body else "<empty>")

        print("\n" + "=" * 100)
        print("If any endpoint returns 500, check the uvicorn terminal for the Python traceback.")
        print("=" * 100)


if __name__ == "__main__":
    asyncio.run(main())