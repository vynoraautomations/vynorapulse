# MailAlert Deployment Guide

## Backend Deployment

Recommended beginner options:

- Render
- Railway
- Fly.io

Production command:

```bash
uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT
```

Set production environment variables in your hosting provider dashboard.

Important:

- Update `FRONTEND_URL` to your deployed frontend URL.
- Update `BACKEND_URL` to your deployed backend URL.
- Update Google OAuth redirect URI to:

```text
https://your-backend-domain.com/api/gmail/callback
```

## Frontend Deployment

Recommended beginner options:

- Vercel
- Netlify

Build command:

```bash
npm run build
```

Output folder:

```text
dist
```

Set:

```text
VITE_API_BASE_URL=https://your-backend-domain.com
```

## Production Improvements

- Use PostgreSQL instead of SQLite.
- Encrypt OAuth tokens at rest.
- Use Gmail Pub/Sub push notifications instead of polling.
- Add email verification and password reset.
- Add background workers with Celery/RQ/APScheduler.
- Add monitoring with Sentry or OpenTelemetry.
