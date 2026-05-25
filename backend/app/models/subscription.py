from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.session import Base


class Subscription(Base):
    __tablename__ = "subscriptions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    plan_slug: Mapped[str] = mapped_column(String(80), default="student-basic", index=True)
    plan_name: Mapped[str] = mapped_column(String(120), default="Student Basic")
    amount: Mapped[int] = mapped_column(Integer, default=29)
    status: Mapped[str] = mapped_column(String(50), default="pending", index=True)
    stripe_session_id: Mapped[str] = mapped_column(String(255), default="", index=True)
    approved_by_admin: Mapped[bool] = mapped_column(Boolean, default=False)
    approved_by_admin_id: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    approved_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    expires_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="subscriptions")
