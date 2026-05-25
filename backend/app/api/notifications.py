from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session
import logging

from backend.app.api.deps import require_active_subscription
from backend.app.db.session import get_db
from backend.app.models import Notification, User
from backend.app.services.whatsapp_service import WhatsAppService
from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/notifications", tags=["notifications"])
whatsapp = WhatsAppService()


@router.get("/whatsapp/status")
async def get_whatsapp_status():
    """Get WhatsApp gateway connection status with QR code if available."""
    status = await whatsapp.get_gateway_status()
    
    # Try to get QR code if in qr_pending status
    if status.get("status") == "qr_pending" or status.get("has_qr"):
        try:
            qr_data = await whatsapp.get_qr_code()
            if qr_data and qr_data.get("qr"):
                status["qr"] = qr_data["qr"]
                status["qrCode"] = qr_data["qr"]
        except Exception as e:
            logger.warning(f"Failed to fetch QR code: {e}")
    
    return status


@router.get("/whatsapp/qr")
async def get_whatsapp_qr():
    """Get QR code for WhatsApp Web authentication."""
    qr = await whatsapp.get_qr_code()
    return qr


@router.post("/whatsapp/reset")
async def reset_whatsapp_session():
    """Reset WhatsApp Web session."""
    result = await whatsapp.reset_session()
    return result


@router.post("/whatsapp/logout")
async def logout_whatsapp():
    """Logout from WhatsApp Web."""
    result = await whatsapp.logout_gateway()
    return result


@router.post("/test")
def send_test_notification(current_user: User = Depends(require_active_subscription), db: Session = Depends(get_db)):
    message = whatsapp.format_alert(
        sender="MailAlert Demo",
        subject="Congratulations! Round 2 Selection",
        summary="This is a test alert confirming that WhatsApp notifications are connected.",
        priority="High",
        gmail_link="https://mail.google.com/",
    )
    ok, result = whatsapp.send_message(current_user.whatsapp_number, message, db, current_user.id)
    db.add(
        Notification(
            user_id=current_user.id,
            recipient=current_user.whatsapp_number,
            message=message,
            status="sent" if ok else "failed",
            error_message="" if ok else result,
        )
    )
    db.commit()
    return {"sent": ok, "detail": result}


@router.get("/webhook", response_class=PlainTextResponse)
def verify_whatsapp_webhook(
    mode: str = Query(None, alias="hub.mode"),
    token: str = Query(None, alias="hub.verify_token"),
    challenge: str = Query(None, alias="hub.challenge"),
):
    settings = get_settings()
    logger.info(f"WhatsApp Webhook verification requested: mode={mode}, token={token}")
    if mode == "subscribe" and token == settings.whatsapp_verify_token:
        logger.info("WhatsApp Webhook successfully verified!")
        return PlainTextResponse(content=challenge, status_code=200)
    logger.warning("WhatsApp Webhook verification failed due to token mismatch.")
    raise HTTPException(status_code=403, detail="Verification token mismatch")


@router.post("/webhook")
async def receive_whatsapp_events(payload: dict):
    logger.info(f"Received WhatsApp webhook event: {payload}")
    return {"status": "success"}
