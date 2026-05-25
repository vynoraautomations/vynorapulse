import os
import shutil
from typing import List, Optional
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from backend.app.api.deps import get_current_user
from backend.app.db.session import get_db
from backend.app.models.user import User
from backend.app.models.keyword import Keyword
from backend.app.models.user_goal import UserGoal
from backend.app.models.delivery_log import DeliveryLog
from backend.app.services.whatsapp_service import WhatsAppService
from backend.app.core.plans import get_plan

router = APIRouter(prefix="/settings", tags=["settings"])
whatsapp = WhatsAppService()


class GoalCreate(BaseModel):
    goal: str = Field(min_length=2, max_length=200)


class KeywordCreate(BaseModel):
    keyword: str = Field(min_length=1, max_length=100)


class ProfileSettingsUpdate(BaseModel):
    name: Optional[str] = None
    phone_number: Optional[str] = None
    bio: Optional[str] = None
    interests: Optional[str] = None
    education_details: Optional[str] = None
    whatsapp_number: Optional[str] = None
    user_type: Optional[str] = None
    user_mode: Optional[str] = None
    selected_category: Optional[str] = None
    notifications_enabled: Optional[bool] = None


@router.get("")
def get_user_settings(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    goals = db.query(UserGoal).filter(UserGoal.user_id == current_user.id).all()
    keywords = db.query(Keyword).filter(Keyword.user_id == current_user.id).all()
    
    plan = get_plan(current_user.subscription_plan)
    
    # Define features based on plan slug
    from backend.app.services.whatsapp_service import WhatsAppService
    features_map = {
        "student-basic": ["gmail_alerts", "whatsapp_alerts", "daily_digest"],
        "student-pro": ["gmail_alerts", "whatsapp_alerts", "daily_digest", "instant_ai_filtering", "priority_alerts", "deadline_reminders", "opportunity_ranking"],
        "professional": ["gmail_alerts", "whatsapp_alerts", "daily_digest", "instant_ai_filtering", "priority_alerts", "deadline_reminders", "opportunity_ranking", "job_opportunities", "recruiter_emails", "ai_summaries", "interview_tracking"],
        "business": ["gmail_alerts", "whatsapp_alerts", "daily_digest", "instant_ai_filtering", "priority_alerts", "deadline_reminders", "opportunity_ranking", "job_opportunities", "recruiter_emails", "ai_summaries", "interview_tracking", "client_lead_alerts", "team_notifications", "smart_analytics", "sales_inquiry_detection"]
    }
    
    allowed_features = features_map.get(plan.slug, ["gmail_alerts", "whatsapp_alerts", "daily_digest"])
    
    return {
        "profile": {
            "name": current_user.name,
            "email": current_user.email,
            "phone_number": current_user.phone_number or "",
            "bio": current_user.bio or "",
            "interests": current_user.interests or "",
            "education_details": current_user.education_details or "",
            "whatsapp_number": current_user.whatsapp_number,
            "avatar_url": current_user.avatar_url or "",
            "user_type": current_user.user_type,
            "user_mode": current_user.user_mode,
            "selected_category": current_user.selected_category,
            "notifications_enabled": current_user.notifications_enabled,
            "approval_status": current_user.approval_status,
            "subscription_plan": current_user.subscription_plan,
            "plan_slug": plan.slug,
            "gmail_connected": bool(current_user.gmail_account),
            "gmail_email": current_user.gmail_account.gmail_email if current_user.gmail_account else "",
            "gmail_monitoring_enabled": bool(current_user.gmail_account and current_user.gmail_account.monitoring_enabled),
            "gmail_last_checked_at": current_user.gmail_account.last_checked_at.isoformat() if current_user.gmail_account and current_user.gmail_account.last_checked_at else None,
        },
        "goals": [{"id": g.id, "goal": g.goal} for g in goals],
        "keywords": [{"id": k.id, "keyword": k.keyword} for k in keywords],
        "features": allowed_features
    }


@router.put("/profile")
def update_profile_settings(
    payload: ProfileSettingsUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    if payload.name is not None:
        current_user.name = payload.name
    if payload.phone_number is not None:
        current_user.phone_number = payload.phone_number.strip()
    if payload.bio is not None:
        current_user.bio = payload.bio
    if payload.interests is not None:
        current_user.interests = payload.interests
    if payload.education_details is not None:
        current_user.education_details = payload.education_details
    if payload.whatsapp_number is not None:
        # Validate format
        val = payload.whatsapp_number.strip()
        if not val.startswith("whatsapp:"):
            if val.startswith("+"):
                val = f"whatsapp:{val}"
            else:
                val = f"whatsapp:+{val}"
        current_user.whatsapp_number = val
    if payload.user_type is not None:
        current_user.user_type = payload.user_type
    if payload.user_mode is not None:
        current_user.user_mode = payload.user_mode
    if payload.selected_category is not None:
        current_user.selected_category = payload.selected_category
    if payload.notifications_enabled is not None:
        current_user.notifications_enabled = payload.notifications_enabled
        
    db.commit()
    db.refresh(current_user)
    return get_user_settings(current_user, db)


@router.post("/goals")
def add_goal(payload: GoalCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    goal = UserGoal(user_id=current_user.id, goal=payload.goal.strip())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return {"id": goal.id, "goal": goal.goal}


@router.delete("/goals/{goal_id}")
def delete_goal(goal_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    goal = db.query(UserGoal).filter(UserGoal.id == goal_id, UserGoal.user_id == current_user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(goal)
    db.commit()
    return {"detail": "Goal deleted successfully"}


@router.post("/keywords")
def add_keyword(payload: KeywordCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    kw = Keyword(user_id=current_user.id, keyword=payload.keyword.strip())
    db.add(kw)
    db.commit()
    db.refresh(kw)
    return {"id": kw.id, "keyword": kw.keyword}


@router.delete("/keywords/{keyword_id}")
def delete_keyword(keyword_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    kw = db.query(Keyword).filter(Keyword.id == keyword_id, Keyword.user_id == current_user.id).first()
    if not kw:
        raise HTTPException(status_code=404, detail="Keyword not found")
    db.delete(kw)
    db.commit()
    return {"detail": "Keyword deleted successfully"}


@router.post("/upload-avatar")
def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    os.makedirs("backend/uploads/avatars", exist_ok=True)
    
    # Validate extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in [".jpg", ".jpeg", ".png", ".webp", ".gif"]:
        raise HTTPException(status_code=400, detail="Invalid file type. Only images are allowed.")
        
    filename = f"avatar_{current_user.id}{ext}"
    filepath = os.path.join("backend/uploads/avatars", filename)
    
    try:
        with open(filepath, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        url = f"/uploads/avatars/{filename}"
        current_user.avatar_url = url
        db.commit()
        return {"avatar_url": url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to save profile picture: {str(e)}")


@router.get("/delivery-history")
def get_delivery_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    logs = db.query(DeliveryLog).filter(DeliveryLog.user_id == current_user.id).order_by(DeliveryLog.sent_at.desc()).limit(100).all()
    res = []
    for log in logs:
        res.append({
            "id": log.id,
            "recipient": log.recipient,
            "status": log.status,
            "retry_count": log.retry_count,
            "error_message": log.error_message or "",
            "sent_at": log.sent_at.isoformat()
        })
    return res


@router.get("/whatsapp-status")
async def get_whatsapp_status(current_user: User = Depends(get_current_user)):
    gateway_status = await whatsapp.get_gateway_status()
    status = "ready" if gateway_status.get("ready") else "qr_ready" if gateway_status.get("has_qr") else "disconnected"

    return {
        "status": status,
        "qr": gateway_status.get("qrCode"),
        "qrCode": gateway_status.get("qrCode"),
        "hasSession": bool(gateway_status.get("ready")),
        "provider": gateway_status.get("provider"),
        "error": gateway_status.get("detail"),
    }


@router.post("/whatsapp-logout")
async def logout_whatsapp(current_user: User = Depends(get_current_user)):
    return await whatsapp.logout_gateway()

@router.post("/whatsapp-test")
async def test_whatsapp(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not current_user.whatsapp_number:
        raise HTTPException(status_code=400, detail="WhatsApp number not set in profile.")
        
    test_msg = whatsapp.format_alert(
        sender="System Administrator",
        subject="🚀 Vynora Pulse Cloud Test",
        summary="Your Meta Cloud API setup is working perfectly. You will now receive instant alerts for your target keywords and high priority emails.",
        priority="Critical",
        gmail_link="https://mail.google.com",
        relevance_score=100,
        urgency="Critical",
        company="Vynora Pulse",
        suggested_action="You are ready to go!"
    )
    
    # Create notification log record
    from backend.app.models.notification import Notification
    
    notification = Notification(
        user_id=current_user.id,
        email_id=None,
        recipient=current_user.whatsapp_number,
        message=test_msg,
        status="queued",
        error_message=""
    )
    db.add(notification)
    db.flush()

    ok, result = whatsapp.send_message(
        to_number=current_user.whatsapp_number,
        message=test_msg,
        db=db,
        user_id=current_user.id,
        notification_id=notification.id
    )
    
    notification.status = "sent" if ok else "failed"
    notification.error_message = "" if ok else result
    db.commit()
    
    if not ok:
        raise HTTPException(status_code=500, detail=f"Failed to send test message: {result}")
    return {"success": True, "detail": "Test message sent!"}
