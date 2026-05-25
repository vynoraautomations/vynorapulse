from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from jose import JWTError, jwt as jose_jwt
from sqlalchemy.orm import Session

from backend.app.core.config import get_settings
from backend.app.core.plans import get_plan
from backend.app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    hash_token,
    verify_password,
)
from backend.app.db.session import get_db
from backend.app.models import SecurityLog, Subscription, User, UserSession
from backend.app.schemas.auth import (
    LoginRequest,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    ProfileUpdateRequest,
    RefreshRequest,
    SignupRequest,
    TokenResponse,
    UserResponse,
)
from backend.app.api.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


def _client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return (forwarded.split(",")[0].strip() or request.client.host if request.client else "")


def _log_security(db: Session, event: str, request: Request, user: User | None = None, email: str = "", details: str = ""):
    db.add(
        SecurityLog(
            user_id=user.id if user else None,
            email=(user.email if user else email).lower(),
            event=event,
            ip_address=_client_ip(request),
            user_agent=request.headers.get("user-agent", "")[:500],
            details=details[:500],
        )
    )


def _set_auth_cookies(response: Response, access_token: str, refresh_token: str):
    settings = get_settings()
    cookie_kwargs = {
        "httponly": True,
        "secure": settings.secure_cookies,
        "samesite": "lax",
    }
    response.set_cookie("access_token", access_token, max_age=settings.access_token_expire_minutes * 60, **cookie_kwargs)
    response.set_cookie("refresh_token", refresh_token, max_age=settings.refresh_token_expire_days * 24 * 3600, **cookie_kwargs)
    response.set_cookie("csrf_token", hash_token(refresh_token)[:32], max_age=settings.refresh_token_expire_days * 24 * 3600, secure=settings.secure_cookies, samesite="lax")


def _clear_auth_cookies(response: Response):
    response.delete_cookie("access_token")
    response.delete_cookie("refresh_token")
    response.delete_cookie("csrf_token")


def _create_session_tokens(user: User, request: Request, db: Session) -> tuple[str, str]:
    settings = get_settings()
    placeholder_hash = hash_token(f"pending:{user.email}:{datetime.utcnow().isoformat()}")
    session = UserSession(
        user_id=user.id,
        refresh_token_hash=placeholder_hash,
        ip_address=_client_ip(request),
        user_agent=request.headers.get("user-agent", "")[:500],
        expires_at=datetime.utcnow() + timedelta(days=settings.refresh_token_expire_days),
    )
    db.add(session)
    db.flush()
    refresh_token = create_refresh_token(user.email, session.id)
    session.refresh_token_hash = hash_token(refresh_token)
    access_token = create_access_token(user.email)
    return access_token, refresh_token


@router.post("/signup", response_model=TokenResponse)
def signup(payload: SignupRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    settings = get_settings()
    email = str(payload.email).lower()
    existing = db.query(User).filter(User.email == email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    is_admin_user = email == settings.admin_email.lower()
    approval_stat = "approved" if is_admin_user else "pending"
    plan = get_plan(payload.subscription_plan)

    # For OAuth signup, password might be None
    password_hash = hash_password(payload.password) if payload.password else None
    
    user = User(
        name=payload.name,
        email=email,
        password_hash=password_hash,
        phone_number=payload.phone_number,
        whatsapp_number=payload.whatsapp_number or "",
        user_type=payload.user_type,
        user_mode=payload.user_mode,
        selected_category=payload.selected_category,
        subscription_plan=plan.display_name,
        approval_status=approval_stat,
        is_admin=is_admin_user,
        role="admin" if is_admin_user else "user",
        is_verified=is_admin_user,
        oauth_provider=payload.oauth_provider,
        oauth_id=payload.oauth_id,
    )
    db.add(user)
    db.flush()
    db.add(
        Subscription(
            user_id=user.id,
            plan_slug=plan.slug,
            plan_name=plan.name,
            amount=plan.amount_inr,
            status="approved" if is_admin_user else "pending",
            approved_by_admin=is_admin_user,
        )
    )
    access_token, refresh_token = _create_session_tokens(user, request, db)
    _log_security(db, "signup", request, user=user)
    db.commit()
    _set_auth_cookies(response, access_token, refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=TokenResponse)
def login(payload: LoginRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    email = str(payload.email).lower()
    user = db.query(User).filter(User.email == email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        _log_security(db, "login_failed", request, email=email)
        db.commit()
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
    if user.approval_status == "suspended":
        _log_security(db, "login_blocked_suspended", request, user=user)
        db.commit()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account suspended")

    user.last_login_at = datetime.utcnow()
    access_token, refresh_token = _create_session_tokens(user, request, db)
    _log_security(db, "login_success", request, user=user)
    db.commit()
    _set_auth_cookies(response, access_token, refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/refresh", response_model=TokenResponse)
def refresh_token(
    payload: RefreshRequest,
    response: Response,
    request: Request,
    refresh_cookie: str | None = Cookie(default=None, alias="refresh_token"),
    db: Session = Depends(get_db),
):
    token = payload.refresh_token or refresh_cookie
    claims = decode_token(token or "")
    if not claims or claims.get("typ") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    session = db.query(UserSession).filter(UserSession.id == claims.get("sid")).first()
    if (
        not session
        or session.revoked
        or session.refresh_token_hash != hash_token(token)
        or session.expires_at < datetime.utcnow()
    ):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh session expired")

    user = db.query(User).filter(User.email == claims.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    session.revoked = True
    session.revoked_at = datetime.utcnow()
    access_token, new_refresh_token = _create_session_tokens(user, request, db)
    _log_security(db, "refresh_rotated", request, user=user)
    db.commit()
    _set_auth_cookies(response, access_token, new_refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=new_refresh_token)


@router.post("/logout")
def logout(response: Response, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    db.query(UserSession).filter(UserSession.user_id == current_user.id, UserSession.revoked == False).update(  # noqa: E712
        {"revoked": True, "revoked_at": datetime.utcnow()}
    )
    db.commit()
    _clear_auth_cookies(response)
    return {"detail": "Logged out"}


@router.post("/forgot-password")
def forgot_password(payload: PasswordResetRequest, request: Request, db: Session = Depends(get_db)):
    email = str(payload.email).lower()
    user = db.query(User).filter(User.email == email).first()
    if user:
        _log_security(db, "password_reset_requested", request, user=user)
        db.commit()
    return {"detail": "If that account exists, a reset link will be sent."}


@router.post("/reset-password")
def reset_password(payload: PasswordResetConfirmRequest, request: Request, db: Session = Depends(get_db)):
    claims = decode_token(payload.token)
    if not claims or claims.get("typ") != "password_reset":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    user = db.query(User).filter(User.email == claims.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset token")
    user.password_hash = hash_password(payload.new_password)
    db.query(UserSession).filter(UserSession.user_id == user.id, UserSession.revoked == False).update(  # noqa: E712
        {"revoked": True, "revoked_at": datetime.utcnow()}
    )
    _log_security(db, "password_reset_completed", request, user=user)
    db.commit()
    return {"detail": "Password reset successfully"}


@router.post("/verify-email")
def verify_email(token: str, request: Request, db: Session = Depends(get_db)):
    claims = decode_token(token)
    if not claims or claims.get("typ") != "email_verification":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
    user = db.query(User).filter(User.email == claims.get("sub")).first()
    if not user:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired verification token")
    user.is_verified = True
    _log_security(db, "email_verified", request, user=user)
    db.commit()
    return {"detail": "Email verified"}


@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/google-callback", response_model=TokenResponse)
def google_callback(payload: SignupRequest, response: Response, request: Request, db: Session = Depends(get_db)):
    """Handle Google OAuth callback"""
    settings = get_settings()
    email = str(payload.email).lower()
    
    # Check if user exists
    user = db.query(User).filter(User.email == email).first()
    
    if not user:
        # Create new user from Google OAuth
        user = User(
            name=payload.name,
            email=email,
            password_hash=None,
            phone_number=payload.phone_number or "",
            whatsapp_number=payload.whatsapp_number or "",
            oauth_provider="google",
            oauth_id=payload.oauth_id,
            user_type=payload.user_type,
            user_mode=payload.user_mode,
            selected_category=payload.selected_category,
            subscription_plan=get_plan(payload.subscription_plan).display_name,
            approval_status="approved",
            is_verified=True,
            role="user",
        )
        db.add(user)
        db.flush()
        db.add(
            Subscription(
                user_id=user.id,
                plan_slug=get_plan(payload.subscription_plan).slug,
                plan_name=get_plan(payload.subscription_plan).name,
                amount=get_plan(payload.subscription_plan).amount_inr,
                status="approved",
                approved_by_admin=False,
            )
        )
    else:
        # Update existing user with OAuth info if needed
        if not user.oauth_provider:
            user.oauth_provider = "google"
            user.oauth_id = payload.oauth_id
        if payload.phone_number and not user.phone_number:
            user.phone_number = payload.phone_number
        if payload.whatsapp_number and not user.whatsapp_number:
            user.whatsapp_number = payload.whatsapp_number
    
    access_token, refresh_token = _create_session_tokens(user, request, db)
    _log_security(db, "google_oauth_login", request, user=user)
    db.commit()
    _set_auth_cookies(response, access_token, refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/oauth-profile", response_model=TokenResponse)
def oauth_profile(response: Response, request: Request, db: Session = Depends(get_db)):
    """Create or repair a local Vynora profile from a Supabase Google OAuth session."""
    settings = get_settings()
    auth_header = request.headers.get("authorization", "")
    if not auth_header.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing OAuth bearer token")

    supabase_token = auth_header.split(" ", 1)[1].strip()
    try:
        claims = jose_jwt.get_unverified_claims(supabase_token)
    except JWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid OAuth token")

    email = str(claims.get("email") or claims.get("user_metadata", {}).get("email") or "").lower()
    if not email:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Google OAuth profile did not include an email")

    metadata = claims.get("user_metadata") or {}
    app_metadata = claims.get("app_metadata") or {}
    oauth_id = str(claims.get("sub") or "")
    name = metadata.get("full_name") or metadata.get("name") or email.split("@")[0]
    avatar_url = metadata.get("avatar_url") or metadata.get("picture") or ""
    is_admin_user = email == settings.admin_email.lower()

    user = db.query(User).filter(User.email == email).first()
    if not user:
        plan = get_plan("student-basic")
        user = User(
            name=name,
            email=email,
            password_hash=None,
            phone_number="",
            whatsapp_number="",
            oauth_provider=app_metadata.get("provider") or "google",
            oauth_id=oauth_id,
            user_type="Student",
            user_mode="student",
            selected_category="Engineering opportunities",
            subscription_plan=plan.display_name,
            approval_status="approved" if is_admin_user else "pending",
            is_admin=is_admin_user,
            is_verified=True,
            avatar_url=avatar_url,
            role="admin" if is_admin_user else "user",
        )
        db.add(user)
        db.flush()
        db.add(
            Subscription(
                user_id=user.id,
                plan_slug=plan.slug,
                plan_name=plan.name,
                amount=plan.amount_inr,
                status="approved" if is_admin_user else "pending",
                approved_by_admin=is_admin_user,
            )
        )
    else:
        if not user.oauth_provider:
            user.oauth_provider = app_metadata.get("provider") or "google"
        if not user.oauth_id:
            user.oauth_id = oauth_id
        if avatar_url and not user.avatar_url:
            user.avatar_url = avatar_url
        if name and not user.name:
            user.name = name
        user.is_verified = True

    user.last_login_at = datetime.utcnow()
    access_token, refresh_token = _create_session_tokens(user, request, db)
    _log_security(db, "google_oauth_login", request, user=user)
    db.commit()
    _set_auth_cookies(response, access_token, refresh_token)
    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.put("/profile", response_model=UserResponse)
def update_profile(payload: ProfileUpdateRequest, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if payload.name is not None:
        current_user.name = payload.name
    if payload.phone_number is not None:
        current_user.phone_number = payload.phone_number
    if payload.whatsapp_number is not None:
        current_user.whatsapp_number = payload.whatsapp_number
    if payload.telegram_username is not None:
        current_user.telegram_username = payload.telegram_username
    if payload.user_type is not None:
        current_user.user_type = payload.user_type
    if payload.user_mode is not None:
        current_user.user_mode = payload.user_mode
    if payload.career_profile is not None:
        current_user.career_profile = payload.career_profile
    if payload.notifications_enabled is not None:
        current_user.notifications_enabled = payload.notifications_enabled
    if payload.selected_category is not None:
        current_user.selected_category = payload.selected_category
    if payload.subscription_plan is not None:
        current_user.subscription_plan = payload.subscription_plan
    if payload.avatar_url is not None:
        current_user.avatar_url = payload.avatar_url
    if payload.education_details is not None:
        current_user.education_details = payload.education_details
    if payload.bio is not None:
        current_user.bio = payload.bio

    db.commit()
    db.refresh(current_user)
    return current_user
