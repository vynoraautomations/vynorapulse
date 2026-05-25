import os
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Vynora Pulse"
    environment: str = "development"
    api_base_url: str = "http://localhost:8000"
    frontend_url: str = "http://localhost:5173"
    backend_url: str = "http://localhost:8000"
    
    # Database
    DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://vynorapulseuser:d8afpAVhFCOGULBDgIZaopi6Y1XlVWuv@dpg-d8a16j67r5hc73dvp3q0-a.virginia-postgres.render.com/vynorapulse"
)
    
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
    gmail_redirect_uri: str = "http://localhost:8000/api/gmail/callback"
    
    # Google OAuth (Supabase)
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/auth/google/callback"
    
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
    whatsapp_service_url: str = "http://localhost:3001"
    whatsapp_access_token: str = ""
    whatsapp_phone_number_id: str = ""
    whatsapp_verify_token: str = ""
    wa_web_service_url: str = "http://localhost:3001"

    # Admin
    admin_email: str = "vynoraautomations@gmail.com"
    admin_initial_password: str = "change-this-admin-password"

    # Polling
    poll_interval_seconds: int = 60

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8000,http://127.0.0.1:5173"

    # File uploads
    max_upload_mb: int = 5

    # Legacy Stripe (keep for backward compatibility)
    stripe_secret_key: str = ""
    stripe_webhook_secret: str = ""
    stripe_success_url: str = "http://localhost:5173/subscription?payment=success"
    stripe_cancel_url: str = "http://localhost:5173/subscription?payment=cancelled"

    model_config = SettingsConfigDict(
        env_file=str(Path(__file__).resolve().parents[3] / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )


def get_settings() -> Settings:
    return Settings()
