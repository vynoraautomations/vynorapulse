from fastapi import Cookie, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from backend.app.core.security import decode_token
from backend.app.db.session import get_db
from backend.app.models import User
from backend.app.core.supabase_auth import get_user_from_supabase_token

security = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    access_cookie: str | None = Cookie(default=None, alias="access_token"),
    db: Session = Depends(get_db),
) -> User:
    """
    Get current user from either a Supabase JWT or a local backend JWT.
    Supports both Bearer token (header) and cookie.
    """
    token = None

    if credentials:
        token = credentials.credentials
    elif access_cookie:
        token = access_cookie

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
        return get_user_from_supabase_token(token, db)
    except HTTPException:
        pass
    except Exception:
        pass

    payload = decode_token(token)
    if payload and payload.get("typ") == "access":
        email = str(payload.get("sub") or "").lower()
        if not email:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = db.query(User).filter(User.email == email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="User not found",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return user

    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Authentication failed",
        headers={"WWW-Authenticate": "Bearer"},
    )


def require_active_subscription(current_user: User = Depends(get_current_user)) -> User:
    """Check if user has active subscription"""
    if current_user.is_admin or current_user.role == "admin":
        return current_user
    if current_user.approval_status != "approved":
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="Subscription requires admin approval before this feature unlocks.",
        )
    return current_user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Check if user is admin"""
    if not (current_user.is_admin or current_user.role == "admin"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user

