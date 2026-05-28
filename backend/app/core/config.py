import os
from pathlib import Path

from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

DEFAULT_LOCAL_FRONTEND_URL = "http://localhost:5173"
DEFAULT_LOCAL_BACKEND_URL = "http://localhost:8000"
DEFAULT_PRODUCTION_FRONTEND_URL = "https://vynorapulse.vercel.app"
DEFAULT_PRODUCTION_BACKEND_URL = "https://vynora-pulse-api.onrender.com"


def _normalize_url(value: str | None, fallback: str) -> str:
    if value is None:
        return fallback

    stripped = value.strip()
    if not stripped:
        return fallback

    return stripped.rstrip("/")


def _is_localhost_url(value: str | None) -> bool:
    if not value:
        return True

    lowered = value.lower()
    return (
        lowered.startswith("http://localhost")
        or lowered.startswith("http://127.0.0.1")
        or lowered == "localhost"
        or lowered == "127.0.0.1"
    )


class Settings(BaseSettings):
    app_name: str = "Vynora Pulse"
    environment: str = os.getenv("ENVIRONMENT", "development")
    api_base_url: str = os.getenv("API_BASE_URL", "")
    frontend_url: str = os.getenv("FRONTEND_URL", DEFAULT_LOCAL_FRONTEND_URL)
    backend_url: str = os.getenv("BACKEND_URL", DEFAULT_LOCAL_BACKEND_URL)

    # Database
    database_url: str = os.getenv(
        "DATABASE_URL",
        "postgresql://vynorapulseuser:d8afpAVhFCOGULBDgIZaopi6Y1XlVWuv@dpg-d8a16j67r5hc73dvp3q0-a.virginia-postgres.render.com/vynorapulse",
    ).strip()

    # JWT & Security
    jwt_secret: str = "change-me-with-32-random-bytes"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 15
    refresh_token_expire_days: int = 30
    fernet_key: str = "generate-with-python-cryptography-fernet"
    app_secret_key: str = "change-this-development-secret"
    secure_cookies: bool = False

    # GROQ API
    groq_api_key: str = ""
    groq_model: str = "llama-3.1-8b-instant"

    # Gmail OAuth
    gmail_client_id: str = ""
    gmail_client_secret: str = ""
    gmail_redirect_uri: str = ""

    # Google OAuth (Supabase)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""

    # Supabase
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""

    # Razorpay
    razorpay_key_id: str = ""
    razorpay_key_secret: str = ""
    razorpay_webhook_secret: str = ""
    payment_contact_number: str = "8106944811"
    payment_contact_email: str = "noreply@vynorapulse.com"

    # Plan pricing (overridable via env)
    plan_student_basic_price: int = 29
    plan_student_pro_price: int = 79
    plan_professional_price: int = 99
    plan_business_price: int = 199

    # WhatsApp
    twilio_account_sid: str = ""
    twilio_auth_token: str = ""
    twilio_phone_number: str = ""
    whatsapp_phone_number: str = "+8106944811"
    whatsapp_service_url: str = os.getenv("WHATSAPP_SERVICE_URL", "http://localhost:3001")
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: str = ""
    wa_web_service_url: str = os.getenv("WA_WEB_SERVICE_URL", "http://localhost:3001")

    # Admin
    admin_email: str = "vynoraautomations@gmail.com"
    admin_initial_password: str = "change-this-admin-password"

    # Polling
    poll_interval_seconds: int = 60

    # CORS
    cors_origins: str = os.getenv(
        "CORS_ORIGINS",
        "https://vynorapulse.vercel.app,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000,http://localhost:8000",
    )

    # File uploads
    max_upload_mb: int = 5

    # Legacy Stripe (keep for backward compatibility)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_success_url: str = ""
    stripe_cancel_url: str = ""

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[3] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @model_validator(mode="after")
    def apply_runtime_defaults(self):
        environment = (self.environment or "development").lower()

        if environment == "production":
            self.frontend_url = _normalize_url(self.frontend_url, DEFAULT_PRODUCTION_FRONTEND_URL)
            self.backend_url = _normalize_url(self.backend_url, DEFAULT_PRODUCTION_BACKEND_URL)
            if _is_localhost_url(self.frontend_url):
                self.frontend_url = DEFAULT_PRODUCTION_FRONTEND_URL
            if _is_localhost_url(self.backend_url):
                self.backend_url = DEFAULT_PRODUCTION_BACKEND_URL
            if not self.api_base_url or _is_localhost_url(self.api_base_url):
                self.api_base_url = self.backend_url
            if not self.stripe_success_url or _is_localhost_url(self.stripe_success_url):
                self.stripe_success_url = f"{self.frontend_url.rstrip('/')}/subscription?payment=success"
            if not self.stripe_cancel_url or _is_localhost_url(self.stripe_cancel_url):
                self.stripe_cancel_url = f"{self.frontend_url.rstrip('/')}/subscription?payment=cancelled"
            self.secure_cookies = True
        else:
            self.frontend_url = _normalize_url(self.frontend_url, DEFAULT_LOCAL_FRONTEND_URL)
            self.backend_url = _normalize_url(self.backend_url, DEFAULT_LOCAL_BACKEND_URL)
            self.api_base_url = _normalize_url(self.api_base_url, self.backend_url)

        if not self.gmail_redirect_uri or _is_localhost_url(self.gmail_redirect_uri):
            self.gmail_redirect_uri = f"{self.backend_url.rstrip('/')}/api/gmail/callback"

        if not self.google_redirect_uri or _is_localhost_url(self.google_redirect_uri):
            self.google_redirect_uri = f"{self.backend_url.rstrip('/')}/api/auth/google/callback"

        return self


def get_settings() -> Settings:
    return Settings()
