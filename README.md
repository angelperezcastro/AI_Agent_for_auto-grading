# AI Agent for Auto-Grading

> A full-stack academic platform for AI-assisted evaluation of Software Engineering deliverables, real Gmail-based notifications, professor supervision, and score override workflows.

![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/Frontend-React-61DAFB?style=for-the-badge&logo=react&logoColor=111827)
![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white)
![Google Gemini](https://img.shields.io/badge/AI-Google%20Gemini-4285F4?style=for-the-badge&logo=google&logoColor=white)
![Gmail API](https://img.shields.io/badge/Email-Gmail%20API-EA4335?style=for-the-badge&logo=gmail&logoColor=white)

AI Agent for Auto-Grading is a production-oriented academic web platform designed for Software Engineering courses. It allows professors to create subjects and projects, students to enroll and submit four sequential deliverables, and an AI evaluator to grade each submission with a structured score, criterion breakdown, and detailed feedback.

The platform combines a real full-stack architecture with authentication, relational data modeling, Google Gemini evaluation, Gmail OAuth integration, HTML email delivery, audit logging, professor dashboards, and manual score override. It is intended for professors who want faster formative feedback loops and for students who need immediate, rubric-aware feedback during requirements engineering assignments.

---

## Visual Hero

![Main Product Screenshot](docs/screenshots/hero-product-overview.png)

Recommended screenshot: show the deployed app with the professor dashboard or the student workspace after at least one evaluated deliverable. The strongest hero image is a wide screenshot where the evaluator score, deliverable status, and polished dashboard UI are visible.

---

## Table of Contents

- [Key Features](#key-features)
- [System Architecture](#system-architecture)
- [User Roles and Workflows](#user-roles-and-workflows)
- [Tech Stack](#tech-stack)
- [Repository Structure](#repository-structure)
- [Backend Architecture](#backend-architecture)
- [Database Model](#database-model)
- [API Overview](#api-overview)
- [AI Evaluation Pipeline](#ai-evaluation-pipeline)
- [Gmail Integration](#gmail-integration)
- [Frontend Overview](#frontend-overview)
- [Screenshots](#screenshots)
- [Local Setup](#local-setup)
- [Environment Variables](#environment-variables)
- [Production Deployment](#production-deployment)
- [Production Smoke Test Checklist](#production-smoke-test-checklist)
- [Security Considerations](#security-considerations)
- [Testing and Validation](#testing-and-validation)
- [Known Limitations](#known-limitations)
- [Roadmap](#roadmap)
- [Portfolio Value](#portfolio-value)
- [Author](#author)

---

## Key Features

### Authentication and Role-Based Access

- Student and professor registration through `/auth/register`.
- Login through `/auth/login`, returning a JWT bearer token.
- Current user endpoint through `/auth/me`.
- Protected frontend routes for authenticated users.
- Dedicated professor route guard for professor-only pages.

### Professor Features

- Create, list, update, and delete subjects.
- Create, list, update, and delete projects inside subjects.
- Assign Gmail accounts to specific projects.
- Set a Gmail account as the default sender for a subject.
- View a dashboard of student enrollments, progress, latest scores, latest activity, and email status.
- Open a detailed student progress view with all four deliverables, submitted content, AI feedback, email history, and status information.
- Override an AI evaluation score with a required manual comment.
- Trigger an override feedback email to the student after a score override.

### Student Features

- Register and log in as a student.
- Browse available subjects and projects.
- Enroll in a project.
- Maintain only one active project per subject.
- Submit four deliverables in strict sequence.
- View a deliverable timeline with locked, open, submitted, evaluated, and overdue states.
- View in-platform feedback, criterion breakdowns, final score, and professor overrides.

### AI-Powered Evaluation

- Uses Google Gemini through the `google-genai` SDK.
- Supports four deliverable-specific rubrics.
- Provides a total score from 0 to 100.
- Produces criterion-level scores based on rubric maximums.
- Generates detailed constructive feedback.
- Uses previous submissions and feedback as cumulative context for later deliverables.
- Validates and repairs structured JSON output before saving it.

### Gmail and Email Workflow

- Professors connect Gmail accounts through Google OAuth.
- OAuth credentials are encrypted at rest with Fernet.
- Gmail sending is routed by project-level account, subject-level default, professor personal account, or final active fallback.
- Sends confirmation emails to students after submissions.
- Sends notification emails to professors after submissions.
- Sends AI feedback emails to students after evaluations.
- Sends override feedback emails after professor score overrides.
- Logs successful and failed email attempts in `EmailLog`.

### Deployment Readiness

- Railway backend deployment configuration is included in `backend/railway.json`.
- Alembic migrations are wired to use `DATABASE_URL` from environment variables.
- CORS supports explicit frontend origins through `ALLOWED_ORIGINS`.
- Frontend uses `VITE_API_URL` to target local or production FastAPI APIs.

---

## System Architecture

```mermaid
flowchart LR
    Student[Student User] -->|Uses browser| React[React + Vite Frontend]
    Professor[Professor User] -->|Uses browser| React

    React -->|JWT authenticated REST calls| API[FastAPI Backend]

    API -->|Async SQLAlchemy| DB[(PostgreSQL Database)]
    API -->|Prompt + submission context| AI[Google Gemini Evaluation Service]
    AI -->|Structured JSON score criteria feedback| API

    Professor -->|OAuth consent| GoogleOAuth[Google OAuth 2.0]
    GoogleOAuth -->|Authorization code callback| API
    API -->|Encrypted OAuth credentials| DB

    API -->|Gmail API send| Gmail[Gmail API]
    Gmail -->|Confirmation feedback notification emails| EmailRecipients[Students and Professors]

    API -->|Email attempt records| DB
```

The React frontend is the user workspace. The FastAPI backend owns authentication, business rules, database persistence, AI orchestration, Gmail OAuth, and email delivery. PostgreSQL stores users, academic entities, submissions, evaluations, Gmail accounts, and email logs.

---

## User Roles and Workflows

### Professor Workflow

```mermaid
flowchart TD
    A[Register or log in as professor] --> B[Connect Gmail account in Settings]
    B --> C[Create subject]
    C --> D[Create project with topic]
    D --> E[Assign project Gmail account or subject default]
    E --> F[Monitor enrollments in professor dashboard]
    F --> G[Open student detail]
    G --> H[Review submitted deliverables and AI feedback]
    H --> I{Override needed?}
    I -->|No| J[Keep AI score]
    I -->|Yes| K[Submit manual override score and comment]
    K --> L[Student receives override feedback email]
```

### Student Workflow

```mermaid
flowchart TD
    A[Register or log in as student] --> B[Browse subjects]
    B --> C[Choose project]
    C --> D[Create enrollment]
    D --> E[Open workspace timeline]
    E --> F[Submit Deliverable 1]
    F --> G[Wait for AI evaluation]
    G --> H[View score and feedback]
    H --> I{More deliverables?}
    I -->|Yes| J[Next deliverable unlocks after previous evaluation]
    J --> K[Submit next deliverable]
    K --> G
    I -->|No| L[Project completed]
```

### Submission-to-Evaluation Workflow

```mermaid
flowchart TD
    A[Student submits deliverable] --> B[Backend validates role and enrollment ownership]
    B --> C[Sequential submission rule check]
    C --> D[Submission stored with 7 day deadline]
    D --> E[Background task: confirmation and professor notification emails]
    D --> F[Background task: AI evaluation]
    F --> G[Fetch previous submissions for same enrollment]
    G --> H[Build deliverable-specific Gemini prompt]
    H --> I[Gemini returns structured JSON]
    I --> J[Validate score criteria and feedback]
    J --> K[Store Evaluation]
    K --> L[Mark submission evaluated and unlock next deliverable]
    L --> M[Send feedback email]
    M --> N[Write EmailLog entry]
```

### Gmail and Notification Workflow

```mermaid
flowchart TD
    A[Professor clicks Connect Gmail] --> B[Frontend requests authorization URL]
    B --> C[Backend creates OAuth state and Google authorization URL]
    C --> D[OAuth popup opens]
    D --> E[Professor grants Gmail send access]
    E --> F[Google redirects to backend callback]
    F --> G[Backend exchanges code for tokens]
    G --> H[Backend detects Gmail account email]
    H --> I[Credentials encrypted with Fernet]
    I --> J[GmailAccount stored in PostgreSQL]
    J --> K[Settings page refreshes account list]

    L[Submission or evaluation event] --> M[Resolve sender account]
    M --> N[Refresh expired token if needed]
    N --> O[Send HTML email through Gmail API]
    O --> P[Store EmailLog success or failure]
```

---

## Tech Stack

| Area | Technology | Purpose |
|---|---|---|
| Frontend | React 19, Vite, JavaScript | SPA user interface for students and professors |
| Frontend Styling | Tailwind CSS | Responsive UI styling and dashboard layout |
| Frontend Routing | React Router DOM | Public, private, and professor-only routes |
| HTTP Client | Axios | REST API communication with JWT interceptor |
| Backend | FastAPI, Uvicorn | REST API and business logic |
| Database ORM | SQLAlchemy 2 async | Async database access and model relationships |
| Database | PostgreSQL | Persistent relational storage |
| Migrations | Alembic | Database schema migrations |
| Authentication | JWT with `python-jose`, bcrypt with Passlib | Role-based authenticated access |
| AI | Google Gemini via `google-genai` | Deliverable evaluation and feedback generation |
| Email/OAuth | Gmail API, Google OAuth 2.0 | Gmail account connection and email delivery |
| Credential Encryption | Fernet from `cryptography` | Encrypting Gmail OAuth payloads at rest |
| Testing | pytest, pytest-asyncio | Backend unit/integration tests and live evaluator tests |
| Deployment | Railway backend config, Vite-compatible frontend hosting | Production deployment readiness |

---

## Repository Structure

```text
AI_Agent_for_auto-grading/
├── backend/
│   ├── app/
│   │   ├── ai/
│   │   │   ├── dispatcher.py
│   │   │   ├── evaluator.py
│   │   │   └── prompts.py
│   │   ├── core/
│   │   │   ├── config.py
│   │   │   ├── crypto.py
│   │   │   └── security.py
│   │   ├── db/
│   │   │   ├── base.py
│   │   │   └── session.py
│   │   ├── routers/
│   │   │   ├── auth.py
│   │   │   ├── enrollments.py
│   │   │   ├── evaluations.py
│   │   │   ├── gmail_auth.py
│   │   │   ├── professor.py
│   │   │   ├── professor_detail.py
│   │   │   ├── projects.py
│   │   │   ├── settings.py
│   │   │   ├── subjects.py
│   │   │   └── submissions.py
│   │   ├── schemas/
│   │   ├── services/
│   │   │   ├── email_dispatch.py
│   │   │   ├── email_log_service.py
│   │   │   ├── email_resolver.py
│   │   │   ├── email_service.py
│   │   │   ├── email_templates.py
│   │   │   └── submission_rules.py
│   │   ├── deps.py
│   │   ├── main.py
│   │   └── models.py
│   ├── migrations/
│   │   ├── env.py
│   │   └── versions/
│   ├── scripts/
│   │   ├── seed.py
│   │   ├── test_gemini_connection.py
│   │   ├── test_gemini_evaluator.py
│   │   ├── test_all_evaluators.py
│   │   ├── test_gmail_send.py
│   │   ├── check_email_logs.py
│   │   ├── check_latest_evaluations.py
│   │   └── week6_*.py
│   ├── tests/
│   │   ├── conftest.py
│   │   ├── test_auth.py
│   │   ├── test_evaluator.py
│   │   └── test_gmail.py
│   ├── alembic.ini
│   ├── railway.json
│   └── requirements.txt
├── frontend/
│   ├── scripts/
│   │   └── week6_day3_frontend_async_audit.mjs
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── data/
│   │   ├── pages/
│   │   │   └── professor/
│   │   ├── routes/
│   │   ├── services/
│   │   ├── utils/
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── package.json
│   └── README.md
└── docs/
    ├── week6-day2-security-and-resolver-audit.md
    ├── week6-day3-frontend-and-full-regression (1).md
    └── week7/
        └── production-backend-deployment.md
```

This tree focuses on the files and folders that are relevant to the platform architecture. Some generated files, migration revisions, build artifacts, and standard frontend configuration files may be omitted from this overview.

---

## Backend Architecture

The backend is a FastAPI application centered on explicit route modules, SQLAlchemy models, service modules, and AI/email orchestration.

### Application Entry Point

`backend/app/main.py` creates the FastAPI app, configures CORS, registers all routers, and exposes `/` and `/health` endpoints. CORS origins are read from `ALLOWED_ORIGINS`, with local Vite origins as defaults.

### Route Groups

| Router | Responsibility |
|---|---|
| `auth.py` | User registration, login, and current user profile |
| `gmail_auth.py` | Gmail OAuth authorize/callback popup flow |
| `settings.py` | Gmail account listing, deletion, subject defaults, and test emails |
| `subjects.py` | Subject CRUD, nested project CRUD, Gmail assignment |
| `projects.py` | Professor view of project enrollments |
| `enrollments.py` | Student enrollment and enrollment progress views |
| `submissions.py` | Submission creation, submission retrieval, background AI/email tasks |
| `evaluations.py` | Evaluation retrieval and professor score override |
| `professor.py` | Normalized professor dashboard rows |
| `professor_detail.py` | Detailed professor view of one enrollment, deliverables, feedback, and email logs |

### Dependency Injection

`app/deps.py` defines the core request dependencies:

- `get_current_user` validates a JWT bearer token and loads the active user.
- `get_current_professor` restricts access to professor users.
- `get_current_student` restricts access to student users.

### Authentication Flow

1. User registers with name, email, password, and role.
2. Password is hashed with bcrypt through Passlib.
3. User logs in using JSON or OAuth2-compatible form fields.
4. Backend returns a JWT access token.
5. Frontend stores the token and attaches it as `Authorization: Bearer <token>` through the Axios interceptor.

### SQLAlchemy and Alembic

The data model lives in `backend/app/models.py`. Alembic is configured under `backend/migrations/`, and `migrations/env.py` forces Alembic to use `settings.sync_database_url`, which converts Railway-style PostgreSQL URLs into a psycopg2-compatible SQLAlchemy URL for migrations.

### Service Layer

| Service | Purpose |
|---|---|
| `submission_rules.py` | Enforces deliverable order and previous-evaluation requirement |
| `email_resolver.py` | Selects the correct Gmail sender account for a project |
| `email_service.py` | Decrypts credentials, refreshes tokens, builds Gmail API service, sends HTML email |
| `email_dispatch.py` | Sends submission confirmation and professor notification emails |
| `email_log_service.py` | Persists every email attempt |
| `email_templates.py` | Builds HTML email templates |
| `ai/evaluator.py` | Calls Gemini, validates JSON output, normalizes scores |
| `ai/dispatcher.py` | Fetches context, runs evaluation, saves results, sends feedback emails |

---

## Database Model

```mermaid
erDiagram
    USER ||--o{ SUBJECT : owns
    USER ||--o{ ENROLLMENT : enrolls
    USER ||--o{ GMAIL_ACCOUNT : connects
    USER ||--o{ EVALUATION : overrides

    SUBJECT ||--o{ PROJECT : contains
    SUBJECT ||--o{ GMAIL_ACCOUNT : default_sender

    PROJECT ||--o{ ENROLLMENT : has
    GMAIL_ACCOUNT ||--o{ PROJECT : sends_for

    ENROLLMENT ||--o{ SUBMISSION : includes
    SUBMISSION ||--|| EVALUATION : receives
    SUBMISSION ||--o{ EMAIL_LOG : records

    USER {
        int id PK
        string name
        string email UK
        string hashed_password
        string role
        boolean is_active
        datetime created_at
        datetime updated_at
    }

    SUBJECT {
        int id PK
        string name
        text description
        int professor_id FK
        datetime created_at
        datetime updated_at
    }

    PROJECT {
        int id PK
        string name
        text description
        string topic
        int subject_id FK
        int gmail_account_id FK
        datetime created_at
        datetime updated_at
    }

    ENROLLMENT {
        int id PK
        int student_id FK
        int project_id FK
        string status
        int current_deliverable
        datetime enrolled_at
        datetime created_at
        datetime updated_at
    }

    SUBMISSION {
        int id PK
        int enrollment_id FK
        int deliverable_number
        text content
        string status
        datetime submitted_at
        datetime deadline_at
        boolean email_sent
        text email_error
    }

    EVALUATION {
        int id PK
        int submission_id FK
        int ai_score
        json criteria_breakdown
        text feedback
        datetime evaluated_at
        boolean is_overridden
        int override_score
        text override_comment
        int override_by_professor_id FK
        datetime override_at
    }

    GMAIL_ACCOUNT {
        int id PK
        string account_email
        text credentials_json
        int subject_id FK
        int professor_id FK
        boolean is_active
        datetime created_at
    }

    EMAIL_LOG {
        int id PK
        int submission_id FK
        string email_type
        string recipient_email
        string gmail_account_used
        datetime sent_at
        text error_message
    }
```

### Relationship Summary

- A professor owns many subjects.
- A subject contains many projects.
- A student enrolls in projects through `Enrollment`.
- A student can only have one active project per subject, enforced by enrollment logic.
- Each enrollment has up to four submissions, one per deliverable number.
- Each submission can have one evaluation.
- Each evaluation stores the AI score, criteria JSON, feedback, and optional professor override fields.
- Gmail accounts belong to professors and can be assigned at subject or project level.
- Email logs belong to submissions and record success or failure for confirmation, professor notification, feedback, and override feedback emails.

---

## API Overview

| Method | Endpoint | Purpose | Access |
|---|---|---|---|
| `GET` | `/` | Backend status message | Public |
| `GET` | `/health` | Health check | Public |
| `POST` | `/auth/register` | Register student or professor | Public |
| `POST` | `/auth/login` | Login and receive JWT | Public |
| `GET` | `/auth/me` | Read current authenticated user | Authenticated |
| `GET` | `/auth/gmail/authorize` | Start Gmail OAuth flow | Professor |
| `GET` | `/auth/gmail/callback` | Google OAuth callback | OAuth callback |
| `GET` | `/settings/gmail-accounts` | List connected Gmail accounts | Professor |
| `DELETE` | `/settings/gmail-accounts/{gmail_account_id}` | Disconnect Gmail account | Professor |
| `POST` | `/settings/gmail-accounts/{gmail_account_id}/set-default` | Set subject-level default Gmail account | Professor |
| `POST` | `/settings/gmail-accounts/{gmail_account_id}/test` | Send test email from connected account | Professor |
| `GET` | `/subjects` | List professor subjects or all subjects for students | Authenticated |
| `POST` | `/subjects` | Create subject | Professor |
| `PUT` | `/subjects/{subject_id}` | Update subject | Professor owner |
| `DELETE` | `/subjects/{subject_id}` | Delete subject | Professor owner |
| `GET` | `/subjects/{subject_id}/projects` | List projects in a subject | Authenticated, scoped |
| `POST` | `/subjects/{subject_id}/projects` | Create project | Professor owner |
| `PUT` | `/subjects/{subject_id}/projects/{project_id}` | Update project | Professor owner |
| `DELETE` | `/subjects/{subject_id}/projects/{project_id}` | Delete project | Professor owner |
| `PATCH` | `/subjects/projects/{project_id}/gmail-account` | Assign Gmail account to project | Professor owner |
| `GET` | `/projects/{project_id}/enrollments` | List enrollments for a project | Professor owner |
| `POST` | `/enrollments` | Enroll student in project | Student |
| `GET` | `/enrollments` | List student enrollments or professor-owned enrollments | Authenticated |
| `GET` | `/enrollments/{enrollment_id}/submissions` | List submissions with evaluations for an enrollment | Student owner or professor owner |
| `POST` | `/submissions` | Submit deliverable and trigger background emails/evaluation | Student owner |
| `GET` | `/submissions/{submission_id}` | Read submission | Student owner or professor owner |
| `GET` | `/submissions/enrollment/{enrollment_id}` | List submissions for enrollment | Student owner or professor owner; verify route behavior locally because it is declared after a dynamic submission route |
| `GET` | `/submissions/{submission_id}/evaluation` | Read evaluation or pending status | Student owner or professor owner |
| `POST` | `/evaluations/{evaluation_id}/override` | Override AI score | Professor owner |
| `PATCH` | `/evaluations/{evaluation_id}/override` | Override AI score | Professor owner |
| `GET` | `/professor/dashboard/enrollments` | Professor dashboard table rows | Professor |
| `GET` | `/professor/enrollments/{enrollment_id}/detail` | Detailed student/enrollment view | Professor owner |

---

## AI Evaluation Pipeline

The AI evaluation system is implemented in `backend/app/ai/`.

### Deliverable-Specific Rubrics

| Deliverable | Criteria |
|---|---|
| Deliverable 1 — Research + Motivation Letter | Research depth 25, Source quality 20, Motivation clarity 30, Writing structure 25 |
| Deliverable 2 — User Requirements List | REQ format correctness 20, No ambiguity 25, Completeness 30, Traceability to D1 25 |
| Deliverable 3 — Target Group Interview Questions | Question quality 35, Coverage of new use cases 35, Variety and depth 30 |
| Deliverable 4 — Updated Requirements List | Integration of D3 findings 40, Consistency with D1+D2 30, Document maturity 30 |

### Evaluation Behavior

1. A student submits a deliverable through `/submissions`.
2. The backend stores the submission and starts a background evaluation task.
3. The dispatcher loads the submission, enrollment, student, project, and previous submissions.
4. Previous submissions include content, previous AI scores, and feedback when available.
5. The evaluator selects the prompt builder for deliverable 1, 2, 3, or 4.
6. Gemini is called with a strict JSON output contract.
7. The backend parses the response, strips Markdown fences if necessary, extracts JSON, coerces scores, validates criteria, and normalizes the final score.
8. A successful evaluation is saved to the `evaluations` table.
9. The submission is marked as evaluated.
10. The enrollment advances to the next deliverable or is marked completed after deliverable 4.
11. A feedback email is sent to the student and logged.

### Output Format

The evaluator expects Gemini to return:

```json
{
  "score": 0,
  "criteria": {
    "Criterion name": 0
  },
  "feedback": "Detailed constructive feedback"
}
```

### Failure Handling

If Gemini evaluation fails, the current code does not create a fake `0/100` evaluation. Instead, it keeps the submission in submitted state and stores an `AI evaluation failed: ...` message in `submission.email_error` for debugging. This prevents the frontend from incorrectly treating a failed AI call as a graded deliverable.

```mermaid
sequenceDiagram
    actor Student
    participant Frontend as React Frontend
    participant API as FastAPI Backend
    participant DB as PostgreSQL
    participant Gemini as Google Gemini
    participant Gmail as Gmail API

    Student->>Frontend: Submit deliverable
    Frontend->>API: POST /submissions with JWT
    API->>DB: Validate enrollment and sequence
    API->>DB: Insert Submission
    API-->>Frontend: Submission created

    API->>API: Background run_evaluation
    API->>DB: Load submission graph and previous context
    API->>Gemini: Send deliverable-specific prompt
    Gemini-->>API: JSON score criteria feedback
    API->>API: Parse and validate response
    API->>DB: Insert Evaluation and update Submission status
    API->>DB: Advance Enrollment current_deliverable
    API->>Gmail: Send feedback email
    API->>DB: Insert EmailLog
```

---

## Gmail Integration

The Gmail integration is one of the most production-oriented parts of the project. It supports real Google OAuth and real email delivery through Gmail API.

### OAuth Connection

- Professors open the Gmail connection flow from `/professor/settings`.
- The frontend asks the backend for an authorization URL using `/auth/gmail/authorize?return_url=true`.
- The backend creates a JWT-based OAuth state containing the professor ID and PKCE code verifier.
- Google redirects to `/auth/gmail/callback`.
- The backend exchanges the code for credentials, verifies the Google ID token, extracts the Gmail address, encrypts the credential JSON, and stores or updates a `GmailAccount` row.
- The callback returns a small HTML page that posts a `GMAIL_CONNECTED` message to the opener window.

### Sender Resolution

When the platform needs to send an email, `email_resolver.py` selects the sender account in this order:

1. Project-level Gmail account.
2. Subject-level Gmail default account.
3. Professor personal active Gmail account with no subject assignment.
4. Last-resort active professor Gmail account.
5. Clear failure if no account is available.

### Email Types

| Email type | Trigger | Recipient |
|---|---|---|
| `confirmation` | Student submits a deliverable | Student |
| `professor_notification` | Student submits a deliverable | Professor |
| `feedback` | AI evaluation completes | Student |
| `override_feedback` | Professor overrides score | Student |

### Credential Security

- Gmail OAuth payloads are stored in `GmailAccount.credentials_json`.
- The payload is encrypted with Fernet using `FERNET_KEY`.
- The backend supports token refresh and persists refreshed encrypted credentials.
- Credentials are not returned by the settings API response.

```mermaid
sequenceDiagram
    actor Professor
    participant Frontend as React Settings Page
    participant API as FastAPI Backend
    participant Google as Google OAuth
    participant DB as PostgreSQL
    participant Gmail as Gmail API

    Professor->>Frontend: Click Connect New Gmail Account
    Frontend->>API: GET /auth/gmail/authorize?return_url=true
    API-->>Frontend: Google authorization URL
    Frontend->>Google: Open OAuth popup
    Professor->>Google: Grant Gmail send permission
    Google->>API: GET /auth/gmail/callback?code&state
    API->>Google: Exchange code for tokens
    Google-->>API: OAuth credentials and ID token
    API->>API: Verify ID token and Gmail address
    API->>DB: Store encrypted Gmail credentials
    API-->>Frontend: postMessage GMAIL_CONNECTED

    API->>DB: Resolve Gmail sender for project
    API->>API: Decrypt credentials and refresh if expired
    API->>Gmail: Send HTML email
    API->>DB: Save EmailLog
```

---

## Frontend Overview

The frontend is a React + Vite + TailwindCSS single-page application.

### Routing

`frontend/src/App.jsx` defines these primary routes:

| Route | Purpose |
|---|---|
| `/` | Redirects by role |
| `/login` | Login page |
| `/register` | Registration page with role selector |
| `/dashboard` | Student dashboard |
| `/browse` | Subject and project browser |
| `/workspace/:enrollmentId` | Student deliverable workspace |
| `/professor/dashboard` | Professor dashboard |
| `/professor/manage` | Subject and project management |
| `/professor/settings` | Gmail account management and assignments |
| `/professor/student/:enrollmentId` | Student detail, deliverables, feedback, override, email history |

### Frontend Strengths

- JWT session storage and Axios authorization interceptor.
- Automatic redirect to login on non-auth request `401` responses.
- Student workspace with four-step deliverable timeline.
- Clear locked/open/submitted/evaluated state visualization.
- In-platform feedback card with score badge, criteria table, progress bars, and professor override display.
- Gmail settings page with OAuth popup pattern, connected accounts, test email button, subject defaults, and project assignments.
- Professor dashboard focused on progress, scores, activity, status, and email health.
- Frontend async audit script to check loading/error states and email UX messaging.

---

## Screenshots

Add screenshots under `docs/screenshots/` using the file names below. These placeholders are intentionally stable so the README can be committed before images are added.

### Landing or Login Screen

![Login Screen](docs/screenshots/login-screen.png)

Recommended screenshot: show the login page with the final visual styling, including the email/password form and clear app identity.

### Professor Dashboard

![Professor Dashboard](docs/screenshots/professor-dashboard.png)

Recommended screenshot: show the professor dashboard after at least one evaluated submission, including student name, project, progress, latest score, status, and email status.

### Gmail Connection and Settings

![Gmail Settings](docs/screenshots/gmail-settings.png)

Recommended screenshot: show `/professor/settings` with at least one connected Gmail account, active status, Send Test Email button, and assignment controls.

### Subject and Project Management

![Subject and Project Management](docs/screenshots/subject-project-management.png)

Recommended screenshot: show the professor management page with at least one subject, project cards, project topic, and Gmail account assignment state.

### Student Submission Workspace

![Student Submission Workspace](docs/screenshots/student-submission-workspace.png)

Recommended screenshot: show the four-deliverable timeline with one deliverable open, one submitted or evaluated, and the sequential locking message visible.

### AI Feedback View

![AI Feedback View](docs/screenshots/ai-feedback-view.png)

Recommended screenshot: show a completed evaluation with final score, criterion breakdown, progress bars, and detailed feedback text.

### Gmail Inbox Email

![Gmail Inbox Email](docs/screenshots/gmail-feedback-email.png)

Recommended screenshot: show a real received Gmail feedback email with score, criteria, and feedback. Hide or blur private email addresses if necessary.

### Score Override Flow

![Score Override Flow](docs/screenshots/score-override-flow.png)

Recommended screenshot: show the professor student-detail page with the override form or an already overridden evaluation showing AI score and professor score.

---

## Local Setup

### Prerequisites

- Python 3.11 or newer recommended.
- Node.js compatible with the frontend dependencies.
- PostgreSQL database.
- Google Cloud project with Gmail API enabled.
- OAuth 2.0 web application credentials.
- Gemini API key.

### Backend Setup

From the repository root:

```bash
cd backend
python -m venv .venv
```

Activate the virtual environment.

Windows PowerShell:

```bash
.\.venv\Scripts\Activate.ps1
```

macOS/Linux:

```bash
source .venv/bin/activate
```

Install dependencies:

```bash
pip install -r requirements.txt
```

Create `backend/.env` with the variables shown in [Environment Variables](#environment-variables).

Run database migrations:

```bash
alembic upgrade head
```

Start the backend:

```bash
uvicorn app.main:app --reload
```

Backend default local URL:

```text
http://127.0.0.1:8000
```

Swagger docs:

```text
http://127.0.0.1:8000/docs
```

### Frontend Setup

In a second terminal:

```bash
cd frontend
npm install
npm run dev
```

Frontend default local URL:

```text
http://localhost:5173
```

### Database Setup

Create a PostgreSQL database and set `DATABASE_URL` in `backend/.env`. The application uses SQLAlchemy async at runtime and Alembic synchronous migrations. The settings layer automatically converts standard PostgreSQL URLs into the correct async or sync driver format.

Example format:

```text
DATABASE_URL=postgresql://postgres:password@localhost:5432/se_autograder
```

### Useful Backend Scripts

Run these from `backend/` with the virtual environment activated.

```bash
python scripts/seed.py
python scripts/test_gemini_connection.py
python scripts/test_gemini_evaluator.py
python scripts/test_all_evaluators.py
python scripts/test_gmail_send.py
python scripts/check_email_logs.py
python scripts/check_latest_evaluations.py
```

Week 6 validation scripts are also available under `backend/scripts/week6_*.py` for multi-account Gmail routing, token expiry, resolver checks, override inspection, security audit preparation, and regression validation.

### Useful Frontend Scripts

Run from `frontend/`:

```bash
npm run dev
npm run build
npm run lint
npm run preview
npm run audit:week6-day3
```

---

## Environment Variables

Never commit real secrets. Use local `.env` files and production platform environment variables.

### Backend Environment Variables

| Variable | Purpose | Required | Example format |
|---|---|---:|---|
| `DATABASE_URL` | PostgreSQL connection URL | Yes | `postgresql://user:password@host:5432/dbname` |
| `SECRET_KEY` | JWT signing key and OAuth state signing | Yes | `long-random-secret` |
| `ALGORITHM` | JWT signing algorithm | Optional | `HS256` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT expiration window | Optional | `10080` |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID | Yes | `xxxxx.apps.googleusercontent.com` |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret | Yes | `GOCSPX-xxxxx` |
| `GOOGLE_REDIRECT_URI` | Gmail OAuth callback URL | Yes | `http://localhost:8000/auth/gmail/callback` |
| `GEMINI_API_KEY` | Google Gemini API key | Yes | `AIza...` |
| `FERNET_KEY` | Fernet key for encrypted Gmail credentials | Yes | Generated by `Fernet.generate_key()` |
| `BACKEND_URL` | Public backend URL | Optional | `http://127.0.0.1:8000` |
| `FRONTEND_URL` | Public frontend URL used in email templates | Optional | `http://localhost:5173` |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins | Optional | `http://localhost:5173,https://your-app.vercel.app` |
| `OAUTHLIB_INSECURE_TRANSPORT` | Allows local HTTP OAuth during development | Local only | `1` |
| `GEMINI_MODEL` | Primary Gemini model override used by evaluator | Optional | `gemini-1.5-flash` |
| `GEMINI_FALLBACK_MODEL` | Fallback Gemini model override | Optional | `gemini-1.5-flash` |
| `RUN_LIVE_GEMINI_TESTS` | Enables live Gemini pytest cases | Optional | `1` |
| `GEMINI_TEST_DELAY_SECONDS` | Delay between live Gemini test calls | Optional | `7` |

Generate a Fernet key:

```bash
python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Frontend Environment Variables

| Variable | Purpose | Required | Example format |
|---|---|---:|---|
| `VITE_API_URL` | Base URL for the FastAPI backend | Yes in production | `https://your-backend.railway.app` |

Local development can omit `VITE_API_URL` because the frontend defaults to `http://127.0.0.1:8000`.

---

## Production Deployment

### Backend

The repository includes `backend/railway.json`. It uses Railway Nixpacks and starts the service with:

```bash
alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT
```

Production backend requirements:

- Railway PostgreSQL database or another PostgreSQL provider.
- All backend environment variables configured in Railway.
- `GOOGLE_REDIRECT_URI` set exactly to the production backend callback URL.
- `ALLOWED_ORIGINS` containing the production frontend origin.
- `FRONTEND_URL` set to the production frontend URL so email buttons point to the deployed app.

### Frontend

The frontend is a Vite app and can be deployed on Vercel or another static frontend host. Set:

```text
VITE_API_URL=https://your-backend-domain
```

The backend CORS configuration must include the frontend domain.

### Google OAuth Production Notes

In Google Cloud Console, configure:

- Authorized redirect URI: `https://your-backend-domain/auth/gmail/callback`
- Authorized JavaScript origin: `https://your-frontend-domain`

The redirect URI must match exactly, including protocol, domain, path, and trailing slash behavior.

### Production Smoke Testing

After deployment, run the complete smoke test below before using the app for a demo or evaluation.

---

## Production Smoke Test Checklist

- [ ] Open the production frontend URL.
- [ ] Register a professor account.
- [ ] Log in as professor.
- [ ] Open `/professor/settings`.
- [ ] Connect a Gmail account through the OAuth popup.
- [ ] Confirm the Gmail account appears as active.
- [ ] Send a test email from the connected Gmail account.
- [ ] Create a subject.
- [ ] Create a project with name, description, and topic.
- [ ] Assign the connected Gmail account to the project or set it as the subject default.
- [ ] Register a student account.
- [ ] Log in as student.
- [ ] Browse subjects and select the professor project.
- [ ] Enroll in the project.
- [ ] Submit Deliverable 1 with enough content for evaluation.
- [ ] Confirm the student receives the confirmation email.
- [ ] Confirm the professor receives the submission notification email.
- [ ] Wait for AI evaluation to complete.
- [ ] Confirm the student receives the AI feedback email.
- [ ] Confirm the student sees the feedback in the workspace.
- [ ] Log in as professor.
- [ ] Confirm the professor dashboard shows progress, score, status, and email health.
- [ ] Open the student detail page.
- [ ] Override the score with a manual comment.
- [ ] Confirm the student receives the override feedback email.
- [ ] Confirm EmailLog entries exist for confirmation, professor notification, feedback, and override feedback.
- [ ] Check Railway logs for server errors.
- [ ] Check browser console for frontend errors.

---

## Security Considerations

### Implemented Security Controls

- Passwords are hashed with bcrypt through Passlib.
- JWT bearer tokens protect authenticated endpoints.
- Professor and student access guards are implemented in backend dependencies and route checks.
- Students cannot submit for another student's enrollment.
- Professors can only view or override evaluations that belong to their own subjects/projects.
- Gmail OAuth credentials are encrypted at rest with Fernet.
- Gmail API tokens can be refreshed automatically when expired.
- Gmail credentials are not exposed through normal settings responses.
- CORS uses explicit origins rather than wildcard origins with credentials.
- Database constraints enforce score ranges, unique submissions per deliverable, unique subject/project names per scope, and deliverable number ranges.

### Security Notes

- `OAUTHLIB_INSECURE_TRANSPORT=1` should only be used for local HTTP OAuth development.
- `SECRET_KEY`, `FERNET_KEY`, `GOOGLE_CLIENT_SECRET`, `GEMINI_API_KEY`, and `DATABASE_URL` must be stored as secrets.
- The Google OAuth consent screen and redirect URIs must be configured separately for local and production environments.
- Because Gmail sending is tied to professor-connected accounts, production use should document Gmail API quota limits and account policies.

---

## Testing and Validation

### Backend Tests

| File | Purpose |
|---|---|
| `backend/tests/test_auth.py` | Tests registration, login, JWT response, and bad credentials |
| `backend/tests/test_gmail.py` | Tests Gmail credential decryption and expired-token refresh behavior with mocks |
| `backend/tests/test_evaluator.py` | Live Gemini evaluator tests for all deliverables, skipped unless `RUN_LIVE_GEMINI_TESTS=1` |
| `backend/tests/conftest.py` | Test configuration and fixtures |

Run backend tests:

```bash
cd backend
pytest -v
```

Run live Gemini tests:

```bash
cd backend
RUN_LIVE_GEMINI_TESTS=1 pytest tests/test_evaluator.py -v
```

On Windows PowerShell:

```bash
cd backend
$env:RUN_LIVE_GEMINI_TESTS="1"
pytest tests/test_evaluator.py -v
```

### Backend Validation Scripts

| Script | Purpose |
|---|---|
| `scripts/seed.py` | Creates seed users, subjects, projects, enrollments, and mock Gmail-aware data |
| `scripts/test_gemini_connection.py` | Checks Gemini API connectivity |
| `scripts/test_gemini_evaluator.py` | Runs a standalone evaluator test |
| `scripts/test_all_evaluators.py` | Tests all four deliverable evaluators |
| `scripts/test_gmail_send.py` | Sends a real Gmail test email |
| `scripts/check_email_logs.py` | Inspects stored email logs |
| `scripts/check_latest_evaluations.py` | Inspects recent evaluation records |
| `scripts/check_week3_final_integration.py` | Checks submission/evaluation/email integration state |
| `scripts/week6_verify_multi_account_routing.py` | Validates Gmail sender routing in multi-account scenarios |
| `scripts/week6_expire_gmail_token.py` | Forces token expiry to test refresh behavior |
| `scripts/week6_day2_security_audit.py` | Runs security and permission-oriented validation |
| `scripts/week6_day3_full_regression.py` | Runs a fuller regression workflow |
| `scripts/week6_day3_email_log_summary.py` | Summarizes email logs for a regression student |

### Frontend Validation

The frontend includes an async UX audit script:

```bash
cd frontend
npm run audit:week6-day3
```

It scans UI files for visible loading states, error states, cleanup/finally behavior, and email-specific user messages around OAuth, test emails, and submission email failures.

---

## Known Limitations

- No root-level README was detected before this generated README; existing documentation is distributed across `docs/` and the frontend README.
- The data model supports overdue states, and the UI displays overdue status when present, but no dedicated scheduler or background job was found that automatically marks unlocked deliverables as overdue after seven days.
- `deadline_at` is stored on submission creation. There is no separate unlock timestamp model for measuring the full one-week window before a student submits the next deliverable.
- AI evaluation runs as a FastAPI background task, not through a durable queue. If the server process stops during evaluation, a job queue would be more reliable.
- The evaluator depends on Gemini API availability, quotas, and model behavior.
- Live Gemini tests are intentionally skipped unless explicitly enabled because they call an external paid or quota-limited service.
- Gmail sending depends on connected Gmail accounts and Google OAuth configuration.
- Subject-level Gmail default clearing is not fully supported by the current frontend/backend flow; the Settings UI reports this explicitly.
- One submissions route, `/submissions/enrollment/{enrollment_id}`, should be verified locally because it is declared after the dynamic `/submissions/{submission_id}` route.
- There is no evidence of an administrator role beyond student and professor.

---

## Roadmap

- Add a durable background queue for AI evaluation and email dispatch, such as Celery, RQ, or a managed queue.
- Add a scheduler to automatically mark deliverables as overdue based on unlock timestamps.
- Store unlock timestamps separately from submission deadlines.
- Add a professor-facing rubric editor for changing criteria and weights per project.
- Add exportable PDF or CSV reports for grades, feedback, and email logs.
- Add analytics across subjects, projects, students, and deliverable performance.
- Add observability with structured logs, request IDs, and error monitoring.
- Add a stronger admin panel for user and system management.
- Add multi-language UI support.
- Add richer evaluation review tools, including professor approval before sending feedback.
- Add notification preferences for students and professors.
- Add integration tests for the full production journey with mocked Gmail and Gemini providers.

---

## Portfolio Value

This project is a strong portfolio piece because it demonstrates much more than a basic CRUD application:

- Full-stack architecture with a real React frontend and FastAPI backend.
- Role-based authentication with JWT.
- Relational data modeling for an academic workflow.
- SQLAlchemy async usage with Alembic migrations.
- Real Google OAuth flow for connecting Gmail accounts.
- Secure credential encryption at rest.
- Real Gmail API email delivery with HTML templates.
- Email audit logging for operational transparency.
- AI-powered evaluation with prompt engineering, structured JSON validation, rubric scoring, and cumulative context.
- Professor dashboard and override workflow reflecting real educational supervision needs.
- Production deployment considerations for Railway, Vite/Vercel-style frontend hosting, CORS, OAuth redirects, and smoke testing.

The result is a credible, end-to-end, production-oriented academic platform that connects backend engineering, frontend UX, cloud deployment, OAuth security, database design, and applied AI.

---

## Author

**Ángel Pérez Castro**

Software Engineering project — AI-powered auto-grading platform for academic deliverables.
