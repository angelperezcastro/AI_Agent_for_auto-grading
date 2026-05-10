# Week 6 Day 2 — Backend Security and Gmail Resolver Audit

## Purpose

This audit validates two critical production requirements of the SE Autograder platform:

1. The Gmail sender resolution fallback chain works correctly across project-level, subject-level and professor-level configurations.
2. Backend permissions protect professor-only resources, student-private submissions and Gmail OAuth credentials.

The goal is to prove that the system is safe to use in a multi-account academic environment where professors may manage multiple subjects and Gmail sender accounts.

---

## Scope

This day focuses on backend-level verification only. No manual UI testing is required.

The audit covers:

- Gmail account resolution logic.
- Role-based access control.
- Cross-student data isolation.
- Cross-professor ownership protection.
- Gmail credential encryption at rest.
- Prevention of OAuth token leakage through API responses.

---

## Part 1 — Gmail Resolver Fallback Chain

The platform sends emails through the Gmail account resolved for the project associated with a submission or feedback event.

The resolver follows this priority order:

1. **Project-level Gmail account**  
   If `project.gmail_account_id` is set, that account must be used.

2. **Subject-level Gmail account**  
   If the project has no account, the resolver checks whether the subject has a Gmail account assigned through `GmailAccount.subject_id`.

3. **Professor personal Gmail account**  
   If neither project nor subject has a configured account, the resolver falls back to an active Gmail account owned by the professor, preferably one not assigned to any subject.

4. **Clear failure**  
   If no active Gmail account exists, the resolver raises a clear configuration error instead of silently failing or selecting an incorrect account.

---

## Resolver Test Script

The resolver fallback chain is validated with:

```bash
python scripts/week6_day2_test_email_resolver_fallbacks.py --project-id 2 --subject-id 2 --project-account-id 2 --subject-account-id 1 --personal-account-id 1
```

The script temporarily mutates the database to simulate all resolver states, then restores the original state after the test.

### Scenario 1 — Project-level account

**Condition:**

```text
project.gmail_account_id is set
```

**Expected result:**

```text
The project-level Gmail account is selected.
```

This proves that explicit project configuration has the highest priority.

---

### Scenario 2 — Subject-level account

**Condition:**

```text
project.gmail_account_id is NULL
subject has a configured Gmail account
```

**Expected result:**

```text
The subject-level Gmail account is selected.
```

This proves that subject-level routing works for multi-account setups where each subject uses a different Gmail identity.

---

### Scenario 3 — Professor personal account fallback

**Condition:**

```text
project.gmail_account_id is NULL
subject has no configured Gmail account
professor has at least one active Gmail account
```

**Expected result:**

```text
The professor's personal active Gmail account is selected.
```

This prevents email delivery from failing unnecessarily when no subject-specific configuration exists.

---

### Scenario 4 — No Gmail account configured

**Condition:**

```text
project has no Gmail account
subject has no Gmail account
professor has no active Gmail account
```

**Expected result:**

```text
The resolver raises a clear configuration error.
```

The platform must not silently use another professor's Gmail account or an unrelated account.

---

## Part 2 — Backend Security and Permission Audit

The backend security audit validates that API-level permissions correctly enforce role and ownership boundaries.

The audit is executed with:

```bash
python scripts/week6_day2_security_audit.py --base-url http://127.0.0.1:8000 --professor-email angelpeka44@gmail.com
```

The backend must be running before executing the audit:

```bash
uvicorn app.main:app --reload
```

---

## Security Checks Performed

### 1. Students cannot access Gmail settings

**Endpoint tested:**

```http
GET /settings/gmail-accounts
```

**Actor:** student

**Expected result:**

```text
403 Forbidden
```

Gmail account management is a professor-only feature. Students must never be able to list, inspect or manage connected Gmail accounts.

---

### 2. Students cannot access professor project enrollment lists

**Endpoint tested:**

```http
GET /projects/{project_id}/enrollments
```

**Actor:** student

**Expected result:**

```text
403 Forbidden
```

Project enrollment lists expose class-level progress data and must be restricted to the professor who owns the project.

---

### 3. Professors cannot override evaluations outside their own projects

**Endpoint tested:**

```http
PATCH /evaluations/{evaluation_id}/override
```

**Actor:** professor who does not own the project

**Expected result:**

```text
403 Forbidden
```

Manual score override is a sensitive grading operation. A professor must only override evaluations belonging to their own subjects and projects.

---

### 4. Students cannot view another student's submissions

**Endpoint tested:**

```http
GET /enrollments/{enrollment_id}/submissions
```

**Actor:** student A accessing student B's enrollment

**Expected result:**

```text
403 Forbidden
```

Submissions and AI feedback are private academic records. Students may only access their own enrollments, submissions and evaluations.

---

### 5. Gmail settings API does not expose credentials or tokens

**Endpoint tested:**

```http
GET /settings/gmail-accounts
```

**Actor:** owning professor

**Expected result:**

```text
200 OK, but without sensitive OAuth fields
```

The response must not contain fields such as:

```text
credentials_json
credentials
refresh_token
access_token
client_secret
id_token
token
token_uri
expiry
token_expiry
```

Professors can see connected account metadata, but raw OAuth credentials must never leave the backend.

---

### 6. Gmail credentials are encrypted at rest

**Storage checked:**

```text
GmailAccount.credentials_json
```

**Expected result:**

```text
The stored value is encrypted and decryptable only through the backend crypto layer.
```

The audit verifies that the database does not store plaintext OAuth credentials and that encrypted payloads can still be decrypted by the application using the configured Fernet key.

---

## Test Data Preparation

If the security audit does not have enough students/enrollments to test cross-student isolation, the following helper script prepares deterministic audit data:

```bash
python scripts/week6_day2_prepare_security_audit_data.py
```

It creates or reuses two audit students:

```text
week6.audit.student1@se-autograder.local
week6.audit.student2@se-autograder.local
```

and enrolls them in professor-owned projects.

These accounts are used only for backend permission testing.

---

## Debugging Internal Errors

If any audited endpoint returns `500 Internal Server Error`, the result is not considered a valid permission decision. A `500` means the backend crashed and must be fixed.

The diagnostic script is:

```bash
python scripts/week6_day2_debug_security_500.py
```

It calls the same sensitive endpoints and prints the HTTP status and response body. The full Python traceback must be checked in the `uvicorn` terminal.

During this audit, JWT generation was corrected so that test tokens use the numeric user ID as the JWT subject, matching the backend dependency logic.

---

## Final Audit Result

The final security audit passed with the following results:

```text
[PASS] Student cannot access /settings/gmail-accounts
[PASS] Student cannot access /projects/{project_id}/enrollments
[PASS] Other professor cannot override evaluation outside their projects
[PASS] Student cannot view another student's submissions
[PASS] Gmail settings API does not return credentials/tokens
[PASS] Gmail credentials are encrypted at rest
```

The resolver fallback test also passed all four routing scenarios.

---

## Conclusion

Week 6 Day 2 confirms that the backend enforces the required security boundaries for a production-like academic workflow:

- Gmail routing is deterministic and follows the correct fallback order.
- Students cannot access professor-only data.
- Students cannot access other students' academic submissions.
- Professors cannot override evaluations outside their ownership scope.
- Gmail OAuth credentials remain encrypted in the database.
- Gmail tokens are not exposed by public API responses.

This provides strong evidence that the platform is ready for broader integration and regression testing in the remaining Week 6 workflow.
