from datetime import datetime


def _format_datetime(value: datetime | None) -> str:
    if value is None:
        return "Not available"

    return value.strftime("%Y-%m-%d %H:%M")


def confirmation_email(
    student_name: str,
    deliverable_num: int,
    project_name: str,
    deadline_next: datetime | None,
) -> str:
    deadline_text = _format_datetime(deadline_next)

    return f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <div style="max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #2563eb;">Deliverable {deliverable_num} received</h2>

          <p>Hello {student_name},</p>

          <p>
            Your <strong>Deliverable {deliverable_num}</strong> for the project
            <strong>{project_name}</strong> has been received successfully.
          </p>

          <p>
            The system will process your submission and your professor will be able to review your progress.
          </p>

          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-top: 16px;">
            <p style="margin: 0;">
              <strong>Next deadline:</strong> {deadline_text}
            </p>
          </div>

          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            This is an automatic message from SE Autograder.
          </p>
        </div>
      </body>
    </html>
    """


def professor_notification_email(
    student_name: str,
    deliverable_num: int,
    project_name: str,
    submission_preview: str,
) -> str:
    return f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <div style="max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #7c3aed;">New student submission</h2>

          <p>
            <strong>{student_name}</strong> has submitted
            <strong>Deliverable {deliverable_num}</strong> for:
          </p>

          <p style="font-size: 18px;">
            <strong>{project_name}</strong>
          </p>

          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-top: 16px;">
            <p style="margin-top: 0;"><strong>Submission preview:</strong></p>
            <p style="white-space: pre-wrap;">{submission_preview}</p>
          </div>

          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            This is an automatic message from SE Autograder.
          </p>
        </div>
      </body>
    </html>
    """


def feedback_email(
    student_name: str,
    deliverable_num: int,
    score: int,
    criteria_breakdown: dict,
    feedback_text: str,
) -> str:
    criteria_rows = ""

    for criterion, criterion_score in criteria_breakdown.items():
        criteria_rows += f"""
        <tr>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb;">{criterion}</td>
          <td style="padding: 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">
            <strong>{criterion_score}</strong>
          </td>
        </tr>
        """

    return f"""
    <html>
      <body style="font-family: Arial, sans-serif; color: #111827; line-height: 1.6;">
        <div style="max-width: 640px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
          <h2 style="color: #059669;">Deliverable {deliverable_num} evaluated</h2>

          <p>Hello {student_name},</p>

          <p>Your deliverable has been evaluated.</p>

          <div style="font-size: 32px; font-weight: bold; color: #2563eb; margin: 24px 0;">
            Score: {score}/100
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
            <thead>
              <tr>
                <th style="text-align: left; padding: 8px; border-bottom: 2px solid #d1d5db;">Criterion</th>
                <th style="text-align: right; padding: 8px; border-bottom: 2px solid #d1d5db;">Score</th>
              </tr>
            </thead>
            <tbody>
              {criteria_rows}
            </tbody>
          </table>

          <div style="background: #f9fafb; padding: 16px; border-radius: 8px; margin-top: 24px;">
            <p style="margin-top: 0;"><strong>Feedback:</strong></p>
            <p style="white-space: pre-wrap;">{feedback_text}</p>
          </div>

          <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
            This is an automatic message from SE Autograder.
          </p>
        </div>
      </body>
    </html>
    """