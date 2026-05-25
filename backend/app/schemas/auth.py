from pydantic import BaseModel, EmailStr, Field


class SignupRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: EmailStr
    password: str | None = Field(default=None, min_length=8, max_length=128)
    phone_number: str = Field(pattern=r"^[+]?[0-9]{8,15}$")
    whatsapp_number: str | None = Field(default=None, pattern=r"^(whatsapp:\+)?[0-9+]{10,15}$")
    user_type: str = "Student"
    user_mode: str = "student"
    selected_category: str = "Engineering opportunities"
    subscription_plan: str = "student-basic"
    oauth_provider: str | None = None
    oauth_id: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str | None = None


class PasswordResetRequest(BaseModel):
    email: EmailStr


class PasswordResetConfirmRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str = "bearer"


class UserResponse(BaseModel):
    id: int
    name: str
    email: str
    phone_number: str | None
    whatsapp_number: str | None
    notifications_enabled: bool
    is_whatsapp_connected: bool
    whatsapp_connection_status: str
    razorpay_customer_id: str | None
    oauth_provider: str | None
    user_type: str
    user_mode: str
    career_profile: str
    telegram_username: str
    opportunities_tracked: int
    applications_submitted: int
    interviews_scheduled: int
    responsiveness_score: int
    spam_cleaned_count: int
    selected_category: str
    subscription_plan: str
    approval_status: str
    payment_screenshot: str
    is_admin: bool
    role: str
    is_verified: bool
    interests: str | None = ""
    education_details: str | None = ""
    bio: str | None = ""
    avatar_url: str | None = ""

    class Config:
        from_attributes = True


class ProfileUpdateRequest(BaseModel):
    name: str | None = None
    phone_number: str | None = None
    whatsapp_number: str | None = None
    telegram_username: str | None = None
    user_type: str | None = None
    user_mode: str | None = None
    career_profile: str | None = None
    notifications_enabled: bool | None = None
    selected_category: str | None = None
    subscription_plan: str | None = None
    avatar_url: str | None = None
    education_details: str | None = None
    bio: str | None = None
