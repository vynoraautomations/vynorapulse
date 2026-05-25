from dataclasses import dataclass

from backend.app.core.config import get_settings


@dataclass(frozen=True)
class Plan:
    slug: str
    name: str
    amount_inr: int
    interval: str
    features: tuple[str, ...]
    popular: bool = False

    @property
    def display_name(self) -> str:
        return f"{self.name} - INR {self.amount_inr}/month"


BASE_PLANS: dict[str, Plan] = {
    "student-basic": Plan(
        slug="student-basic",
        name="Student Basic",
        amount_inr=29,
        interval="month",
        features=("Gmail alerts", "WhatsApp alerts", "Daily digest"),
    ),
    "student-pro": Plan(
        slug="student-pro",
        name="Student Pro",
        amount_inr=79,
        interval="month",
        features=("Instant AI filtering", "Priority alerts", "Deadline reminders", "Opportunity ranking"),
        popular=True,
    ),
    "professional": Plan(
        slug="professional",
        name="Professional",
        amount_inr=99,
        interval="month",
        features=("Job opportunities", "Recruiter emails", "AI summaries", "Interview tracking"),
    ),
    "business": Plan(
        slug="business",
        name="Business",
        amount_inr=199,
        interval="month",
        features=("Client lead alerts", "Team notifications", "Smart analytics", "Sales inquiry detection"),
    ),
}

LEGACY_PLAN_ALIASES = {
    "STUDENT BASIC": "student-basic",
    "STUDENT PRO": "student-pro",
    "PROFESSIONAL": "professional",
    "BUSINESS": "business",
}


def _get_plan_overrides() -> dict[str, int]:
    settings = get_settings()
    return {
        "student-basic": settings.plan_student_basic_price,
        "student-pro": settings.plan_student_pro_price,
        "professional": settings.plan_professional_price,
        "business": settings.plan_business_price,
    }


def _build_plans() -> dict[str, Plan]:
    overrides = _get_plan_overrides()
    return {
        slug: Plan(
            slug=base.slug,
            name=base.name,
            amount_inr=overrides.get(slug, base.amount_inr),
            interval=base.interval,
            features=base.features,
            popular=base.popular,
        )
        for slug, base in BASE_PLANS.items()
    }


def get_plan(plan_id: str | None) -> Plan:
    plans = _build_plans()
    if not plan_id:
        return plans["student-basic"]
    if plan_id in plans:
        return plans[plan_id]
    normalized = plan_id.upper()
    for legacy, slug in LEGACY_PLAN_ALIASES.items():
        if normalized.startswith(legacy):
            return plans[slug]
    return plans["student-basic"]


def plans_as_dicts() -> list[dict]:
    return [
        {
            "slug": plan.slug,
            "name": plan.name,
            "amount_inr": plan.amount_inr,
            "interval": plan.interval,
            "features": list(plan.features),
            "popular": plan.popular,
            "display_name": plan.display_name,
        }
        for plan in _build_plans().values()
    ]
