import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile, File
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user
from backend.app.core.config import get_settings
from backend.app.core.plans import get_plan, plans_as_dicts
from backend.app.db.session import get_db
from backend.app.models import AdminLog, Payment, Subscription, User

router = APIRouter(prefix="/subscriptions", tags=["subscriptions"])


@router.get("/plans")
def get_plans():
    return plans_as_dicts()


def _latest_subscription(db: Session, user_id: int) -> Subscription | None:
    return db.query(Subscription).filter(Subscription.user_id == user_id).order_by(Subscription.id.desc()).first()


def _upsert_pending_subscription(db: Session, user: User, plan_id: str) -> Subscription:
    plan = get_plan(plan_id)
    subscription = _latest_subscription(db, user.id)
    if not subscription or subscription.status in {"approved", "expired", "rejected"}:
        subscription = Subscription(user_id=user.id)
        db.add(subscription)
    subscription.plan_slug = plan.slug
    subscription.plan_name = plan.name
    subscription.amount = plan.amount_inr
    subscription.status = "pending"
    subscription.approved_by_admin = False
    user.subscription_plan = plan.display_name
    return subscription


@router.post("/checkout")
def create_checkout_session(
    payload: dict,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    settings = get_settings()
    plan = get_plan(payload.get("plan_id"))
    subscription = _upsert_pending_subscription(db, current_user, plan.slug)
    db.flush()

    if not settings.stripe_secret_key:
        db.commit()
        return {
            "checkout_url": "",
            "manual_payment_required": True,
            "detail": "Stripe is not configured. Manual payment verification remains available.",
        }

    try:
        import stripe
    except ImportError as exc:
        raise HTTPException(status_code=500, detail="Stripe SDK is not installed on the backend") from exc

    stripe.api_key = settings.stripe_secret_key
    session = stripe.checkout.Session.create(
        mode="payment",
        customer_email=current_user.email,
        success_url=settings.stripe_success_url,
        cancel_url=settings.stripe_cancel_url,
        metadata={"user_id": str(current_user.id), "subscription_id": str(subscription.id), "plan_slug": plan.slug},
        line_items=[
            {
                "quantity": 1,
                "price_data": {
                    "currency": "inr",
                    "unit_amount": plan.amount_inr * 100,
                    "product_data": {"name": f"Vynora Pulse {plan.name}"},
                },
            }
        ],
    )
    subscription.stripe_session_id = session.id
    payment = Payment(
        user_id=current_user.id,
        subscription_id=subscription.id,
        provider="stripe",
        amount=plan.amount_inr,
        currency="INR",
        status="checkout_created",
        stripe_session_id=session.id,
    )
    db.add(payment)
    db.commit()
    return {"checkout_url": session.url, "manual_payment_required": False}


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    settings = get_settings()
    if not settings.stripe_webhook_secret or not settings.stripe_secret_key:
        raise HTTPException(status_code=400, detail="Stripe webhook is not configured")

    payload = await request.body()
    signature = request.headers.get("stripe-signature", "")
    try:
        import stripe
        event = stripe.Webhook.construct_event(payload, signature, settings.stripe_webhook_secret)
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid Stripe webhook") from exc

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        subscription_id = int(session["metadata"]["subscription_id"])
        user_id = int(session["metadata"]["user_id"])
        subscription = db.query(Subscription).filter(Subscription.id == subscription_id).first()
        user = db.query(User).filter(User.id == user_id).first()
        if subscription and user:
            subscription.status = "pending"
            subscription.stripe_session_id = session["id"]
            user.approval_status = "payment_uploaded"
            payment = db.query(Payment).filter(Payment.stripe_session_id == session["id"]).first()
            if payment:
                payment.status = "paid_pending_admin"
            db.add(
                AdminLog(
                    admin_email="stripe@vynorapulse",
                    action="Stripe Payment Captured",
                    target_user_id=user.id,
                    details=f"Stripe checkout completed for {subscription.plan_name}. Awaiting admin approval.",
                )
            )
            db.commit()
    return {"received": True}


@router.post("/upload-payment")
async def upload_payment(
    plan_id: str = "",
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file selected")
    if file.content_type not in {"image/png", "image/jpeg", "image/webp"}:
        raise HTTPException(status_code=400, detail="Upload a PNG, JPG, or WEBP image")

    settings = get_settings()
    content = await file.read()
    if len(content) > settings.max_upload_mb * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"File must be {settings.max_upload_mb}MB or smaller")

    subscription = _upsert_pending_subscription(db, current_user, plan_id or current_user.subscription_plan)
    db.flush()
    os.makedirs("backend/uploads", exist_ok=True)
    ext = (file.filename.rsplit(".", 1)[-1] if "." in file.filename else "jpg").lower()
    if ext not in {"png", "jpg", "jpeg", "webp"}:
        ext = "jpg"
    safe_filename = f"user_{current_user.id}_{uuid.uuid4().hex}.{ext}"
    file_path = os.path.join("backend/uploads", safe_filename)

    with open(file_path, "wb") as buffer:
        buffer.write(content)

    current_user.payment_screenshot = f"/uploads/{safe_filename}"
    current_user.approval_status = "payment_uploaded"
    payment = Payment(
        user_id=current_user.id,
        subscription_id=subscription.id,
        provider="manual",
        amount=subscription.amount,
        currency="INR",
        status="pending",
        screenshot_path=current_user.payment_screenshot,
    )

    log = AdminLog(
        admin_email="system@vynorapulse",
        action="Payment Uploaded",
        target_user_id=current_user.id,
        details=f"User uploaded payment verification screenshot: {safe_filename}",
    )
    db.add(payment)
    db.add(log)
    db.commit()

    return {
        "status": "payment_uploaded",
        "payment_screenshot": current_user.payment_screenshot,
        "detail": "Payment screenshot uploaded successfully. Waiting for admin manual verification.",
    }
