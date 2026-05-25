from datetime import datetime
from typing import Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.session import Base


class Payment(Base):
    __tablename__ = "payments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    subscription_id: Mapped[Optional[int]] = mapped_column(ForeignKey("subscriptions.id"), nullable=True)
    provider: Mapped[str] = mapped_column(String(40), default="razorpay")
    amount: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(10), default="INR")
    status: Mapped[str] = mapped_column(String(50), default="pending", index=True)
    
    # Razorpay specific fields
    order_id: Mapped[Optional[str]] = mapped_column(String(255), default="", index=True)
    payment_id: Mapped[Optional[str]] = mapped_column(String(255), default="", index=True)
    plan_id: Mapped[Optional[str]] = mapped_column(String(100), default="")
    
    # Legacy/Alternative payment methods
    stripe_session_id: Mapped[str] = mapped_column(String(255), default="", index=True)
    screenshot_path: Mapped[str] = mapped_column(String(500), default="")
    
    # Metadata
    metadata_json: Mapped[Optional[dict]] = mapped_column("metadata", JSON, nullable=True)
    
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    user = relationship("User", back_populates="payments")
    subscription = relationship("Subscription")
