from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, require_active_subscription
from backend.app.core.config import get_settings
from backend.app.db.session import get_db
from backend.app.models import GmailAccount, User
from backend.app.services.gmail_service import GmailService

router = APIRouter(prefix="/gmail", tags=["gmail"])
gmail_service = GmailService()


@router.get("/connect")
def connect_gmail(current_user: User = Depends(require_active_subscription)):
    settings = get_settings()
    if not settings.gmail_client_id or not settings.gmail_client_secret:
        raise HTTPException(status_code=400, detail="Gmail OAuth credentials are missing in .env")
    return {"authorization_url": gmail_service.authorization_url(current_user.id)}


@router.get("/callback")
def gmail_callback(request: Request, db: Session = Depends(get_db)):
    settings = get_settings()
    state = request.query_params.get("state")
    if not state:
        raise HTTPException(status_code=400, detail="Missing OAuth state")
    try:
        gmail_service.save_callback_tokens(db, int(state), str(request.url))
    except Exception as e:
        import traceback
        raise HTTPException(status_code=500, detail=f"Error: {str(e)} \nTrace: {traceback.format_exc()}")
    return RedirectResponse(f"{settings.frontend_url}/dashboard?gmail=connected")


@router.post("/disconnect")
def disconnect_gmail(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    account = db.query(GmailAccount).filter(GmailAccount.user_id == current_user.id).first()
    if account:
        db.delete(account)
        db.commit()
    return {"gmail_connected": False}


@router.post("/poll")
async def poll_now(current_user: User = Depends(require_active_subscription), db: Session = Depends(get_db)):
    count = await gmail_service.poll_user_mailbox(db, current_user)
    return {"processed": count}


@router.post("/monitoring/{enabled}")
def set_monitoring(enabled: bool, current_user: User = Depends(require_active_subscription), db: Session = Depends(get_db)):
    if not current_user.gmail_account:
        raise HTTPException(status_code=400, detail="Connect Gmail first")
    current_user.gmail_account.monitoring_enabled = enabled
    db.commit()
    return {"monitoring_enabled": enabled}
