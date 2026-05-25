import asyncio
import re
import time

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.config import get_settings
from backend.app.db.session import get_db
from backend.app.models import User, WhatsAppSession

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])

settings = get_settings()


class WhatsAppMessage(BaseModel):
    phone_number: str
    message: str


class WhatsAppStatusResponse(BaseModel):
    status: str
    qr: str | None = None
    qrCode: str | None = None
    has_session: bool = False


def _extract_qr_data_url(html: str) -> str | None:
    match = re.search(r'<img[^>]+src=["\']([^"\']+)["\']', html, re.IGNORECASE)
    if not match:
        return None
    src = match.group(1)
    if src.startswith("data:image"):
        return src
    return None


async def _load_gateway_qr() -> str | None:
    try:
        async with httpx.AsyncClient(trust_env=False) as async_client:
            status_resp = await async_client.get(
                f"{settings.wa_web_service_url}/api/whatsapp/status",
                timeout=5,
            )
            if status_resp.status_code != 200:
                return None

            payload = status_resp.json()
            if not payload.get("hasQR") and payload.get("status") != "qr_pending":
                return None

            qr_resp = await async_client.get(
                f"{settings.wa_web_service_url}/api/whatsapp/qr",
                timeout=5,
            )
            if qr_resp.status_code != 200:
                return None

            qr_payload = qr_resp.json()
            return qr_payload.get("qr") or qr_payload.get("qrCode")
    except Exception:
        return None


async def _reset_gateway_session() -> None:
    async with httpx.AsyncClient(trust_env=False) as async_client:
        response = await async_client.post(
            f"{settings.wa_web_service_url}/api/whatsapp/reset",
            timeout=15,
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=503,
                detail=f"Unable to reset WhatsApp gateway: {response.text}",
            )


async def _logout_gateway_session() -> None:
    async with httpx.AsyncClient(trust_env=False) as async_client:
        response = await async_client.post(
            f"{settings.wa_web_service_url}/api/whatsapp/logout",
            timeout=15,
        )
        if response.status_code != 200:
            raise HTTPException(
                status_code=503,
                detail=f"Unable to disconnect WhatsApp gateway: {response.text}",
            )


async def _wait_for_gateway_qr(timeout_seconds: float = 20.0) -> str | None:
    deadline = time.monotonic() + timeout_seconds
    async with httpx.AsyncClient(trust_env=False) as async_client:
        while time.monotonic() < deadline:
            try:
                response = await async_client.get(
                    f"{settings.wa_web_service_url}/api/whatsapp/status",
                    timeout=5,
                )
                if response.status_code != 200:
                    await asyncio.sleep(1)
                    continue

                payload = response.json()
                if payload.get("hasQR"):
                    qr_response = await async_client.get(
                        f"{settings.wa_web_service_url}/api/whatsapp/qr",
                        timeout=5,
                    )
                    if qr_response.status_code == 200:
                        qr_payload = qr_response.json()
                        qr_code = qr_payload.get("qr") or qr_payload.get("qrCode")
                        if qr_code:
                            return qr_code

                await asyncio.sleep(1)
            except Exception:
                await asyncio.sleep(1)
    return None


async def _fetch_gateway_status() -> dict:
    try:
        async with httpx.AsyncClient(trust_env=False) as async_client:
            response = await async_client.get(
                f"{settings.wa_web_service_url}/api/whatsapp/status",
                timeout=5,
            )
            if response.status_code != 200:
                return {
                    "status": "offline",
                    "ready": False,
                    "has_qr": False,
                    "error": response.text,
                }

            payload = response.json() or {}
            ready = bool(payload.get("ready"))
            has_qr = bool(payload.get("hasQR") or payload.get("status") == "qr_pending")
            if ready:
                status = "connected"
            elif has_qr:
                status = "scanning"
            else:
                status = payload.get("status") or "disconnected"

            return {
                "status": status,
                "ready": ready,
                "has_qr": has_qr,
                "error": payload.get("error"),
            }
    except Exception as exc:
        return {
            "status": "error",
            "ready": False,
            "has_qr": False,
            "error": str(exc),
        }


def _sync_session_status(session, current_user, gateway_status: dict) -> str:
    status = gateway_status.get("status") or "disconnected"

    if status in {"qr_pending", "connecting", "authenticating"}:
        status = "scanning"
    if status in {"offline", "error"} and session.status in {"connected", "scanning"}:
        status = session.status

    if status == "connected":
        session.status = "connected"
        session.qr_code = ""
        current_user.is_whatsapp_connected = True
        current_user.whatsapp_connection_status = "connected"
    elif status == "scanning":
        session.status = "scanning"
        current_user.is_whatsapp_connected = False
        current_user.whatsapp_connection_status = "scanning"
    else:
        session.status = "disconnected"
        session.qr_code = ""
        current_user.is_whatsapp_connected = False
        current_user.whatsapp_connection_status = "disconnected"

    return status


@router.get("/status", response_model=WhatsAppStatusResponse)
async def get_whatsapp_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get WhatsApp connection status"""
    try:
        session = (
            db.query(WhatsAppSession)
            .filter(WhatsAppSession.session_id == f"user_{current_user.id}")
            .first()
        )

        if not session:
            session = WhatsAppSession(
                session_id=f"user_{current_user.id}",
                status="disconnected",
            )
            db.add(session)

        gateway_status = await _fetch_gateway_status()
        status = _sync_session_status(session, current_user, gateway_status)
        db.commit()
        db.refresh(session)

        qr_code = session.qr_code if status == "scanning" else None
        return WhatsAppStatusResponse(
            status=status,
            qr=qr_code,
            qrCode=qr_code,
            has_session=status == "connected",
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/connect")
async def connect_whatsapp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Initiate WhatsApp connection and get a fresh QR code."""
    try:
        gateway_status = await _fetch_gateway_status()
        if gateway_status.get("ready") or gateway_status.get("status") == "connected":
            session = (
                db.query(WhatsAppSession)
                .filter(WhatsAppSession.session_id == f"user_{current_user.id}")
                .first()
            )
            if not session:
                session = WhatsAppSession(
                    session_id=f"user_{current_user.id}",
                    status="connected",
                )
                db.add(session)

            session.status = "connected"
            session.qr_code = ""
            current_user.is_whatsapp_connected = True
            current_user.whatsapp_connection_status = "connected"
            db.commit()
            db.refresh(session)
            return {
                "status": "connected",
                "qr_code": None,
                "qrCode": None,
                "message": "WhatsApp is already connected.",
            }

        qr_code = None
        if gateway_status.get("has_qr") or gateway_status.get("status") == "scanning":
            qr_code = await _load_gateway_qr()

        if not qr_code:
            await _reset_gateway_session()
            qr_code = await _wait_for_gateway_qr()

        if not qr_code:
            raise HTTPException(
                status_code=503,
                detail="Unable to generate a WhatsApp QR code. Please wait a few seconds and try again.",
            )

        session = (
            db.query(WhatsAppSession)
            .filter(WhatsAppSession.session_id == f"user_{current_user.id}")
            .first()
        )
        if not session:
            session = WhatsAppSession(
                session_id=f"user_{current_user.id}",
                status="scanning",
            )
            db.add(session)

        session.status = "scanning"
        session.qr_code = qr_code
        current_user.is_whatsapp_connected = False
        current_user.whatsapp_connection_status = "scanning"
        db.commit()
        db.refresh(session)

        return {
            "status": "scanning",
            "qr_code": qr_code,
            "qrCode": qr_code,
            "message": "Scan the QR code with WhatsApp on your phone",
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/disconnect")
async def disconnect_whatsapp(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Disconnect WhatsApp and clear the active session."""
    gateway_error = None
    try:
        await _logout_gateway_session()
    except HTTPException as exc:
        gateway_error = exc.detail

    try:
        session = (
            db.query(WhatsAppSession)
            .filter(WhatsAppSession.session_id == f"user_{current_user.id}")
            .first()
        )

        if session:
            session.status = "disconnected"
            session.qr_code = ""

        current_user.is_whatsapp_connected = False
        current_user.whatsapp_connection_status = "disconnected"
        db.commit()

        if gateway_error:
            return {
                "status": "disconnected",
                "message": f"Local WhatsApp session disconnected. Gateway cleanup warning: {gateway_error}",
            }

        return {"status": "disconnected", "message": "WhatsApp disconnected"}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/send-message")
async def send_message(
    payload: WhatsAppMessage,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Send a message via WhatsApp"""
    try:
        session = (
            db.query(WhatsAppSession)
            .filter(WhatsAppSession.session_id == f"user_{current_user.id}")
            .first()
        )

        if not session:
            session = WhatsAppSession(
                session_id=f"user_{current_user.id}",
                status="disconnected",
            )
            db.add(session)

        gateway_status = await _fetch_gateway_status()
        status = _sync_session_status(session, current_user, gateway_status)
        db.commit()
        db.refresh(session)

        if status != "connected":
            raise HTTPException(
                status_code=400,
                detail="WhatsApp not connected. Please connect first.",
            )

        # Call WhatsApp Web service to send message
        try:
            async with httpx.AsyncClient(trust_env=False) as async_client:
                response = await async_client.post(
                    f"{settings.wa_web_service_url}/api/whatsapp/send",
                    json={
                        "to": payload.phone_number,
                        "message": payload.message,
                    },
                    timeout=10,
                )

            if response.status_code == 200:
                return {"status": "sent", "message": "Message sent successfully"}
            else:
                raise Exception(response.text)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Failed to send message: {str(e)}")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/connection-status")
async def get_connection_status(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get detailed WhatsApp connection status"""
    try:
        session = (
            db.query(WhatsAppSession)
            .filter(WhatsAppSession.session_id == f"user_{current_user.id}")
            .first()
        )

        if not session:
            session = WhatsAppSession(
                session_id=f"user_{current_user.id}",
                status="disconnected",
            )
            db.add(session)

        gateway_status = await _fetch_gateway_status()
        status = _sync_session_status(session, current_user, gateway_status)
        db.commit()
        db.refresh(session)

        return {
            "connected": status == "connected",
            "status": status,
            "phone_number": current_user.whatsapp_number or "Not set",
            "session_id": session.session_id,
            "created_at": session.created_at,
            "updated_at": session.updated_at,
            "qr_available": status == "scanning" and bool(session.qr_code),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
