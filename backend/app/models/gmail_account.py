from typing import Optional
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.session import Base


class GmailAccount(Base):
    __tablename__ = "gmail_tokens"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True)
    gmail_email: Mapped[str] = mapped_column(String(255), default="")
    access_token: Mapped[str] = mapped_column(Text)
    refresh_token: Mapped[str] = mapped_column(Text, default="")
    token_uri: Mapped[str] = mapped_column(String(255), default="https://oauth2.googleapis.com/token")
    scopes: Mapped[str] = mapped_column(Text, default="")
    last_history_id: Mapped[str] = mapped_column(String(100), default="")
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    monitoring_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="gmail_account")
