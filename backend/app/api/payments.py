from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
import os

from backend.app.api.deps import get_current_user
from backend.app.core.config import get_settings
from backend.app.core.plans import get_plan
from backend.app.db.session import get_db
from backend.app.models import User, Payment, Subscription
from backend.app.schemas.auth import UserResponse
from pydantic import BaseModel

router = APIRouter(prefix="/payments", tags=["payments"])

settings = get_settings()

try:
    import razorpay
except ImportError:
    razorpay = None


def get_razorpay_client():
    if not razorpay or not settings.razorpay_key_id or not settings.razorpay_key_secret:
        raise HTTPException(
            status_code=503,
            detail="Razorpay automatic checkout is not configured. Use manual payment verification.",
        )
    return razorpay.Client(auth=(settings.razorpay_key_id, settings.razorpay_key_secret))


class OrderCreateRequest(BaseModel):
    amount: int  # in paise (1 rupee = 100 paise)
    plan_id: str
    plan_name: str


class PaymentVerifyRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str


@router.post("/create-order")
def create_order(
    payload: OrderCreateRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a Razorpay order for payment"""
    try:
        order_data = {
            "amount": payload.amount,
            "currency": "INR",
            "receipt": f"order_{current_user.id}_{current_user.email}",
            "notes": {
                "user_id": str(current_user.id),
                "email": current_user.email,
                "plan_id": payload.plan_id,
                "plan_name": payload.plan_name,
            },
        }

        razorpay_client = get_razorpay_client()
        order = razorpay_client.order.create(data=order_data)

        # Store order in database
        payment = Payment(
            user_id=current_user.id,
            order_id=order["id"],
            amount=payload.amount,
            currency="INR",
            plan_id=payload.plan_id,
            status="created",
            metadata_json={"plan_name": payload.plan_name},
        )
        db.add(payment)
        db.commit()

        return {
            "order_id": order["id"],
            "amount": order["amount"],
            "currency": order["currency"],
            "key_id": settings.razorpay_key_id,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/verify-payment")
def verify_payment(
    payload: PaymentVerifyRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify Razorpay payment signature"""
    try:
        # Verify signature
        params_dict = {
            "razorpay_order_id": payload.razorpay_order_id,
            "razorpay_payment_id": payload.razorpay_payment_id,
            "razorpay_signature": payload.razorpay_signature,
        }

        razorpay_client = get_razorpay_client()
        razorpay_client.utility.verify_payment_signature(params_dict)

        # Update payment status
        payment = (
            db.query(Payment)
            .filter(
                Payment.order_id == payload.razorpay_order_id,
                Payment.user_id == current_user.id,
            )
            .first()
        )

        if not payment:
            raise HTTPException(status_code=404, detail="Payment record not found")

        payment.payment_id = payload.razorpay_payment_id
        payment.status = "completed"

        # Update subscription status
        plan = get_plan(payment.plan_id or current_user.subscription_plan)
        current_user.subscription_plan = plan.display_name
        current_user.approval_status = "approved"

        subscription = (
            db.query(Subscription)
            .filter(Subscription.user_id == current_user.id)
            .order_by(Subscription.id.desc())
            .first()
        )

        if subscription is None:
            subscription = Subscription(user_id=current_user.id)
            db.add(subscription)

        subscription.plan_slug = plan.slug
        subscription.plan_name = plan.name
        subscription.amount = plan.amount_inr
        subscription.status = "active"
        subscription.approved_by_admin = True

        # Add Razorpay customer ID if not already set
        if not current_user.razorpay_customer_id:
            current_user.razorpay_customer_id = payload.razorpay_payment_id

        db.commit()
        db.refresh(current_user)

        return {
            "status": "success",
            "message": "Payment verified and processed",
            "user": UserResponse.from_orm(current_user),
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Payment verification failed: {str(e)}")


@router.get("/payment-status/{order_id}")
def get_payment_status(
    order_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get payment status"""
    try:
        payment = (
            db.query(Payment)
            .filter(
                Payment.order_id == order_id, Payment.user_id == current_user.id
            )
            .first()
        )

        if not payment:
            raise HTTPException(status_code=404, detail="Payment not found")

        return {
            "order_id": payment.order_id,
            "payment_id": payment.payment_id,
            "amount": payment.amount,
            "status": payment.status,
            "created_at": payment.created_at,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/payment-link")
def get_payment_link(
    amount: int = 2900,  # Default to ₹29
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get payment link for QR code generation"""
    try:
        upi_id = f"upi://pay?pa={settings.payment_contact_number}@okhdfcbank&pn=VynoraPulse&am={amount/100}"

        order_data = {
            "amount": amount,
            "currency": "INR",
            "receipt": f"order_{current_user.id}_{current_user.email}",
            "payment_capture": 1,
            "notes": {
                "user_id": str(current_user.id),
                "email": current_user.email,
                "contact": settings.payment_contact_number,
            },
        }

        razorpay_client = get_razorpay_client()
        order = razorpay_client.order.create(data=order_data)

        # Create payment link
        payment_link_data = {
            "amount": amount,
            "currency": "INR",
            "accept_partial": True,
            "first_min_partial_amount": 100,
            "description": f"Vynora Pulse Subscription - {amount/100} INR",
            "customer_notify": 1,
            "notify": {"sms": True, "email": True},
            "reminder_enable": True,
            "notes": {
                "user_id": str(current_user.id),
                "email": current_user.email,
            },
            "callback_url": f"{settings.api_base_url}/api/payments/callback",
            "callback_method": "get",
        }

        link = razorpay_client.payment_link.create(data=payment_link_data)

        return {
            "order_id": order["id"],
            "payment_link": link["short_url"],
            "qr_code_url": f"https://api.qrserver.com/v1/create-qr-code/?size=300x300&data={link['short_url']}",
            "upi_link": upi_id,
            "amount": amount / 100,
            "currency": "INR",
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to create payment link: {str(e)}")


@router.get("/callback")
def payment_callback(
    razorpay_payment_id: str = None,
    razorpay_order_id: str = None,
    razorpay_signature: str = None,
    db: Session = Depends(get_db),
):
    """Handle Razorpay payment callback"""
    try:
        if not all([razorpay_payment_id, razorpay_order_id, razorpay_signature]):
            return {"status": "error", "message": "Missing callback parameters"}

        params_dict = {
            "razorpay_order_id": razorpay_order_id,
            "razorpay_payment_id": razorpay_payment_id,
            "razorpay_signature": razorpay_signature,
        }

        razorpay_client = get_razorpay_client()
        razorpay_client.utility.verify_payment_signature(params_dict)

        # Process payment
        payment = db.query(Payment).filter(Payment.order_id == razorpay_order_id).first()

        if payment:
            payment.payment_id = razorpay_payment_id
            payment.status = "completed"

            # Update subscription
            subscription = (
                db.query(Subscription)
                .filter(
                    Subscription.user_id == payment.user_id,
                    Subscription.status == "pending",
                )
                .first()
            )

            if subscription:
                subscription.status = "active"
                subscription.approved_by_admin = True

            user = db.query(User).filter(User.id == payment.user_id).first()
            if user:
                user.approval_status = "approved"
                user.razorpay_customer_id = razorpay_payment_id

            db.commit()

        return {"status": "success", "message": "Payment processed"}
    except Exception as e:
        return {"status": "error", "message": str(e)}
