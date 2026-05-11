# Week 7 — Production Backend Deployment

## Deployment target

The FastAPI backend was deployed to Railway using the backend root directory.

Production backend URL:

    https://aiagentforauto-grading-production.up.railway.app

## Verified production endpoints

The following production endpoints were manually verified:

    GET /health
    GET /docs

Both endpoints returned successful responses after deployment.

## Production database

Railway PostgreSQL was provisioned and connected to the backend through the DATABASE_URL environment variable.

The backend receives the production database URL from Railway and internally converts it depending on the execution context:

- FastAPI runtime uses an async SQLAlchemy URL with asyncpg.
- Alembic migrations use a synchronous SQLAlchemy URL with psycopg2.

This avoids the production crash caused by trying to use psycopg2 with SQLAlchemy's async engine.

## Alembic migrations

Alembic migrations are executed during service startup before launching Uvicorn.

Production start command:

    alembic upgrade head && python -m uvicorn app.main:app --host 0.0.0.0 --port $PORT --proxy-headers --forwarded-allow-ips="*"

The migrations were verified successfully in Railway logs:

    INFO  [alembic.runtime.migration] Context impl PostgresqlImpl.
    INFO  [alembic.runtime.migration] Will assume transactional DDL.

## Railway configuration

The Railway backend service was configured with:

    Root Directory: /backend
    Public Domain: https://aiagentforauto-grading-production.up.railway.app
    PORT: 8000

The service exposes FastAPI through Uvicorn on:

    0.0.0.0:8000

## Required production environment variables

The backend requires the following Railway environment variables:

    DATABASE_URL
    SECRET_KEY
    ALGORITHM
    ACCESS_TOKEN_EXPIRE_MINUTES
    GOOGLE_CLIENT_ID
    GOOGLE_CLIENT_SECRET
    GOOGLE_REDIRECT_URI
    GEMINI_API_KEY
    FERNET_KEY
    BACKEND_URL
    FRONTEND_URL
    ALLOWED_ORIGINS
    PORT

Sensitive values are not documented here for security reasons.

## Gmail OAuth production configuration

Google Cloud Console was updated with the production callback URL:

    https://aiagentforauto-grading-production.up.railway.app/auth/gmail/callback

The same value is configured in Railway as:

    GOOGLE_REDIRECT_URI=https://aiagentforauto-grading-production.up.railway.app/auth/gmail/callback

The OAuth redirect URI must match exactly in both places. Differences in protocol, path, domain, or trailing slash can cause redirect_uri_mismatch errors.

## OAuth production issue fixed

During production testing, the Gmail callback initially failed with:

    oauthlib.oauth2.rfc6749.errors.InsecureTransportError:
    OAuth 2 MUST utilize https.

The cause was that the callback handler passed the reconstructed request URL to Google OAuth:

    flow.fetch_token(authorization_response=str(request.url))

Behind Railway's proxy, the reconstructed URL could be interpreted as HTTP even though the public callback was HTTPS.

The fix was to build the authorization response using the configured HTTPS callback URL:

    authorization_response = f"{settings.GOOGLE_REDIRECT_URI}?{request.url.query}"

    flow.fetch_token(
        authorization_response=authorization_response,
    )

This forces OAuthlib to use the exact HTTPS callback registered in Google Cloud Console.

## Gmail OAuth validation

The Gmail OAuth flow was tested successfully in production.

Final observed result:

    Gmail account connected successfully

This confirms that:

- Google Cloud OAuth configuration is valid.
- Railway environment variables are correctly configured.
- The backend callback endpoint works in production.
- Gmail credentials can be stored in the production database.
- The FERNET_KEY encryption setup works in production.

## Current production status

Completed:

- Railway backend deployment.
- Railway PostgreSQL provisioning.
- Alembic production migration execution.
- FastAPI production health check.
- Swagger production availability.
- Gmail OAuth production flow.
- Gmail account connection in production.

Pending next steps:

- Verify the connected Gmail account through GET /settings/gmail-accounts.
- Send a production Gmail test email.
- Point the local frontend to the Railway backend using VITE_API_URL.
- Deploy the frontend to Vercel.
- Add the Vercel frontend URL to Railway ALLOWED_ORIGINS.
- Add the Vercel frontend URL to Google Cloud Authorized JavaScript Origins.
- Perform a full end-to-end production regression test.
