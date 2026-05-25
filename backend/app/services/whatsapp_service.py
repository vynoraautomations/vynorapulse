import logging
from datetime import datetime

import httpx

from backend.app.core.config import get_settings
from backend.app.models.delivery_log import DeliveryLog

logger = logging.getLogger(__name__)


class WhatsAppService:
    def __init__(self):
        self.settings = get_settings()
        self.wa_web_service_url = self.settings.wa_web_service_url or "http://localhost:3001"

    def _normalize_number(self, number: str) -> str:
        """Normalize phone number to standard format."""
        number = (number or "").strip()
        if not number:
            return ""
        # Remove all non-digits except +
        number = "".join(c for c in number if c.isdigit() or c == "+")
        # Remove leading + if present and add it back
        number = number.lstrip("+")
        # Return as plain number (service will format it)
        return number

    def format_alert(
        self,
        sender: str,
        subject: str,
        summary: str,
        priority: str,
        gmail_link: str,
        relevance_score: int | None = None,
        urgency: str | None = None,
        company: str | None = None,
        suggested_action: str | None = None,
    ) -> str:
        score_line = f"\nRelevance Score: {relevance_score}%" if relevance_score is not None else ""
        urgency_line = f"\nUrgency: {urgency}" if urgency else ""
        company_line = f"\nCompany: {company}" if company else ""
        action_line = f"\nAction: {suggested_action}" if suggested_action else ""
        return (
            "*VYNORA PULSE ALERT*\n\n"
            f"Priority: {priority}\n"
            f"From: {sender}{company_line}\n"
            f"Subject: {subject}\n\n"
            f"Summary:\n{summary}"
            f"{score_line}{urgency_line}{action_line}\n\n"
            f"Link: {gmail_link}"
        )

    def send_message(
        self,
        to_number: str,
        message: str,
        db=None,
        user_id: int | None = None,
        notification_id: int | None = None,
    ) -> tuple[bool, str]:
        """Send WhatsApp message using whatsapp-web.js service."""
        to_number = self._normalize_number(to_number)

        if not to_number:
            result = "Recipient WhatsApp number is missing."
            self._log_delivery(db, user_id, notification_id, to_number, "failed", result)
            return False, result

        try:
            # Call the whatsapp-web.js service
            response = httpx.post(
                f"{self.wa_web_service_url}/api/whatsapp/send",
                json={
                    "to": to_number,
                    "message": message,
                },
                timeout=30,
            )
            
            if response.status_code != 200:
                result = response.text
                logger.error(f"WhatsApp send failed: {result}")
                self._log_delivery(db, user_id, notification_id, to_number, "failed", result)
                return False, result
            
            payload = response.json()
            if not payload.get("success"):
                result = payload.get("error", "Unknown error")
                logger.error(f"WhatsApp API error: {result}")
                self._log_delivery(db, user_id, notification_id, to_number, "failed", result)
                return False, result
            
            result = payload.get("message_id", "Message sent")
            logger.info(f"WhatsApp message sent successfully to {to_number}")
            self._log_delivery(db, user_id, notification_id, to_number, "sent", "")
            return True, result
        except httpx.ConnectError as exc:
            result = f"WhatsApp service not available: {str(exc)}"
            logger.error(result)
            self._log_delivery(db, user_id, notification_id, to_number, "failed", result)
            return False, result
        except Exception as exc:
            logger.exception("Failed to send WhatsApp message")
            result = str(exc)
            self._log_delivery(db, user_id, notification_id, to_number, "failed", result)
            return False, result

    def _log_delivery(self, db, user_id, notification_id, recipient, status, error_message):
        if db is None or user_id is None:
            return
        db.add(
            DeliveryLog(
                user_id=user_id,
                notification_id=notification_id,
                recipient=recipient or "",
                status=status,
                error_message=error_message or "",
                sent_at=datetime.utcnow(),
            )
        )

    async def get_gateway_status(self) -> dict:
        """Get WhatsApp gateway status from whatsapp-web.js service."""
        try:
            response = httpx.get(
                f"{self.wa_web_service_url}/api/whatsapp/status",
                timeout=5,
            )
            if response.status_code != 200:
                return {
                    "provider": "whatsapp-web.js",
                    "status": "error",
                    "detail": "Unable to reach WhatsApp service",
                }

            payload = response.json()
            has_qr = bool(payload.get("hasQR"))
            qr_code = None
            if has_qr:
                qr_response = httpx.get(
                    f"{self.wa_web_service_url}/api/whatsapp/qr",
                    timeout=5,
                )
                if qr_response.status_code == 200:
                    qr_payload = qr_response.json()
                    qr_code = qr_payload.get("qr") or qr_payload.get("qrCode")

            ready = payload.get("ready") is True
            status = "connected" if ready else "qr_pending" if has_qr else "connecting"

            return {
                "provider": "whatsapp-web.js",
                "status": status,
                "ready": ready,
                "has_qr": has_qr,
                "qrCode": qr_code,
            }
        except Exception as exc:
            logger.error(f"Failed to get WhatsApp gateway status: {exc}")
            return {
                "provider": "whatsapp-web.js",
                "status": "error",
                "detail": str(exc),
            }

    async def get_qr_code(self) -> dict:
        """Get QR code for WhatsApp Web authentication."""
        try:
            response = httpx.get(
                f"{self.wa_web_service_url}/api/whatsapp/qr",
                timeout=5,
            )
            if response.status_code != 200:
                return {
                    "success": False,
                    "error": response.text,
                    "qr": None,
                }
            
            # The endpoint now returns JSON
            payload = response.json()
            return payload
        except Exception as exc:
            logger.error(f"Failed to get QR code: {exc}")
            return {
                "success": False,
                "error": str(exc),
                "qr": None,
            }

    async def logout_gateway(self) -> dict:
        """Logout from WhatsApp Web."""
        try:
            response = httpx.post(
                f"{self.wa_web_service_url}/api/whatsapp/logout",
                timeout=10,
            )
            return response.json()
        except Exception as exc:
            logger.error(f"Failed to logout: {exc}")
            return {
                "success": False,
                "error": str(exc),
            }

    async def reset_session(self) -> dict:
        """Reset WhatsApp Web session."""
        try:
            response = httpx.post(
                f"{self.wa_web_service_url}/api/whatsapp/reset",
                timeout=10,
            )
            return response.json()
        except Exception as exc:
            logger.error(f"Failed to reset session: {exc}")
            return {
                "success": False,
                "error": str(exc),
            }
