"""
Supabase Authentication API Endpoints
"""

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.models import User
from backend.app.schemas.auth import UserResponse
from backend.app.api.deps import get_current_user, require_admin

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Get current authenticated user's profile"""
    return current_user


@router.put("/profile", response_model=UserResponse)
def update_profile(
    updates: dict,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update current user's profile"""
    allowed_fields = {
        "name", "phone_number", "whatsapp_number", "user_type",
        "user_mode", "selected_category", "bio", "avatar_url",
        "education_details", "interests", "telegram_username"
    }
    
    # Filter to only allowed fields
    filtered_updates = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if not filtered_updates:
        raise HTTPException(status_code=400, detail="No valid fields to update")
    
    for key, value in filtered_updates.items():
        setattr(current_user, key, value)
    
    db.commit()
    db.refresh(current_user)
    return current_user


@router.post("/logout")
def logout(response: Response):
    """Logout user (client-side handled by Supabase)"""
    return {"message": "Logout initiated. Clear your local session."}


@router.get("/admin/users", response_model=list[UserResponse])
def list_all_users(
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Get all users (admin only)"""
    users = db.query(User).order_by(User.created_at.desc()).all()
    return users


@router.put("/admin/users/{user_id}/role", response_model=UserResponse)
def update_user_role(
    user_id: int,
    role: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update user role (admin only)"""
    if role not in ["user", "admin", "moderator"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.role = role
    user.is_admin = role == "admin"
    db.commit()
    db.refresh(user)
    return user


@router.put("/admin/users/{user_id}/approval", response_model=UserResponse)
def update_user_approval(
    user_id: int,
    approval_status: str,
    current_user: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Update user approval status (admin only)"""
    valid_statuses = ["pending", "payment_uploaded", "approved", "rejected", "suspended"]
    if approval_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {', '.join(valid_statuses)}")
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.approval_status = approval_status
    db.commit()
    db.refresh(user)
    return user


@router.get("/health")
def auth_health():
    """Health check endpoint"""
    return {"status": "healthy", "service": "supabase-auth"}
