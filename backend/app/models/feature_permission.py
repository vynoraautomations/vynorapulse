from sqlalchemy import Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from backend.app.db.session import Base


class FeaturePermission(Base):
    __tablename__ = "feature_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    plan_slug: Mapped[str] = mapped_column(String(50), index=True) # student-basic, student-pro, professional, business
    feature_name: Mapped[str] = mapped_column(String(100)) # gmail_alerts, whatsapp_alerts, daily_digest, instant_ai_filtering, etc.
    is_enabled: Mapped[bool] = mapped_column(Boolean, default=True)
