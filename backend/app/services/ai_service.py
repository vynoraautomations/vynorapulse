import asyncio
import json
import logging
import re
from dataclasses import dataclass

from groq import Groq

from backend.app.core.config import get_settings

logger = logging.getLogger(__name__)

IMPORTANT_KEYWORDS = {
    "internship": "Internships",
    "intern": "Internships",
    "interview": "Jobs & HR Rounds",
    "hr round": "Jobs & HR Rounds",
    "walk-in": "Jobs & HR Rounds",
    "job": "Jobs & HR Rounds",
    "hiring": "Jobs & HR Rounds",
    "round": "Jobs & HR Rounds",
    "assessment": "Online Assessment",
    "online assessment": "Online Assessment",
    "coding test": "Online Assessment",
    "hackerrank": "Online Assessment",
    "shortlisted": "Selection Result",
    "selected": "Selection Result",
    "selection": "Selection Result",
    "offer letter": "Offer Letter",
    "placement": "Placement",
    "hackathon": "Coding Hackathons",
    "coding hackathon": "Coding Hackathons",
    "tech event": "Tech Events",
    "event": "Tech Events",
    "webinar": "Tech Events",
    "scholarship": "Scholarship",
    "career opportunity": "Career Opportunity",
    "congratulations": "Selection Result",
    "deadline": "Deadline",
    "last date": "Deadline",
    "eamcet": "EAMCET Counselling",
    "counselling": "EAMCET Counselling",
    "seat allotment": "EAMCET Counselling",
    "jee": "Selection Result",
    "neet": "Selection Result",
    "bitsat": "Selection Result",
    "coupon": "Coupons & Offers",
    "discount": "Coupons & Offers",
    "special offer": "Coupons & Offers",
}

SPAM_WORDS = [
    "instagram", "snapchat", "tiktok", "unsubscribe",
    "newsletter", "promotional", "zomato", "swiggy", "amazon order", "flipkart", "myntra"
]

@dataclass
class ClassificationResult:
    important: bool
    category: str
    priority: str
    summary: str
    reason: str
    relevance_score: int
    urgency: str
    suggested_action: str
    opportunity_value: str
    company: str


class AIService:
    def __init__(self):
        self.settings = get_settings()
        self.client = Groq(api_key=self.settings.groq_api_key) if self.settings.groq_api_key else None
        self._groq_disabled = False  # circuit breaker flag

    async def classify_email(self, sender: str, subject: str, body: str, user_profile: str = "") -> ClassificationResult:
        text = f"{sender}\n{subject}\n{body[:4000]}"
        
        # 1. FAST PATH: Check custom keywords first. If a match is found, bypass AI entirely for an instant WhatsApp alert.
        fast_check = self._classify_with_keywords(text, subject, sender, user_profile)
        if fast_check.important and "matches your target interest" in fast_check.suggested_action:
            logger.info("⚡ Fast-path custom keyword match! Bypassing Groq AI for instant WhatsApp alert.")
            return fast_check
            
        # 2. AI CLASSIFICATION PATH
        if self.client and not self._groq_disabled:
            try:
                return await asyncio.to_thread(self._classify_with_groq, sender, subject, body, user_profile)
            except Exception as exc:
                err_str = str(exc)
                if "rate_limit" in err_str.lower() or "quota" in err_str.lower() or "insufficient" in err_str.lower():
                    logger.warning("Groq quota/rate-limit hit — disabling Groq AI, falling back to keyword classifier.")
                    self._groq_disabled = True
                else:
                    logger.exception("Groq classification failed, using keyword fallback: %s", exc)
                    
        # 3. FALLBACK PATH
        return fast_check

    def _classify_with_groq(self, sender: str, subject: str, body: str, user_profile: str) -> ClassificationResult:
        prompt = f"""
You are Future Impact AI, an opportunity intelligence engine for Vynora Pulse.
Analyze this email for a student or professional whose profile is:
{user_profile or 'AIML, Full Stack, Software Engineering'}

INSTRUCTIONS:
1. Only alert high-value career or educational opportunities that align strictly with the user's specific goals, interests, target keywords, or career category.
2. Completely ignore distractions: Instagram, Snapchat, shopping promotions, newsletters, spam.
3. If the email is NOT relevant to the user's career profile, goals, interests, or target keywords, classify it as NOT important (important: false).

Return strict JSON with exactly these keys:
- important: boolean
- category: string (Internship, Interview, Result, Scholarship, Offer Letter, Deadline, Placement, Research, OA Link, Career Opportunity)
- priority: string (Critical, High, Medium, Low)
- summary: string (1-2 sentence executive summary)
- reason: string (brief explanation)
- relevance_score: integer (0 to 100)
- urgency: string (Critical, High, Medium, Low)
- suggested_action: string (e.g., "Apply within 24 hours")
- opportunity_value: string (e.g., "High Career Impact")
- company: string (extracted company name)

Sender: {sender}
Subject: {subject}
Body: {body[:4000]}
"""
        response = self.client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are Vynora Pulse Future Impact AI. Always respond with valid JSON only."},
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.1,
            max_tokens=512,
        )
        raw = response.choices[0].message.content or "{}"
        data = json.loads(raw)
        return ClassificationResult(
            important=bool(data.get("important", False)),
            category=str(data.get("category", "Career Opportunity")),
            priority=str(data.get("priority", "Medium")),
            summary=str(data.get("summary", "Important opportunity detected.")),
            reason=str(data.get("reason", "")),
            relevance_score=int(data.get("relevance_score", 85)),
            urgency=str(data.get("urgency", "High")),
            suggested_action=str(data.get("suggested_action", "Review and apply soon.")),
            opportunity_value=str(data.get("opportunity_value", "High Career Impact")),
            company=str(data.get("company", self._extract_company(sender, subject))),
        )

    def _extract_company(self, sender: str, subject: str) -> str:
        for org in ["Google", "Microsoft", "Amazon", "Apple", "Meta", "JP Morgan", "Goldman Sachs",
                    "Morgan Stanley", "TCS", "Infosys", "Wipro", "Accenture", "Cognizant", "IBM",
                    "Intel", "Cisco", "NVIDIA", "Uber", "Atlassian"]:
            if org.lower() in sender.lower() or org.lower() in subject.lower():
                return org
        if "@" in sender:
            domain = sender.split("@")[-1].split(".")[0]
            if domain not in ["gmail", "yahoo", "outlook", "hotmail"]:
                return domain.capitalize()
        return "Top Tech Partner"

    def _classify_with_keywords(self, text: str, subject: str, sender: str, user_profile: str) -> ClassificationResult:
        lowered = text.lower()
        spam_hits = [word for word in SPAM_WORDS if word in lowered]

        # Parse user's custom keywords and goals
        custom_keywords = []
        custom_goals = []

        kw_match = re.search(r"Custom Target Keywords:\s*(.*)", user_profile)
        if kw_match:
            kws_str = kw_match.group(1).strip()
            if kws_str and kws_str != "Not configured":
                custom_keywords = [k.strip().lower() for k in kws_str.split(",") if k.strip()]

        goal_match = re.search(r"Custom Goals:\s*(.*)", user_profile)
        if goal_match:
            goals_str = goal_match.group(1).strip()
            if goals_str and goals_str != "Not configured":
                custom_goals = [g.strip().lower() for g in goals_str.split(",") if g.strip()]

        custom_keyword_matched = False
        matched_term = ""

        for kw in custom_keywords:
            if kw and kw in lowered:
                custom_keyword_matched = True
                matched_term = kw
                break

        if not custom_keyword_matched:
            for goal in custom_goals:
                if goal and goal in lowered:
                    custom_keyword_matched = True
                    matched_term = goal
                    break

        matched = [(word, category) for word, category in IMPORTANT_KEYWORDS.items() if word in lowered]
        company = self._extract_company(sender, subject)

        if spam_hits and not custom_keyword_matched:
            return ClassificationResult(
                important=False, category="Spam/Promotion", priority="Low",
                summary="Distraction or promotional email filtered.", reason="Spam keyword match",
                relevance_score=10, urgency="Low", suggested_action="None required",
                opportunity_value="Low Priority Distraction", company=company
            )

        if not custom_keyword_matched and not matched:
            return ClassificationResult(
                important=False, category="Other", priority="Low",
                summary="Standard email message.", reason="No relevant career opportunities found.",
                relevance_score=30, urgency="Low", suggested_action="None required",
                opportunity_value="General Correspondence", company=company
            )

        if custom_keyword_matched:
            category = "Career Opportunity"
            for word, cat in IMPORTANT_KEYWORDS.items():
                if word in lowered:
                    category = cat
                    break
            priority = "High"
            urgency = "High"
            score = 95
            suggested_action = f"Review email — matches your target interest: '{matched_term}'."
            opp_val = "Highly Relevant Opportunity"
        else:
            category = matched[0][1]
            critical_words = ["offer letter", "selected", "congratulations", "urgent deadline", "tomorrow", "final round"]
            high_words = ["shortlisted", "interview", "online assessment", "hackerrank", "assessment", "internship"]

            if any(word in lowered for word in critical_words):
                priority = "Critical"; urgency = "Critical"; score = 98
                suggested_action = "Accept offer or take immediate action within 12 hours."
                opp_val = "Life Changing Career Milestone"
            elif any(word in lowered for word in high_words):
                priority = "High"; urgency = "High"; score = 92
                suggested_action = "Complete assessment or prepare for interview within 24 hours."
                opp_val = "Crucial Selection Step"
            else:
                priority = "Medium"; urgency = "Medium"; score = 85
                suggested_action = "Review opportunity details and submit application."
                opp_val = "High Potential Opportunity"

        summary = f"Future Impact AI detected {category} from {company}: {subject[:100]}"
        return ClassificationResult(
            important=True, category=category, priority=priority, summary=summary,
            reason="Opportunity preference match", relevance_score=score, urgency=urgency,
            suggested_action=suggested_action, opportunity_value=opp_val, company=company
        )
