from datetime import datetime
from html import escape
from typing import Mapping


def _format_datetime(value: datetime | None) -> str:
    if value is None:
        return "Not available"

    return value.strftime("%Y-%m-%d %H:%M")


def _safe_text(value: object) -> str:
    if value is None:
        return ""

    return escape(str(value))


def _text_to_html(value: object) -> str:
    return _safe_text(value).replace("\n", "<br>")


def _score_color(score: int) -> tuple[str, str, str]:
    """
    Returns background, border and text colors for the score badge.
    """
    if score >= 80:
        return "#DCFCE7", "#22C55E", "#166534"

    if score >= 50:
        return "#FEF3C7", "#F59E0B", "#92400E"

    return "#FEE2E2", "#EF4444", "#991B1B"


def _render_criteria_rows(
    criteria_breakdown: Mapping[str, int],
    criteria_max_points: Mapping[str, int] | None = None,
) -> str:
    if not criteria_breakdown:
        return """
        <tr>
          <td colspan="3" style="padding: 14px; color: #64748B; font-size: 14px;">
            No criteria breakdown available.
          </td>
        </tr>
        """

    rows: list[str] = []

    for criterion_name, raw_score in criteria_breakdown.items():
        try:
            criterion_score = int(raw_score)
        except (TypeError, ValueError):
            criterion_score = 0

        max_points = None
        percentage = min(max(criterion_score, 0), 100)

        if criteria_max_points and criterion_name in criteria_max_points:
            max_points = int(criteria_max_points[criterion_name])
            if max_points > 0:
                percentage = round((criterion_score / max_points) * 100)

        percentage = max(0, min(100, percentage))

        score_label = (
            f"{criterion_score}/{max_points}"
            if max_points is not None
            else str(criterion_score)
        )

        rows.append(
            f"""
            <tr>
              <td style="padding: 14px; border-bottom: 1px solid #E2E8F0; font-size: 14px; color: #0F172A;">
                <strong>{_safe_text(criterion_name)}</strong>
              </td>
              <td style="padding: 14px; border-bottom: 1px solid #E2E8F0; font-size: 14px; color: #334155; width: 90px; text-align: right;">
                {score_label}
              </td>
              <td style="padding: 14px; border-bottom: 1px solid #E2E8F0; width: 180px;">
                <div style="height: 10px; width: 100%; background: #E2E8F0; border-radius: 999px; overflow: hidden;">
                  <div style="height: 10px; width: {percentage}%; background: #2563EB; border-radius: 999px;"></div>
                </div>
              </td>
            </tr>
            """
        )

    return "\n".join(rows)


def confirmation_email(
    student_name: str,
    deliverable_num: int,
    project_name: str,
    deadline_next: datetime | None,
) -> str:
    deadline_text = _format_datetime(deadline_next)

    return f"""
    <!DOCTYPE html>
    <html>
      <body style="margin: 0; padding: 0; background: #F1F5F9; font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.6;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #F1F5F9; padding: 32px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);">
                <tr>
                  <td style="padding: 26px 30px; background: #2563EB; color: #FFFFFF;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.88;">
                      Submission received
                    </p>
                    <h1 style="margin: 0; font-size: 24px; line-height: 1.25;">
                      Deliverable {deliverable_num} received
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 30px;">
                    <p style="margin: 0 0 16px 0;">
                      Hello {_safe_text(student_name)},
                    </p>

                    <p style="margin: 0 0 16px 0;">
                      Your <strong>Deliverable {deliverable_num}</strong> for the project
                      <strong>{_safe_text(project_name)}</strong> has been received successfully.
                    </p>

                    <p style="margin: 0 0 18px 0;">
                      The system will process your submission and your professor will be able to review your progress.
                    </p>

                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 10px; margin-top: 18px;">
                      <p style="margin: 0;">
                        <strong>Next deadline:</strong> {_safe_text(deadline_text)}
                      </p>
                    </div>

                    <p style="margin-top: 26px; color: #64748B; font-size: 13px;">
                      This is an automatic message from SE Autograder.
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


def professor_notification_email(
    student_name: str,
    deliverable_num: int,
    project_name: str,
    submission_preview: str,
) -> str:
    return f"""
    <!DOCTYPE html>
    <html>
      <body style="margin: 0; padding: 0; background: #F1F5F9; font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.6;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #F1F5F9; padding: 32px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 640px; background: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 28px rgba(15, 23, 42, 0.08);">
                <tr>
                  <td style="padding: 26px 30px; background: #7C3AED; color: #FFFFFF;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.88;">
                      Professor notification
                    </p>
                    <h1 style="margin: 0; font-size: 24px; line-height: 1.25;">
                      New student submission
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 30px;">
                    <p style="margin: 0 0 16px 0;">
                      <strong>{_safe_text(student_name)}</strong> has submitted
                      <strong>Deliverable {deliverable_num}</strong> for:
                    </p>

                    <p style="font-size: 18px; margin: 0 0 18px 0;">
                      <strong>{_safe_text(project_name)}</strong>
                    </p>

                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; padding: 16px; border-radius: 10px; margin-top: 18px;">
                      <p style="margin-top: 0;"><strong>Submission preview:</strong></p>
                      <p style="white-space: pre-wrap; margin-bottom: 0;">{_safe_text(submission_preview)}</p>
                    </div>

                    <p style="margin-top: 26px; color: #64748B; font-size: 13px;">
                      This is an automatic message from SE Autograder.
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


def feedback_email(
    student_name: str,
    deliverable_num: int,
    score: int,
    criteria_breakdown: Mapping[str, int],
    feedback_text: str,
    project_name: str = "Project",
    platform_url: str = "http://localhost:5173",
    criteria_max_points: Mapping[str, int] | None = None,
    is_override: bool = False,
    professor_comment: str | None = None,
    ai_score: int | None = None,
) -> str:
    """
    Professional HTML feedback email sent to the student after AI grading
    or after professor score override.

    Backward compatible with the previous call:
    feedback_email(student_name, deliverable_num, score, criteria_breakdown, feedback_text)

    Also supports the new dispatcher call with:
    project_name, platform_url, criteria_max_points, is_override, professor_comment, ai_score.
    """
    try:
        score = int(score)
    except (TypeError, ValueError):
        score = 0

    score = max(0, min(100, score))

    badge_bg, badge_border, badge_text = _score_color(score)

    override_badge = ""
    professor_comment_block = ""

    if is_override:
        previous_score_text = (
            f" Previous AI score: {int(ai_score)}/100."
            if ai_score is not None
            else ""
        )

        override_badge = f"""
        <div style="margin: 0 0 22px 0; padding: 13px 16px; background: #EFF6FF; border: 1px solid #BFDBFE; border-radius: 12px; color: #1E40AF; font-size: 14px;">
          <strong>Score updated by your professor.</strong>{previous_score_text}
        </div>
        """

        if professor_comment:
            professor_comment_block = f"""
            <div style="margin-top: 26px;">
              <h3 style="margin: 0 0 10px 0; color: #0F172A; font-size: 18px;">
                Professor comment
              </h3>
              <div style="background: #F8FAFC; border-left: 4px solid #2563EB; padding: 16px; border-radius: 10px; color: #334155; line-height: 1.6; font-size: 15px;">
                {_text_to_html(professor_comment)}
              </div>
            </div>
            """

    return f"""
    <!DOCTYPE html>
    <html>
      <body style="margin: 0; padding: 0; background: #F1F5F9; font-family: Arial, Helvetica, sans-serif; color: #111827; line-height: 1.6;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: #F1F5F9; padding: 32px 0;">
          <tr>
            <td align="center">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width: 720px; background: #FFFFFF; border-radius: 18px; overflow: hidden; box-shadow: 0 12px 30px rgba(15, 23, 42, 0.10);">

                <tr>
                  <td style="padding: 28px 32px; background: linear-gradient(135deg, #0F172A, #1D4ED8); color: #FFFFFF;">
                    <p style="margin: 0 0 8px 0; font-size: 13px; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.85;">
                      AI Evaluation Completed
                    </p>
                    <h1 style="margin: 0; font-size: 26px; line-height: 1.25;">
                      Deliverable {deliverable_num} feedback is ready
                    </h1>
                    <p style="margin: 10px 0 0 0; font-size: 15px; opacity: 0.9;">
                      Project: {_safe_text(project_name)}
                    </p>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 32px;">
                    <p style="margin: 0 0 18px 0; color: #334155; font-size: 16px; line-height: 1.6;">
                      Hello {_safe_text(student_name)}, your deliverable has been evaluated. Below you can review your score, criteria breakdown and detailed feedback.
                    </p>

                    {override_badge}

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin: 22px 0 28px 0;">
                      <tr>
                        <td align="center">
                          <div style="width: 150px; height: 150px; border-radius: 50%; background: {badge_bg}; border: 5px solid {badge_border}; color: {badge_text}; display: inline-block; text-align: center;">
                            <div style="font-size: 42px; font-weight: 800; line-height: 1; margin-top: 38px;">
                              {score}
                            </div>
                            <div style="font-size: 15px; font-weight: 700; margin-top: 6px;">
                              / 100
                            </div>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <h2 style="margin: 0 0 14px 0; color: #0F172A; font-size: 20px;">
                      Criteria breakdown
                    </h2>

                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border: 1px solid #E2E8F0; border-radius: 14px; overflow: hidden; border-collapse: separate; border-spacing: 0; margin-bottom: 28px;">
                      <thead>
                        <tr style="background: #F8FAFC;">
                          <th align="left" style="padding: 13px 14px; font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #E2E8F0;">
                            Criterion
                          </th>
                          <th align="right" style="padding: 13px 14px; font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #E2E8F0;">
                            Score
                          </th>
                          <th align="left" style="padding: 13px 14px; font-size: 12px; color: #64748B; text-transform: uppercase; letter-spacing: 0.05em; border-bottom: 1px solid #E2E8F0;">
                            Progress
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {_render_criteria_rows(criteria_breakdown, criteria_max_points)}
                      </tbody>
                    </table>

                    <h2 style="margin: 0 0 14px 0; color: #0F172A; font-size: 20px;">
                      Detailed feedback
                    </h2>

                    <div style="background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 14px; padding: 20px; color: #334155; line-height: 1.7; font-size: 15px;">
                      {_text_to_html(feedback_text)}
                    </div>

                    {professor_comment_block}

                    <div style="text-align: center; margin-top: 32px;">
                      <a href="{_safe_text(platform_url)}" style="display: inline-block; background: #2563EB; color: #FFFFFF; text-decoration: none; padding: 14px 22px; border-radius: 12px; font-weight: 700; font-size: 15px;">
                        Log in to view details
                      </a>
                    </div>

                    <p style="margin: 28px 0 0 0; color: #64748B; font-size: 13px; line-height: 1.5; text-align: center;">
                      This message was generated by SE Autograder. Your professor can review or override this evaluation if necessary.
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