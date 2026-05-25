# MailAlert

MailAlert is a local-first automation system that watches Gmail for important student opportunities and sends instant WhatsApp alerts.

It includes:

- React + Tailwind frontend
- FastAPI backend
- SQLite database
- Gmail OAuth and email polling
- OpenAI classification and summarization
- Twilio WhatsApp notifications
- Signup, login, logout
- Dashboard with recent alerts, history, categories, priorities, search, notification toggle, and test notification

## Project Structure

```text
MailAlert/
  backend/
    app/
      api/
      core/
      db/
      models/
      schemas/
      services/
      main.py
    mailalert.db
  frontend/
    src/
      components/
      context/
      pages/
      services/
  docs/
  .env.example
  requirements.txt
  README.md
```

## 1. Backend Setup

```bash
cd MailAlert
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Edit `.env` and add your API keys.

Run the backend:

```bash
uvicorn backend.app.main:app --reload --host 0.0.0.0 --port 8000
```

Open API docs:

```text
http://localhost:8000/docs
```

## 2. Frontend Setup

```bash
cd MailAlert/frontend
npm install
npm run dev
```

Open:

```text
http://localhost:5173
```

## 3. Gmail API Setup

1. Go to Google Cloud Console: https://console.cloud.google.com/
2. Create a project named `MailAlert`.
3. Enable **Gmail API**.
4. Go to **APIs & Services > OAuth consent screen**.
5. Choose External for local testing, add your email as a test user.
6. Go to **Credentials > Create Credentials > OAuth client ID**.
7. Choose **Web application**.
8. Add authorized redirect URI:

```text
http://localhost:8000/api/gmail/callback
```

9. Copy the client ID and client secret into `.env`.

## 4. Twilio WhatsApp Setup

1. Create a Twilio account: https://www.twilio.com/
2. Open **Messaging > Try it out > Send a WhatsApp message**.
3. Join the sandbox from your WhatsApp phone by sending the displayed join code.
4. Put these values in `.env`:

```text
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=whatsapp:+14155238886
```

For the MVP, each user enters their own WhatsApp number during signup in this format:

```text
whatsapp:+919876543210
```

## 5. OpenAI Setup

1. Create an API key from https://platform.openai.com/api-keys
2. Add it to `.env`:

```text
OPENAI_API_KEY=sk-...
```

If `OPENAI_API_KEY` is missing, MailAlert uses local keyword rules so you can still test the app.

## 6. How To Use

1. Start backend and frontend.
2. Create an account.
3. Login.
4. Connect Gmail from the dashboard.
5. Turn notifications on.
6. Click **Start Monitoring**.
7. Use **Send Test Alert** to verify Twilio WhatsApp setup.

MailAlert polls Gmail every `POLL_INTERVAL_SECONDS`. For a production version, you can replace polling with Gmail Pub/Sub push notifications.

## Deployment

See [docs/deployment.md](docs/deployment.md).

## Security Notes

- This MVP stores Gmail OAuth tokens in SQLite for local development.
- Use HTTPS, encrypted secrets, and a managed database before production.
- Never commit `.env`.
- In production, use a strong `APP_SECRET_KEY`.
