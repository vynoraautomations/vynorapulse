import logging
from fastapi import APIRouter, Request, HTTPException, Query, Response
from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhook"])

@router.get("/webhook")
async def verify_webhook(
    mode: str = Query(None, alias="hub.mode"),
    token: str = Query(None, alias="hub.verify_token"),
    challenge: str = Query(None, alias="hub.challenge"),
):
    """
    Webhook verification endpoint for Meta WhatsApp Cloud API.
    """
    settings = get_settings()
    
    if mode and token:
        if mode == "subscribe" and token == settings.whatsapp_verify_token:
            logger.info("Webhook verified successfully!")
            return Response(content=challenge, media_type="text/plain")
        else:
            logger.warning("Webhook verification failed: Invalid token or mode.")
            raise HTTPException(status_code=403, detail="Verification failed")
            
    raise HTTPException(status_code=400, detail="Missing parameters")

@router.post("/webhook")
async def receive_webhook(request: Request):
    """
    Webhook receiver for incoming WhatsApp messages and delivery statuses.
    """
    try:
        body = await request.json()
        logger.info(f"Incoming WhatsApp Webhook Data: {body}")
        
        # Check if it's a WhatsApp API event
        if body.get("object") == "whatsapp_business_account":
            for entry in body.get("entry", []):
                for change in entry.get("changes", []):
                    value = change.get("value", {})
                    
                    # Log message delivery statuses (sent, delivered, read, failed)
                    if "statuses" in value:
                        for status in value["statuses"]:
                            msg_id = status.get("id")
                            msg_status = status.get("status")
                            recipient_id = status.get("recipient_id")
                            logger.info(f"Message Status Update - ID: {msg_id}, Status: {msg_status}, Recipient: {recipient_id}")
                            # TODO: Update delivery_logs table in database based on msg_id
                            
                    # Log incoming user messages
                    if "messages" in value:
                        for message in value["messages"]:
                            sender_phone = message.get("from")
                            msg_text = message.get("text", {}).get("body", "")
                            logger.info(f"Received Message from {sender_phone}: {msg_text}")
                            
            return {"status": "success"}
            
        return Response(status_code=404)
        
    except Exception as e:
        logger.exception(f"Error processing webhook: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
