from datetime import datetime
from pydantic import BaseModel


class EmailResponse(BaseModel):
    id: int
    sender: str
    subject: str
    summary: str
    category: str
    priority: str
    gmail_link: str
    is_notified: bool
    created_at: datetime
    relevance_score: int
    urgency: str
    suggested_action: str
    opportunity_value: str
    company: str
    deadline: datetime | None
    status: str
    is_opened: bool
    is_ignored: bool

    class Config:
        from_attributes = True


class NotificationResponse(BaseModel):
    id: int
    channel: str
    recipient: str
    message: str
    status: str
    error_message: str
    created_at: datetime

    class Config:
        from_attributes = True


class StatusResponse(BaseModel):
    gmail_connected: bool
    gmail_email: str
    monitoring_enabled: bool
    notifications_enabled: bool
    poll_interval_seconds: int
    last_checked_at: datetime | None


class DashboardResponse(BaseModel):
    status: StatusResponse
    recent_emails: list[EmailResponse]
    notifications: list[NotificationResponse]
    categories: dict[str, int]
    priorities: dict[str, int]

