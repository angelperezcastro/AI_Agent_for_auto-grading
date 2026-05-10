# Week 6 Day 3 — Frontend Error Handling Audit and Full Regression Test

## Purpose

This document summarizes the automated validation performed during **Week 6 Day 3** of the SE Autograder project.

The goal of this day was to verify that the application behaves reliably from an end-to-end perspective after completing the multi-account Gmail work from the previous days. The validation focused on two major areas:

1. **Frontend asynchronous UX audit**
   - Every relevant async action must expose loading and error states.
   - Gmail-related actions must provide clear, user-friendly error messages.
   - Submission flows must handle email delivery failures gracefully.

2. **Full backend regression test**
   - Professor setup.
   - Student enrollment.
   - Sequential submission of all four deliverables.
   - AI evaluation after every deliverable.
   - Email delivery verification through `EmailLog`.
   - Professor score override.
   - Override feedback email verification.

The objective was to close Week 6 with automated evidence that the platform is stable, traceable, and production-ready from a workflow perspective.

---

## Context

By the beginning of Week 6 Day 3, the system already supported:

- Real Gmail OAuth accounts.
- Multi-account Gmail routing.
- Token refresh for expired Gmail tokens.
- Gmail fallback resolution through `email_resolver`.
- Email audit logging through `EmailLog`.
- AI evaluation using the backend evaluation pipeline.
- Professor override workflow.
- Student and professor role-based access control.

Day 3 focused on validating that all of these pieces work together as a complete product flow.

---

## Scope of the Validation

The validation intentionally avoided manual UI testing. Instead, the checks were automated through frontend and backend scripts.

The tested areas were:

| Area | Validation |
|---|---|
| Frontend async actions | Loading and error states are present in UI-level async components |
| Gmail OAuth UX | Popup closed/blocked/failure messages exist |
| Test email UX | Failed test email action exposes a useful reason |
| Submission UX | If submission is saved but email delivery fails, the user receives a safe non-technical warning |
| Student flow | Student can submit Deliverables 1, 2, 3, and 4 sequentially |
| AI evaluation | Each deliverable receives an Evaluation row |
| Email delivery | Confirmation, professor notification, and feedback emails are logged for every deliverable |
| Professor override | Professor can override Deliverable 2 |
| Override email | `override_feedback` email is logged correctly |
| Email audit | No `EmailLog` entry contains an error for the regression run |

---

## Frontend Audit

### Script

The frontend audit was implemented with:

```bash
frontend/scripts/week6_day3_frontend_async_audit.mjs
```

It is executed through:

```bash
npm run audit:week6-day3
```

### What the Script Checks

The script scans frontend source files and validates UI-level async behavior.

It checks that async UI files include:

- A loading or pending state.
- An error state.
- Cleanup or loading reset logic, such as `finally`, `setLoading(false)`, `setSubmitting(false)`, or similar.

The script intentionally skips non-UI files such as:

```txt
src/services/api.js
src/services/professorApi.js
src/services/professorWeek5Api.js
```

This distinction matters because service modules should not own visual state. Their role is to expose API functions, while pages and components are responsible for rendering loading and error states.

### Required Email UX Messages

The frontend audit also verifies that specific Gmail/email-related UX messages exist in the codebase.

The required messages are:

```txt
Connect Gmail was cancelled or the popup was closed before authorization finished. Please try again from Settings.
```

```txt
Connect Gmail failed because the OAuth popup was blocked by the browser. Please allow popups and try again from Settings.
```

```txt
Connect Gmail failed during OAuth authorization. Please try again from Settings.
```

```txt
Send Test Email failed. The backend returned an error reason. Please check the message details and verify the Gmail account connection.
```

```txt
Submission saved. Email delivery failed — check Settings.
```

These messages are centralized in:

```bash
frontend/src/utils/emailUxMessages.js
```

### Frontend Files Added or Updated

The following frontend files were added or updated:

```txt
frontend/scripts/week6_day3_frontend_async_audit.mjs
frontend/src/utils/emailUxMessages.js
frontend/src/utils/openGmailOAuthPopup.js
frontend/src/components/SubmissionForm.jsx
frontend/src/pages/WorkspacePage.jsx
```

### Frontend Result

The final frontend audit passed:

```txt
FRONTEND AUDIT PASSED
```

This confirms that the relevant async UI flows expose appropriate loading/error states and that required Gmail/email UX copy is present.

---

## Submission Email Failure Handling

The submission flow was updated to handle this specific case:

> The backend saves the submission successfully, but one or more email dispatch operations fail.

The expected user-facing behavior is:

```txt
Submission saved. Email delivery failed — check Settings.
```

This is intentionally non-technical. The student should not see internal Gmail/OAuth details. The professor can inspect the actual delivery failure through the email audit log.

### Why This Matters

A submission and an email notification are related but separate concerns:

- The **submission** is the academic artifact.
- The **email** is the notification layer.

If email delivery fails, the system must not make the student think their work was lost. The correct behavior is to preserve the submission and expose a clear but calm warning.

---

## Full Backend Regression Test

### Script

The full backend regression was implemented with:

```bash
backend/scripts/week6_day3_full_regression.py
```

It was executed with:

```bash
python scripts/week6_day3_full_regression.py --base-url http://127.0.0.1:8000 --professor-email angelpeka44@gmail.com --gmail-account-email angelpeka44@gmail.com --student-email angelpeka04+week6day3@gmail.com
```

### Regression Flow

The script performs a complete end-to-end journey.

#### 1. Professor and Gmail Account Detection

The script locates an existing professor:

```txt
angelpeka44@gmail.com
```

Then it finds an active Gmail account owned by that professor:

```txt
angelpeka44@gmail.com
```

This Gmail account is assigned to the regression project so all outgoing emails can be verified against the expected sender.

#### 2. Regression Subject and Project Creation

The script creates a new isolated subject and project:

```txt
Week 6 Day 3 Regression Subject <run_id>
Week 6 Day 3 Regression Project <run_id>
```

The project is assigned to the real Gmail account.

This avoids destructive database resets and prevents the test from interfering with previous manual or seed data.

#### 3. Regression Student Creation

The script creates or reuses a student:

```txt
angelpeka04+week6day3@gmail.com
```

This is a Gmail alias, so emails still arrive in the real inbox associated with `angelpeka04@gmail.com`.

#### 4. Enrollment Creation

The student is enrolled in the regression project.

This creates a clean enrollment used exclusively for the automated regression flow.

#### 5. Sequential Deliverable Submission

The script submits all four deliverables in order:

```txt
Deliverable 1 — Research + Motivation Letter
Deliverable 2 — User Requirements List
Deliverable 3 — Target Group Interview Questions
Deliverable 4 — Updated Requirements List
```

For each deliverable, the script:

1. Sends a `POST /submissions` request.
2. Extracts the created `submission_id`.
3. Waits for the AI evaluation to complete.
4. Verifies that an `Evaluation` row exists.
5. Verifies required `EmailLog` entries.

#### 6. AI Evaluation Verification

For every submitted deliverable, the script waits until an `Evaluation` is generated.

The observed regression run produced:

| Deliverable | Submission ID | Evaluation ID | AI Score |
|---|---:|---:|---:|
| D1 | 49 | 45 | 65 |
| D2 | 50 | 46 | 68 |
| D3 | 51 | 47 | 75 |
| D4 | 52 | 48 | 78 |

This confirms that the AI evaluation pipeline worked for all four deliverable types.

#### 7. EmailLog Verification

For every deliverable, the script verifies the following email types:

```txt
confirmation
professor_notification
feedback
```

Each log must satisfy:

- The expected email type exists.
- The sender is the expected Gmail account.
- `error_message` is `None`.

#### 8. Professor Override Verification

After D2 is evaluated, the script sends a professor override request:

```http
PATCH /evaluations/{evaluation_id}/override
```

The override uses:

```txt
override_score = 91
```

Then the script waits for an `override_feedback` EmailLog entry.

This validates that the override workflow is not only saved in the database, but also triggers the expected email notification.

### Backend Regression Result

The full regression passed:

```txt
FULL REGRESSION PASSED
```

The validated journey was:

```txt
professor setup -> student D1-D4 -> AI feedback -> professor override
```

---

## EmailLog Summary

### Script

The email log summary was implemented with:

```bash
backend/scripts/week6_day3_email_log_summary.py
```

It was executed with:

```bash
python scripts/week6_day3_email_log_summary.py --student-email angelpeka04+week6day3@gmail.com
```

### Verified EmailLog Entries

The summary confirmed the following logs:

| Log ID | Type | Deliverable | Sender | Error |
|---:|---|---:|---|---|
| 114 | confirmation | D1 | angelpeka44@gmail.com | None |
| 115 | professor_notification | D1 | angelpeka44@gmail.com | None |
| 116 | feedback | D1 | angelpeka44@gmail.com | None |
| 117 | confirmation | D2 | angelpeka44@gmail.com | None |
| 118 | professor_notification | D2 | angelpeka44@gmail.com | None |
| 119 | feedback | D2 | angelpeka44@gmail.com | None |
| 120 | confirmation | D3 | angelpeka44@gmail.com | None |
| 121 | professor_notification | D3 | angelpeka44@gmail.com | None |
| 122 | feedback | D3 | angelpeka44@gmail.com | None |
| 123 | confirmation | D4 | angelpeka44@gmail.com | None |
| 124 | professor_notification | D4 | angelpeka44@gmail.com | None |
| 125 | feedback | D4 | angelpeka44@gmail.com | None |
| 126 | override_feedback | D2 | angelpeka44@gmail.com | None |

### EmailLog Summary Result

The summary passed:

```txt
EMAIL LOG SUMMARY PASSED
No EmailLog errors found for Week 6 Day 3 regression data.
```

This confirms that every expected email was logged successfully and no delivery error was recorded for the regression flow.

---

## Final Validation Checklist

The following Week 6 Day 3 requirements were completed:

```txt
[OK] Frontend async audit passed.
[OK] Connect Gmail popup closed/failure message exists.
[OK] Send Test Email failure reason exists.
[OK] Submission saved but email failed message exists.
[OK] Full backend regression passed.
[OK] D1 submitted, evaluated, and emails logged.
[OK] D2 submitted, evaluated, and emails logged.
[OK] D3 submitted, evaluated, and emails logged.
[OK] D4 submitted, evaluated, and emails logged.
[OK] D2 professor override completed.
[OK] override_feedback email logged.
[OK] EmailLog summary has zero errors.
```

---

## Technical Significance

This validation is important because it proves the application works as a complete academic workflow, not just as isolated features.

The successful regression confirms:

1. **Sequential deliverable workflow works**
   - D1 through D4 can be submitted in order.
   - Each deliverable receives an AI evaluation.

2. **Email dispatch works across the complete journey**
   - Student confirmation emails are logged.
   - Professor notification emails are logged.
   - AI feedback emails are logged.
   - Professor override feedback emails are logged.

3. **Email auditability is production-ready**
   - Every relevant email event is persisted.
   - The sender account is recorded.
   - Delivery errors are stored when they happen.

4. **Frontend error handling is safer**
   - Gmail OAuth errors have clear user-facing messages.
   - Test email failures expose useful reasons.
   - Submission success is separated from email delivery success.

5. **The professor override workflow is verified**
   - Overrides update the evaluation.
   - Override feedback email dispatch is logged.
   - The workflow remains traceable through `EmailLog`.

---

## Commands Used

### Frontend Audit

```bash
cd frontend
npm run audit:week6-day3
```

### Backend Regression

```bash
cd backend
python scripts/week6_day3_full_regression.py --base-url http://127.0.0.1:8000 --professor-email angelpeka44@gmail.com --gmail-account-email angelpeka44@gmail.com --student-email angelpeka04+week6day3@gmail.com
```

### EmailLog Summary

```bash
cd backend
python scripts/week6_day3_email_log_summary.py --student-email angelpeka04+week6day3@gmail.com
```

---

## Conclusion

Week 6 Day 3 was completed successfully.

The system passed both the frontend async/error handling audit and the full backend regression test. The complete workflow from professor setup to student submissions, AI evaluation, email delivery, email audit logging, and professor override was validated automatically.

This closes the final technical validation block of Week 6 and provides strong evidence that the platform is ready for final deployment preparation and documentation.
