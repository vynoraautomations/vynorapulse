from datetime import datetime
from typing import Optional, List

from sqlalchemy import Boolean, DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.sqlite import TEXT

from backend.app.db.session import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(120))
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=True, default="")
    phone_number: Mapped[str] = mapped_column(String(20), nullable=True, default="")
    whatsapp_number: Mapped[str] = mapped_column(String(40), nullable=True, default="")
    notifications_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    is_whatsapp_connected: Mapped[bool] = mapped_column(Boolean, default=False)
    whatsapp_connection_status: Mapped[str] = mapped_column(String(50), default="disconnected")
    razorpay_customer_id: Mapped[str] = mapped_column(String(100), nullable=True, default="")
    oauth_provider: Mapped[str] = mapped_column(String(50), nullable=True, default="")
    oauth_id: Mapped[str] = mapped_column(String(255), nullable=True, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Vynora Pulse Profile & Career Operating System fields
    user_type: Mapped[str] = mapped_column(String(100), default="Engineering Students")
    user_mode: Mapped[str] = mapped_column(String(50), default="student") # student or professional
    career_profile: Mapped[str] = mapped_column(String(255), default="AIML, Full Stack, Software Engineering")
    telegram_username: Mapped[str] = mapped_column(String(100), default="")
    opportunities_tracked: Mapped[int] = mapped_column(String(10), default="0")
    applications_submitted: Mapped[int] = mapped_column(String(10), default="0")
    interviews_scheduled: Mapped[int] = mapped_column(String(10), default="0")
    responsiveness_score: Mapped[int] = mapped_column(String(3), default="92")
    spam_cleaned_count: Mapped[int] = mapped_column(String(10), default="0")

    # Extra profile fields
    interests: Mapped[str] = mapped_column(String(500), default="")
    education_details: Mapped[str] = mapped_column(String(500), default="")
    bio: Mapped[str] = mapped_column(String(500), default="")
    avatar_url: Mapped[str] = mapped_column(String(500), default="")

    # Production SaaS fields
    selected_category: Mapped[str] = mapped_column(String(150), default="Engineering opportunities")
    subscription_plan: Mapped[str] = mapped_column(String(100), default="STUDENT BASIC — ₹29/month")
    approval_status: Mapped[str] = mapped_column(String(50), default="pending")
    payment_screenshot: Mapped[str] = mapped_column(String(500), default="")
    is_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    role: Mapped[str] = mapped_column(String(40), default="user")
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    last_login_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)

    gmail_account = relationship("GmailAccount", back_populates="user", uselist=False)
    emails = relationship("ImportantEmail", back_populates="user")
    notifications = relationship("Notification", back_populates="user")
    digests = relationship("DailyDigest", back_populates="user")
    subscriptions = relationship("Subscription", back_populates="user")
    payments = relationship("Payment", back_populates="user")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")

    # Upgraded SaaS relationships
    keywords = relationship("Keyword", back_populates="user", cascade="all, delete-orphan")
    user_goals = relationship("UserGoal", back_populates="user", cascade="all, delete-orphan")
    delivery_logs = relationship("DeliveryLog", back_populates="user", cascade="all, delete-orphan")
