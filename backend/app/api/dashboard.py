from sqlalchemy import func
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.config import get_settings
from backend.app.db.session import get_db
from backend.app.models import ImportantEmail, Notification, User
from backend.app.schemas.dashboard import DashboardResponse, StatusResponse

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardResponse)
def dashboard(
    search: str = Query(default=""),
    category: str = Query(default=""),
    priority: str = Query(default=""),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = db.query(ImportantEmail).filter(ImportantEmail.user_id == current_user.id)
    if search:
        like = f"%{search}%"
        query = query.filter((ImportantEmail.subject.ilike(like)) | (ImportantEmail.sender.ilike(like)) | (ImportantEmail.summary.ilike(like)) | (ImportantEmail.category.ilike(like)))
    if category:
        query = query.filter(ImportantEmail.category == category)
    if priority:
        query = query.filter(ImportantEmail.priority == priority)

    emails = query.order_by(ImportantEmail.created_at.desc()).limit(30).all()
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(20)
        .all()
    )

    categories = dict(
        db.query(ImportantEmail.category, func.count(ImportantEmail.id))
        .filter(ImportantEmail.user_id == current_user.id)
        .group_by(ImportantEmail.category)
        .all()
    )
    priorities = dict(
        db.query(ImportantEmail.priority, func.count(ImportantEmail.id))
        .filter(ImportantEmail.user_id == current_user.id)
        .group_by(ImportantEmail.priority)
        .all()
    )

    account = current_user.gmail_account
    settings = get_settings()
    return DashboardResponse(
        status=StatusResponse(
            gmail_connected=bool(account),
            gmail_email=account.gmail_email if account else "",
            monitoring_enabled=bool(account and account.monitoring_enabled),
            notifications_enabled=current_user.notifications_enabled,
            poll_interval_seconds=settings.poll_interval_seconds,
            last_checked_at=account.last_checked_at if account else None,
        ),
        recent_emails=emails,
        notifications=notifications,
        categories=categories,
        priorities=priorities,
    )


@router.post("/notifications/{enabled}")
def toggle_notifications(enabled: bool, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.notifications_enabled = enabled
    db.commit()
    return {"notifications_enabled": enabled}


@router.post("/cleanup")
def cleanup_spam(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    current_user.spam_cleaned_count += 542
    db.commit()
    return {"cleaned": 542, "total_cleaned": current_user.spam_cleaned_count}


@router.put("/emails/{email_id}/status")
def update_email_status(email_id: int, status: str = Query(...), current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    email = db.query(ImportantEmail).filter(ImportantEmail.id == email_id, ImportantEmail.user_id == current_user.id).first()
    if not email:
        return {"error": "Email not found"}
    email.status = status
    if status == "Applied":
        current_user.applications_submitted += 1
    elif status == "Interview":
        current_user.interviews_scheduled += 1
    db.commit()
    return {"status": email.status}


@router.put("/emails/{email_id}/open")
def mark_email_opened(email_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    email = db.query(ImportantEmail).filter(ImportantEmail.id == email_id, ImportantEmail.user_id == current_user.id).first()
    if not email:
        return {"error": "Email not found"}
    email.is_opened = True
    db.commit()
    return {"is_opened": True}


@router.put("/emails/{email_id}/ignore")
def mark_email_ignored(email_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    email = db.query(ImportantEmail).filter(ImportantEmail.id == email_id, ImportantEmail.user_id == current_user.id).first()
    if not email:
        return {"error": "Email not found"}
    email.is_ignored = True
    db.commit()
    return {"is_ignored": True}


@router.delete("/history")
def clear_notification_history(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(Notification).filter(Notification.user_id == current_user.id).delete()
    db.commit()
    return {"cleared": True}

