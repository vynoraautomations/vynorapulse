import base64
import logging
import os
from datetime import datetime, timedelta
from email.utils import parseaddr
from typing import Any
from urllib.parse import parse_qs, urlparse

import requests
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.models import GmailAccount, ImportantEmail, Notification, User
from backend.app.services.ai_service import AIService
from backend.app.services.whatsapp_service import WhatsAppService

logger = logging.getLogger(__name__)


# Always use a sorted, space-joined string for Google OAuth scopes
SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
]
SCOPES_STR = " ".join(sorted(SCOPES))


class GmailService:
    def __init__(self):
        self.ai = AIService()
        self.whatsapp = WhatsAppService()

    def _settings(self):
        return get_settings()

    def _gmail_redirect_uri(self) -> str:
        settings = self._settings()
        redirect_uri = (settings.gmail_redirect_uri or "").strip()
        if not redirect_uri:
            return f"{settings.backend_url.rstrip('/')}/api/gmail/callback"
        if redirect_uri.endswith("/api/v1/gmail/callback"):
            redirect_uri = redirect_uri.replace("/api/v1/gmail/callback", "/api/gmail/callback")
        if redirect_uri.endswith("/gmail/callback"):
            return redirect_uri
        return f"{redirect_uri.rstrip('/')}/api/gmail/callback"

    def build_oauth_flow(self, state: str | None = None) -> Flow:
        settings = self._settings()
        redirect_uri = self._gmail_redirect_uri()
        client_config = {
            "web": {
                "client_id": settings.gmail_client_id,
                "client_secret": settings.gmail_client_secret,
                "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                "token_uri": "https://oauth2.googleapis.com/token",
                "redirect_uris": [redirect_uri],
            }
        }
        # Always use sorted, space-joined scopes string for Google OAuth
        flow = Flow.from_client_config(client_config, scopes=SCOPES_STR.split(), state=state)
        flow.redirect_uri = redirect_uri
        flow.oauth2session.trust_env = False
        flow.oauth2session.proxies = {"http": None, "https": None}
        return flow

    def authorization_url(self, user_id: int) -> str:
        flow = self.build_oauth_flow(state=str(user_id))
        url, _ = flow.authorization_url(
            access_type="offline",
            include_granted_scopes="true",
            prompt="consent",
        )
        return url

    def _exchange_authorization_code(self, flow: Flow, authorization_response: str) -> dict[str, Any]:
        parsed = urlparse(authorization_response)
        query = parse_qs(parsed.query)
        code = query.get("code", [None])[0]
        if not code:
            raise ValueError("Missing OAuth code in callback response")

        token_uri = flow.client_config["token_uri"]
        data = {
            "code": code,
            "client_id": flow.client_config["client_id"],
            "client_secret": flow.client_config["client_secret"],
            "redirect_uri": self._gmail_redirect_uri(),
            "grant_type": "authorization_code",
        }

        old_proxy_env = {key: os.environ.pop(key, None) for key in ("HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy")}
        try:
            response = requests.post(
                token_uri,
                data=data,
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                proxies={"http": None, "https": None},
                timeout=30,
                allow_redirects=False,
            )
            response.raise_for_status()
            payload = response.json()
        finally:
            for key, value in old_proxy_env.items():
                if value is not None:
                    os.environ[key] = value

        if not payload.get("access_token"):
            raise ValueError(f"Token exchange failed: {payload}")
        return payload

    def save_callback_tokens(self, db: Session, user_id: int, authorization_response: str) -> GmailAccount:
        flow = self.build_oauth_flow(state=str(user_id))
        token_payload = self._exchange_authorization_code(flow, authorization_response)

        expires_in = token_payload.get("expires_in")
        expiry = None
        if expires_in is not None:
            expiry = datetime.utcnow() + timedelta(seconds=int(expires_in))

        creds = Credentials(
            token=token_payload.get("access_token", ""),
            refresh_token=token_payload.get("refresh_token", ""),
            token_uri=flow.client_config["token_uri"],
            client_id=flow.client_config["client_id"],
            client_secret=flow.client_config["client_secret"],
            scopes=token_payload.get("scope", SCOPES_STR).split(),
            expiry=expiry,
        )

        service = build("gmail", "v1", credentials=creds, cache_discovery=False)
        profile = service.users().getProfile(userId="me").execute()

        account = db.query(GmailAccount).filter(GmailAccount.user_id == user_id).first()
        if not account:
            account = GmailAccount(user_id=user_id, access_token=creds.token or "")
            db.add(account)
        account.gmail_email = profile.get("emailAddress", "")
        account.access_token = creds.token or ""
        account.refresh_token = creds.refresh_token or account.refresh_token
        account.token_uri = creds.token_uri
        account.scopes = token_payload.get("scope", SCOPES_STR)
        account.last_history_id = str(profile.get("historyId", ""))
        account.monitoring_enabled = True
        account.last_checked_at = datetime.utcnow()
        db.commit()
        db.refresh(account)
        return account

    def _credentials_from_account(self, account: GmailAccount) -> Credentials:
        settings = self._settings()
        return Credentials(
            token=account.access_token,
            refresh_token=account.refresh_token,
            token_uri=account.token_uri,
            client_id=settings.gmail_client_id,
            client_secret=settings.gmail_client_secret,
            scopes=account.scopes.split() if account.scopes else SCOPES,
        )

    def _extract_message(self, message: dict[str, Any]) -> dict[str, str]:
        payload = message.get("payload", {})
        headers = {h.get("name", "").lower(): h.get("value", "") for h in payload.get("headers", [])}
        subject = headers.get("subject", "(No subject)")
        sender = parseaddr(headers.get("from", ""))[0] or headers.get("from", "Unknown sender")
        snippet = message.get("snippet", "")
        body = self._extract_body(payload) or snippet
        return {"sender": sender, "subject": subject, "snippet": snippet, "body": body}

    def _extract_body(self, payload: dict[str, Any]) -> str:
        parts = payload.get("parts", [])
        data = payload.get("body", {}).get("data")
        if data:
            return self._decode_body(data)
        for part in parts:
            mime_type = part.get("mimeType", "")
            if mime_type == "text/plain" and part.get("body", {}).get("data"):
                return self._decode_body(part["body"]["data"])
            nested = self._extract_body(part)
            if nested:
                return nested
        return ""

    def _decode_body(self, data: str) -> str:
        try:
            return base64.urlsafe_b64decode(data.encode("utf-8")).decode("utf-8", errors="ignore")
        except Exception:
            return ""

    async def poll_user_mailbox(self, db: Session, user: User) -> int:
        account = user.gmail_account
        if not account or not account.monitoring_enabled:
            return 0

        service = build("gmail", "v1", credentials=self._credentials_from_account(account), cache_discovery=False)
        query = "newer_than:7d -category:promotions -category:social"
        results = service.users().messages().list(userId="me", q=query, maxResults=10).execute()
        messages = results.get("messages", [])
        saved_count = 0

        for item in messages:
            if db.query(ImportantEmail).filter(ImportantEmail.gmail_message_id == item["id"]).first():
                continue
            message = service.users().messages().get(userId="me", id=item["id"], format="full").execute()
            extracted = self._extract_message(message)
            # Build highly personalized profile context for AI filtering
            goals_list = [g.goal for g in user.user_goals]
            keywords_list = [k.keyword for k in user.keywords]
            
            user_profile_context = (
                f"Career Category/Type: {user.user_type} ({user.user_mode})\n"
                f"Selected Category: {user.selected_category}\n"
                f"Interests: {user.interests or 'AIML, Full Stack, Software Engineering'}\n"
                f"Custom Goals: {', '.join(goals_list) if goals_list else 'Not configured'}\n"
                f"Custom Target Keywords: {', '.join(keywords_list) if keywords_list else 'Not configured'}"
            )
            
            classification = await self.ai.classify_email(
                extracted["sender"],
                extracted["subject"],
                extracted["body"],
                user_profile_context,
            )
            if not classification.important:
                continue

            gmail_link = f"https://mail.google.com/mail/u/0/#inbox/{item['id']}"
            email = ImportantEmail(
                user_id=user.id,
                gmail_message_id=item["id"],
                sender=extracted["sender"],
                subject=extracted["subject"],
                snippet=extracted["snippet"],
                summary=classification.summary,
                category=classification.category,
                priority=classification.priority,
                gmail_link=gmail_link,
                relevance_score=classification.relevance_score,
                urgency=classification.urgency,
                suggested_action=classification.suggested_action,
                opportunity_value=classification.opportunity_value,
                company=classification.company,
            )
            user.opportunities_tracked += 1
            db.add(email)
            db.flush()

            if user.notifications_enabled:
                message_text = self.whatsapp.format_alert(
                    sender=email.sender,
                    subject=email.subject,
                    summary=email.summary,
                    priority=email.priority,
                    gmail_link=email.gmail_link,
                    relevance_score=email.relevance_score,
                    urgency=email.urgency,
                    company=email.company,
                    suggested_action=email.suggested_action,
                )


                notification = Notification(
                    user_id=user.id,
                    email_id=email.id,
                    recipient=user.whatsapp_number,
                    message=message_text,
                    status="queued",
                    error_message=""
                )
                db.add(notification)
                db.flush()

                ok, result = self.whatsapp.send_message(
                    to_number=user.whatsapp_number,
                    message=message_text,
                    db=db,
                    user_id=user.id,
                    notification_id=notification.id
                )
                
                notification.status = "sent" if ok else "failed"
                notification.error_message = "" if ok else result
                email.is_notified = ok
                db.commit()
            saved_count += 1

        account.last_checked_at = datetime.utcnow()
        db.commit()
        return saved_count
