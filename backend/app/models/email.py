from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.session import Base


class ImportantEmail(Base):
    __tablename__ = "alerts"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    gmail_message_id: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    sender: Mapped[str] = mapped_column(String(500))
    subject: Mapped[str] = mapped_column(String(500))
    snippet: Mapped[str] = mapped_column(Text, default="")
    summary: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(80))
    priority: Mapped[str] = mapped_column(String(30))
    gmail_link: Mapped[str] = mapped_column(Text)
    is_notified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Future Impact AI fields
    relevance_score: Mapped[int] = mapped_column(Integer, default=92)
    urgency: Mapped[str] = mapped_column(String(50), default="High")
    suggested_action: Mapped[str] = mapped_column(String(255), default="Review and apply within 24 hours.")
    opportunity_value: Mapped[str] = mapped_column(String(255), default="High Career Impact")
    company: Mapped[str] = mapped_column(String(255), default="Top Tech Partner")
    deadline: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="Pending") # Applied, Pending, Interview, Rejected, Offer Received
    is_opened: Mapped[bool] = mapped_column(Boolean, default=False)
    is_ignored: Mapped[bool] = mapped_column(Boolean, default=False)

    user = relationship("User", back_populates="emails")

