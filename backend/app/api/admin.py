import asyncio
import time
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field
import httpx

from backend.app.api.deps import get_current_user
from backend.app.core.config import get_settings
from backend.app.db.session import get_db
from backend.app.models import AdminLog, DailyDigest, GmailAccount, ImportantEmail, Notification, Payment, SecurityLog, Subscription, User, UserSession
from backend.app.services.whatsapp_service import WhatsAppService

router = APIRouter(prefix="/admin", tags=["admin"])
whatsapp = WhatsAppService()


class UserAdminDTO(BaseModel):
    id: int
    name: str
    email: str
    whatsapp_number: str
    user_type: str
    selected_category: str
    subscription_plan: str
    approval_status: str
    payment_screenshot: str
    is_admin: bool
    created_at: str

    class Config:
        from_attributes = True


class AdminNoticeRequest(BaseModel):
    message: str = Field(min_length=1, max_length=800)


def check_admin(current_user: User = Depends(get_current_user)):
    settings = get_settings()
    if current_user.role != "admin" and not current_user.is_admin and current_user.email != settings.admin_email.lower():
        raise HTTPException(status_code=403, detail="Forbidden: Admin access only")
    return current_user


def _latest_subscription(db: Session, user_id: int) -> Subscription | None:
    return db.query(Subscription).filter(Subscription.user_id == user_id).order_by(Subscription.id.desc()).first()


@router.get("/users")
def get_all_users(
    status: str = Query(default=""),
    search: str = Query(default=""),
    db: Session = Depends(get_db),
    admin: User = Depends(check_admin),
):
    query = db.query(User).order_by(User.id.desc())
    if status:
        query = query.filter(User.approval_status == status)
    if search:
        like = f"%{search}%"
        query = query.filter((User.name.ilike(like)) | (User.email.ilike(like)) | (User.whatsapp_number.ilike(like)))

    users = query.all()
    res = []
    for u in users:
        res.append({
            "id": u.id,
            "name": u.name,
            "email": u.email,
            "whatsapp_number": u.whatsapp_number,
            "user_type": u.user_type,
            "selected_category": u.selected_category or "Engineering opportunities",
            "subscription_plan": u.subscription_plan or "STUDENT BASIC — ₹29/month",
            "approval_status": u.approval_status or "pending",
            "payment_screenshot": u.payment_screenshot or "",
            "is_admin": u.is_admin or False,
            "created_at": str(u.created_at),
        })
    return res


@router.post("/users/{user_id}/approve")
def approve_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(check_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    u.approval_status = "approved"
    u.is_verified = True
    subscription = _latest_subscription(db, u.id)
    if subscription:
        subscription.status = "approved"
        subscription.approved_by_admin = True
        subscription.approved_by_admin_id = admin.id
        subscription.approved_at = datetime.utcnow()
        subscription.expires_at = datetime.utcnow() + timedelta(days=30)
        db.query(Payment).filter(Payment.subscription_id == subscription.id).update({"status": "approved"})

    log = AdminLog(
        admin_email=admin.email,
        action="Approved User",
        target_user_id=u.id,
        details=f"Approved manual UPI payment for plan: {u.subscription_plan}",
    )
    db.add(log)

    msg = (
        "⚡ VYNORA PULSE | SUBSCRIPTION ACTIVATED ⚡\n\n"
        f"🎉 Congratulations {u.name}! Your payment has been verified successfully.\n"
        f"📦 Active Plan: {u.subscription_plan}\n"
        f"🎯 Alert Category: {u.selected_category}\n\n"
        "Your AI Opportunity Engine is now live. Connect your Gmail account in your dashboard to start receiving real-time alerts!"
    )
    whatsapp.send_message(u.whatsapp_number, msg)

    db.commit()
    return {"status": "approved", "detail": f"User {u.name} approved successfully."}


@router.post("/users/{user_id}/reject")
def reject_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(check_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    u.approval_status = "rejected"
    subscription = _latest_subscription(db, u.id)
    if subscription:
        subscription.status = "rejected"
        db.query(Payment).filter(Payment.subscription_id == subscription.id).update({"status": "rejected"})

    log = AdminLog(
        admin_email=admin.email,
        action="Rejected User",
        target_user_id=u.id,
        details="Payment screenshot was invalid or rejected.",
    )
    db.add(log)

    msg = (
        "⚡ VYNORA PULSE | VERIFICATION FAILED ⚡\n\n"
        f"⚠️ Hello {u.name}, your uploaded payment verification could not be approved.\n"
        "Please check your transaction details and re-upload your valid payment screenshot on your dashboard or contact support."
    )
    whatsapp.send_message(u.whatsapp_number, msg)

    db.commit()
    return {"status": "rejected", "detail": f"User {u.name} payment rejected."}


@router.post("/users/{user_id}/suspend")
def suspend_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(check_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    u.approval_status = "suspended"
    subscription = _latest_subscription(db, u.id)
    if subscription:
        subscription.status = "rejected"

    log = AdminLog(
        admin_email=admin.email,
        action="Suspended User",
        target_user_id=u.id,
        details="User account suspended by administrator.",
    )
    db.add(log)
    db.commit()
    return {"status": "suspended", "detail": f"User {u.name} suspended."}


@router.delete("/users/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), admin: User = Depends(check_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if u.is_admin or u.role == "admin":
        raise HTTPException(status_code=400, detail="Admin users cannot be deleted from this panel")
    db.add(
        AdminLog(
            admin_email=admin.email,
            action="Deleted User",
            target_user_id=u.id,
            details=f"Deleted user account for {u.email}.",
        )
    )
    db.query(UserSession).filter(UserSession.user_id == u.id).delete()
    db.query(Payment).filter(Payment.user_id == u.id).delete()
    db.query(Subscription).filter(Subscription.user_id == u.id).delete()
    db.query(Notification).filter(Notification.user_id == u.id).delete()
    db.query(ImportantEmail).filter(ImportantEmail.user_id == u.id).delete()
    db.query(DailyDigest).filter(DailyDigest.user_id == u.id).delete()
    db.query(GmailAccount).filter(GmailAccount.user_id == u.id).delete()
    db.query(SecurityLog).filter(SecurityLog.user_id == u.id).update({"details": "User deleted"})
    db.delete(u)
    db.commit()
    return {"detail": f"User {u.email} deleted."}


@router.post("/users/{user_id}/notify")
def notify_user(user_id: int, payload: AdminNoticeRequest, db: Session = Depends(get_db), admin: User = Depends(check_admin)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")

    full_msg = f"⚡ VYNORA PULSE ADMIN UPDATE ⚡\n\nHello {u.name},\n\n{payload.message}"
    ok, res = whatsapp.send_message(u.whatsapp_number, full_msg)

    if not ok:
        raise HTTPException(
            status_code=502,
            detail=f"WhatsApp notification failed: {res or 'Unknown gateway error'}",
        )

    log = AdminLog(
        admin_email=admin.email,
        action="Sent Broadcast Notice",
        target_user_id=u.id,
        details=f"Message: {payload.message}",
    )
    db.add(log)
    db.commit()

    return {"sent": True, "detail": "Notice broadcasted successfully."}


@router.get("/stats")
def get_admin_stats(db: Session = Depends(get_db), admin: User = Depends(check_admin)):
    total_users = db.query(User).count()
    pending = db.query(User).filter((User.approval_status == "pending") | (User.approval_status == "payment_uploaded")).count()
    active_subscriptions = db.query(Subscription).filter(Subscription.status == "approved").count()
    revenue = db.query(func.coalesce(func.sum(Subscription.amount), 0)).filter(Subscription.status == "approved").scalar() or 0
    active_gmail = db.query(GmailAccount).count()
    total_emails = db.query(ImportantEmail).count()
    total_notifications = db.query(Notification).count()

    return {
        "total_users": total_users,
        "pending_verifications": pending,
        "active_subscriptions": active_subscriptions,
        "revenue_inr": revenue,
        "active_gmail": active_gmail,
        "total_emails_processed": total_emails,
        "total_notifications_sent": total_notifications,
    }


@router.get("/logs")
def get_admin_logs(db: Session = Depends(get_db), admin: User = Depends(check_admin)):
    logs = db.query(AdminLog).order_by(AdminLog.id.desc()).limit(50).all()
    return logs


@router.get("/security-logs")
def get_security_logs(db: Session = Depends(get_db), admin: User = Depends(check_admin)):
    return db.query(SecurityLog).order_by(SecurityLog.id.desc()).limit(100).all()


@router.get("/whatsapp/status")
async def get_admin_whatsapp_status(admin: User = Depends(check_admin)):
    """Get WhatsApp gateway status for admin dashboard"""
    import httpx
    try:
        async with httpx.AsyncClient(trust_env=False) as async_client:
            status_resp = await async_client.get(
                f"{get_settings().wa_web_service_url}/api/whatsapp/status",
                timeout=5,
            )
            if status_resp.status_code == 200:
                payload = status_resp.json()
                
                # If QR is pending, try to get the QR code
                if payload.get("hasQR") or payload.get("status") == "qr_pending":
                    qr_resp = await async_client.get(
                        f"{get_settings().wa_web_service_url}/api/whatsapp/qr",
                        timeout=5,
                    )
                    if qr_resp.status_code == 200:
                        qr_data = qr_resp.json()
                        qr_code = qr_data.get("qr") or qr_data.get("qrCode")
                        return {
                            "status": "qr_pending",
                            "qr": qr_code,
                            "qrCode": qr_code,
                            "ready": False,
                            "error": None,
                        }
                
                return {
                    "status": payload.get("status", "unknown"),
                    "ready": payload.get("ready") is True or payload.get("status") == "connected",
                    "qr": None,
                    "qrCode": None,
                    "error": None,
                }
            else:
                return {
                    "status": "offline",
                    "ready": False,
                    "qr": None,
                    "qrCode": None,
                    "error": "WhatsApp service is offline",
                }
    except Exception as e:
        return {
            "status": "error",
            "ready": False,
            "qr": None,
            "qrCode": None,
            "error": str(e),
        }


@router.post("/whatsapp/connect")
async def admin_connect_whatsapp(admin: User = Depends(check_admin)):
    """Admin endpoint to initiate WhatsApp connection and get a fresh QR code"""
    settings = get_settings()
    
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
    
    try:
        gateway_status = await _fetch_gateway_status()
        if gateway_status.get("ready") or gateway_status.get("status") == "connected":
            try:
                await _reset_gateway_session()
                await asyncio.sleep(2)
                gateway_status = await _fetch_gateway_status()
            except HTTPException:
                pass

        qr_code = None
        if gateway_status.get("has_qr") or gateway_status.get("status") == "scanning":
            async with httpx.AsyncClient(trust_env=False) as async_client:
                qr_response = await async_client.get(
                    f"{settings.wa_web_service_url}/api/whatsapp/qr",
                    timeout=5,
                )
                if qr_response.status_code == 200:
                    qr_payload = qr_response.json()
                    qr_code = qr_payload.get("qr") or qr_payload.get("qrCode")

        if not qr_code:
            await _reset_gateway_session()
            qr_code = await _wait_for_gateway_qr()

        if not qr_code:
            raise HTTPException(
                status_code=503,
                detail="Unable to generate a WhatsApp QR code. Please wait a few seconds and try again.",
            )

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

