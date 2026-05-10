from datetime import datetime, timezone
from html import escape

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import async_session_maker, get_db
from app.deps import get_current_user
from app.models import (
    EmailLog,
    Enrollment,
    Evaluation,
    Project,
    Subject,
    Submission,
    User,
)
from app.schemas.core import EvaluationOverrideRequest, EvaluationRead
from app.services.email_resolver import resolve_sender_account
from app.services.email_service import send_email

router = APIRouter(tags=["Evaluations"])


async def verify_professor_owns_evaluation(
    evaluation: Evaluation,
    professor: User,
    db: AsyncSession,
) -> tuple[Submission, Enrollment, Project, Subject]:
    submission = await db.get(Submission, evaluation.submission_id)

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    enrollment = await db.get(Enrollment, submission.enrollment_id)

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found.")

    project = await db.get(Project, enrollment.project_id)

    if not project:
        raise HTTPException(status_code=404, detail="Project not found.")

    subject = await db.get(Subject, project.subject_id)

    if not subject:
        raise HTTPException(status_code=404, detail="Subject not found.")

    if subject.professor_id != professor.id:
        raise HTTPException(status_code=403, detail="Not your evaluation.")

    return submission, enrollment, project, subject


def build_override_feedback_email_html(
    student_name: str,
    project_name: str,
    subject_name: str,
    deliverable_number: int,
    ai_score: int | None,
    override_score: int,
    override_comment: str,
) -> str:
    safe_student_name = escape(student_name or "student")
    safe_project_name = escape(project_name or "Project")
    safe_subject_name = escape(subject_name or "Subject")
    safe_override_comment = escape(override_comment or "")
    ai_score_display = "N/A" if ai_score is None else str(ai_score)

    return f"""
    <!DOCTYPE html>
    <html>
      <body style="margin:0; padding:0; background:#f3f4f6; font-family:Arial, sans-serif; color:#111827;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6; padding:24px 0;">
          <tr>
            <td align="center">
              <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:16px; overflow:hidden; border:1px solid #e5e7eb;">
                <tr>
                  <td style="background:#111827; padding:24px 32px;">
                    <h1 style="margin:0; color:#ffffff; font-size:22px;">
                      Score updated by your professor
                    </h1>
                    <p style="margin:8px 0 0; color:#d1d5db; font-size:14px;">
                      SE Autograder · Manual override notification
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:32px;">
                    <p style="font-size:16px; line-height:1.6; margin:0 0 20px;">
                      Hello {safe_student_name},
                    </p>

                    <p style="font-size:16px; line-height:1.6; margin:0 0 24px;">
                      Your professor has manually reviewed your evaluation for
                      <strong>Deliverable {deliverable_number}</strong> in
                      <strong>{safe_project_name}</strong>
                      ({safe_subject_name}).
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
                      <tr>
                        <td width="50%" style="padding:16px; background:#f9fafb; border:1px solid #e5e7eb; border-radius:12px;">
                          <p style="margin:0 0 8px; color:#6b7280; font-size:13px; text-transform:uppercase; letter-spacing:0.04em;">
                            AI Score
                          </p>
                          <p style="margin:0; font-size:28px; font-weight:700; color:#374151;">
                            {ai_score_display}
                          </p>
                        </td>
                        <td width="16"></td>
                        <td width="50%" style="padding:16px; background:#ecfdf5; border:1px solid #bbf7d0; border-radius:12px;">
                          <p style="margin:0 0 8px; color:#047857; font-size:13px; text-transform:uppercase; letter-spacing:0.04em;">
                            Professor Score
                          </p>
                          <p style="margin:0; font-size:28px; font-weight:700; color:#047857;">
                            {override_score}
                          </p>
                        </td>
                      </tr>
                    </table>

                    <div style="margin-top:24px; padding:20px; background:#f9fafb; border-left:4px solid #2563eb; border-radius:12px;">
                      <p style="margin:0 0 8px; color:#374151; font-weight:700;">
                        Professor comment
                      </p>
                      <p style="margin:0; color:#374151; font-size:15px; line-height:1.6; white-space:pre-line;">
                        {safe_override_comment}
                      </p>
                    </div>

                    <p style="font-size:14px; line-height:1.6; margin:24px 0 0; color:#6b7280;">
                      The AI-generated feedback is still available in the platform. This manual score replaces the AI score for grading purposes.
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding:20px 32px; background:#f9fafb; border-top:1px solid #e5e7eb;">
                    <p style="margin:0; color:#6b7280; font-size:12px;">
                      This email was sent automatically by SE Autograder.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
    """


async def send_override_feedback_background(evaluation_id: int) -> None:
    """
    Sends the professor override feedback email using the same Gmail routing
    logic as normal submission/evaluation emails.

    Critical Week 6 behavior:
    override_feedback must use resolve_sender_account(project.id, db), not a
    random active Gmail account from the professor.
    """

    async with async_session_maker() as db:
        evaluation = await db.get(Evaluation, evaluation_id)

        if not evaluation:
            return

        submission = await db.get(Submission, evaluation.submission_id)

        if not submission:
            return

        enrollment = await db.get(Enrollment, submission.enrollment_id)

        if not enrollment:
            return

        project = await db.get(Project, enrollment.project_id)

        if not project:
            return

        subject = await db.get(Subject, project.subject_id)

        if not subject:
            return

        student = await db.get(User, enrollment.student_id)

        if not student:
            return

        sender_account = None

        try:
            sender_account = await resolve_sender_account(
                project_id=project.id,
                db=db,
            )

            student_name = (
                getattr(student, "full_name", None)
                or getattr(student, "name", None)
                or student.email
            )

            body_html = build_override_feedback_email_html(
                student_name=student_name,
                project_name=project.name,
                subject_name=subject.name,
                deliverable_number=submission.deliverable_number,
                ai_score=evaluation.ai_score,
                override_score=evaluation.override_score,
                override_comment=evaluation.override_comment,
            )

            await send_email(
                to=student.email,
                subject=f"Score updated for Deliverable {submission.deliverable_number}",
                body_html=body_html,
                gmail_account_email=sender_account.account_email,
                db=db,
            )

            email_log = EmailLog(
                submission_id=submission.id,
                email_type="override_feedback",
                recipient_email=student.email,
                gmail_account_used=sender_account.account_email,
                sent_at=datetime.now(timezone.utc),
                error_message=None,
            )

            db.add(email_log)
            await db.commit()

        except Exception as exc:
            email_log = EmailLog(
                submission_id=submission.id,
                email_type="override_feedback",
                recipient_email=student.email,
                gmail_account_used=(
                    sender_account.account_email if sender_account else None
                ),
                sent_at=datetime.now(timezone.utc),
                error_message=str(exc),
            )

            db.add(email_log)
            await db.commit()


@router.get("/submissions/{submission_id}/evaluation")
async def get_submission_evaluation(
    submission_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    submission = await db.get(Submission, submission_id)

    if not submission:
        raise HTTPException(status_code=404, detail="Submission not found.")

    enrollment = await db.get(Enrollment, submission.enrollment_id)

    if not enrollment:
        raise HTTPException(status_code=404, detail="Enrollment not found.")

    if current_user.role == "student":
        if enrollment.student_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your submission.")

    elif current_user.role == "professor":
        project = await db.get(Project, enrollment.project_id)

        if not project:
            raise HTTPException(status_code=404, detail="Project not found.")

        subject = await db.get(Subject, project.subject_id)

        if not subject or subject.professor_id != current_user.id:
            raise HTTPException(status_code=403, detail="Not your project.")

    else:
        raise HTTPException(status_code=403, detail="Invalid user role.")

    evaluation_result = await db.execute(
        select(Evaluation).where(Evaluation.submission_id == submission.id)
    )
    evaluation = evaluation_result.scalar_one_or_none()

    if not evaluation:
        return {"status": "pending"}

    return EvaluationRead.model_validate(evaluation)


async def apply_override(
    evaluation_id: int,
    payload: EvaluationOverrideRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession,
    current_user: User,
) -> Evaluation:
    if current_user.role != "professor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Professor role required.",
        )

    evaluation = await db.get(Evaluation, evaluation_id)

    if not evaluation:
        raise HTTPException(status_code=404, detail="Evaluation not found.")

    await verify_professor_owns_evaluation(
        evaluation=evaluation,
        professor=current_user,
        db=db,
    )

    evaluation.is_overridden = True
    evaluation.override_score = payload.override_score
    evaluation.override_comment = payload.override_comment
    evaluation.override_by_professor_id = current_user.id
    evaluation.override_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(evaluation)

    background_tasks.add_task(
        send_override_feedback_background,
        evaluation.id,
    )

    return evaluation


@router.post(
    "/evaluations/{evaluation_id}/override",
    response_model=EvaluationRead,
)
async def override_evaluation_post(
    evaluation_id: int,
    payload: EvaluationOverrideRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await apply_override(
        evaluation_id=evaluation_id,
        payload=payload,
        background_tasks=background_tasks,
        db=db,
        current_user=current_user,
    )


@router.patch(
    "/evaluations/{evaluation_id}/override",
    response_model=EvaluationRead,
)
async def override_evaluation_patch(
    evaluation_id: int,
    payload: EvaluationOverrideRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return await apply_override(
        evaluation_id=evaluation_id,
        payload=payload,
        background_tasks=background_tasks,
        db=db,
        current_user=current_user,
    )