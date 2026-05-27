import logging
import os
import time
from collections import defaultdict, deque
from datetime import datetime

import urllib.request
urllib.request.getproxies = lambda: {}

os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
for key in ["HTTP_PROXY", "HTTPS_PROXY", "http_proxy", "https_proxy"]:
    if key in os.environ:
        del os.environ[key]
os.environ["NO_PROXY"] = "*"
os.environ["no_proxy"] = "*"

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.api import auth, auth_supabase, dashboard, gmail, notifications, subscriptions, admin, digests, settings as settings_api, payments, whatsapp
from backend.app.core.config import get_settings
from backend.app.core.security import hash_password, verify_password
from backend.app.db.session import Base, engine, upgrade_db_schema
from backend.app.models import *  # noqa: F401,F403 - imports models so SQLAlchemy can create tables
from backend.app.services.monitor import monitor
from sqlalchemy.orm import Session

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)

os.makedirs("backend/uploads", exist_ok=True)

settings = get_settings()
Base.metadata.create_all(bind=engine)
try:
    upgrade_db_schema()
except Exception as e:
    logging.error(f"Error upgrading schema: {e}")


app = FastAPI(title="Vynora Pulse API", version="2.5.0")

app.mount("/uploads", StaticFiles(directory="backend/uploads"), name="uploads")

allowed_origins = [origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()]
if settings.frontend_url not in allowed_origins:
    allowed_origins.append(settings.frontend_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_rate_limit_windows: dict[str, deque] = defaultdict(deque)


def seed_admin_user():
    if not settings.admin_email or not settings.admin_initial_password:
        return
    with Session(engine) as db:
        email = settings.admin_email.lower()
        admin_phone = settings.whatsapp_phone_number or "+8106944811"

        extra_admins = db.query(User).filter(User.is_admin == True, User.email != email).all()
        for extra in extra_admins:
            # Delete sessions first to avoid cascade issues
            from backend.app.models.user_session import UserSession
            db.query(UserSession).filter(UserSession.user_id == extra.id).delete()
            db.delete(extra)

        user = db.query(User).filter(User.email == email).first()
        if user:
            user.is_admin = True
            user.role = "admin"
            user.is_verified = True
            user.approval_status = "approved"
            user.whatsapp_number = f"whatsapp:{admin_phone}"
            user.phone_number = admin_phone
            current_password_hash = user.password_hash or ""
            if not verify_password(settings.admin_initial_password, current_password_hash):
                user.password_hash = hash_password(settings.admin_initial_password)
        else:
            user = User(
                name="Vynora Admin",
                email=email,
                password_hash=hash_password(settings.admin_initial_password),
                whatsapp_number=f"whatsapp:{admin_phone}",
                phone_number=admin_phone,
                user_type="Administrator",
                user_mode="professional",
                selected_category="Platform administration",
                subscription_plan="Business - INR 199/month",
                approval_status="approved",
                is_admin=True,
                role="admin",
                is_verified=True,
                created_at=datetime.utcnow(),
            )
            db.add(user)
        db.commit()


try:
    seed_admin_user()
except Exception as e:
    logging.error(f"Error seeding admin user: {e}")


@app.middleware("http")
async def rate_limit_and_csrf(request: Request, call_next):
    if request.method != "OPTIONS" and request.url.path.startswith("/api/"):
        client = request.headers.get("x-forwarded-for", "").split(",")[0].strip()
        client = client or (request.client.host if request.client else "unknown")
        key = f"{client}:{request.url.path}"
        now = time.monotonic()
        window = _rate_limit_windows[key]
        while window and now - window[0] > 60:
            window.popleft()
        limit = 20 if request.url.path in {"/api/auth/login", "/api/auth/signup"} else 120
        if len(window) >= limit:
            from fastapi.responses import JSONResponse

            return JSONResponse({"detail": "Too many requests. Please try again shortly."}, status_code=429)
        window.append(now)

        if request.method in {"POST", "PUT", "PATCH", "DELETE"} and request.url.path not in {"/api/auth/login", "/api/auth/signup"}:
            has_bearer = bool(request.headers.get("authorization"))
            csrf_cookie = request.cookies.get("csrf_token")
            if csrf_cookie and not has_bearer and request.headers.get("x-csrf-token") != csrf_cookie:
                from fastapi.responses import JSONResponse
                return JSONResponse({"detail": "Invalid CSRF token"}, status_code=403)
    return await call_next(request)

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Content-Security-Policy"] = "frame-ancestors 'none'; default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://kpurpdeyxwngmubrjpkd.supabase.co; form-action 'self';"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["X-Permitted-Cross-Domain-Policies"] = "none"
    return response

app.include_router(auth_supabase.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(gmail.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(notifications.router, prefix="/api")
app.include_router(subscriptions.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(digests.router, prefix="/api")
app.include_router(settings_api.router, prefix="/api")
app.include_router(payments.router, prefix="/api")
app.include_router(whatsapp.router, prefix="/api")
from backend.app.api import webhook
app.include_router(webhook.router)


@app.on_event("startup")
async def startup_event():
    monitor.start()


@app.on_event("shutdown")
async def shutdown_event():
    monitor.stop()


@app.get("/health")
def health():
    return {"status": "ok"}
