from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.api.deps import get_current_user, require_active_subscription
from backend.app.db.session import get_db
from backend.app.models import User, DailyDigest, ImportantEmail
from backend.app.services.whatsapp_service import WhatsAppService

router = APIRouter(prefix="/digests", tags=["digests"])
whatsapp = WhatsAppService()


@router.post("/generate")
def generate_digest(
    send_whatsapp: bool = False,
    current_user: User = Depends(require_active_subscription),
    db: Session = Depends(get_db),
):
    today_str = datetime.utcnow().strftime("%Y-%m-%d")

    # Fetch recent emails matching user's selected category
    emails = (
        db.query(ImportantEmail)
        .filter(ImportantEmail.user_id == current_user.id)
        .order_by(ImportantEmail.created_at.desc())
        .limit(10)
        .all()
    )

    category = current_user.selected_category or "Engineering opportunities"
    
    if not emails:
        content = (
            f"📅 DAILY OPPORTUNITY DIGEST — {category}\n"
            f"Date: {today_str}\n\n"
            "✨ Your inbox is completely up to date! Future Impact AI is continuously scanning your Gmail background stream for new opportunities."
        )
    else:
        critical_count = sum(1 for e in emails if e.urgency == "Critical" and not e.is_opened)
        lines = [
            f"⚡ VYNORA PULSE | DAILY AI BRIEFING ⚡",
            f"🎯 Focus Category: {category}",
            f"📅 Date: {today_str}",
            f"🔥 Critical Deadlines Pending: {critical_count}",
            "\n📌 TOP OPPORTUNITIES RADAR:",
        ]
        for idx, e in enumerate(emails[:5], 1):
            comp = e.company or e.sender.split("@")[0].upper()
            lines.append(f"{idx}. [{comp}] {e.subject[:60]}... (Match: {e.relevance_score}%)")
            lines.append(f"   💡 {e.summary}")
            lines.append(f"   ⚡ Action: {e.suggested_action}\n")

        lines.append("\nNever Miss What Changes Your Future. ✨ Log into your Vynora Pulse dashboard to view full links and apply.")
        content = "\n".join(lines)

    digest = DailyDigest(
        user_id=current_user.id,
        category=category,
        digest_date=today_str,
        content=content,
        is_sent_whatsapp=send_whatsapp,
    )
    db.add(digest)

    if send_whatsapp and current_user.whatsapp_number:
        whatsapp.send_message(current_user.whatsapp_number, content)

    db.commit()
    db.refresh(digest)
    return digest


@router.get("")
def get_user_digests(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    digests = (
        db.query(DailyDigest)
        .filter(DailyDigest.user_id == current_user.id)
        .order_by(DailyDigest.id.desc())
        .limit(15)
        .all()
    )
    return digests
