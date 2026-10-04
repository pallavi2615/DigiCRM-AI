"""
Proposal Template Seeding Service.

Two tiers:
    Tier A — Top 3 industries get 3 specialized templates each
    Tier B — All other industries get 2 generic templates each
"""

import logging
from typing import List
from sqlalchemy.orm import Session

from app.models.proposal_template import ProposalTemplate

logger = logging.getLogger(__name__)


# ============================================================
# INDUSTRY DISPLAY NAMES (for template text)
# ============================================================

INDUSTRY_NAMES = {
    "fintech": "Fintech",
    "lending_nbfc": "Lending & NBFC",
    "banking": "Banking",
    "insurance": "Insurance",
    "wealth_investment": "Wealth & Investment",
    "broking": "Broking",
    "payments": "Payments",
    "real_estate": "Real Estate",
    "construction": "Construction",
    "property_management": "Property Management",
    "retail": "Retail",
    "ecommerce": "E-commerce",
    "consumer_goods": "Consumer Goods",
    "distribution": "Distribution",
    "logistics": "Logistics",
    "transportation": "Transportation",
    "automotive": "Automotive",
    "travel_hospitality": "Travel & Hospitality",
    "hospitals": "Hospitals",
    "clinics": "Clinics",
    "diagnostics": "Diagnostics",
    "healthtech": "HealthTech",
    "higher_education": "Higher Education",
    "edtech": "EdTech",
    "coaching": "Coaching",
    "career_training": "Career & Training",
    "manufacturing": "Manufacturing",
    "energy": "Energy",
    "engineering": "Engineering",
    "b2b_services": "B2B Services",
    "consulting": "Consulting",
    "agencies": "Agencies",
    "legal": "Legal",
    "it_company": "IT Services",
    "staffing": "Staffing",
    "creator_brand_deals": "Creator Brand Deals",
    "influencer_agencies": "Influencer Agencies",
    "fmcg_distribution_os": "FMCG Distribution",
    "pharma_distribution_os": "Pharma Distribution",
    "building_materials_os": "Building Materials",
}


# ============================================================
# TIER A — SPECIALIZED TEMPLATES (Top 3 industries)
# ============================================================

SPECIALIZED_TEMPLATES = {

    # ── IT SERVICES ──
    "it_company": [
        {
            "title": "Web Development Proposal",
            "description": "Custom web application development with modern stack.",
            "amount": 500000,
            "terms": "50% advance. 50% on delivery. 30 days support included.",
            "content": {"sections": [
                {"title": "Project Overview", "body": "Custom web application tailored to your business."},
                {"title": "Scope of Work", "body": "Requirements, UI/UX, backend, frontend, testing, deployment."},
                {"title": "Tech Stack", "body": "React, Node.js, PostgreSQL, AWS"},
                {"title": "Timeline", "body": "12 weeks from kickoff"},
                {"title": "Commercial Terms", "body": "₹5,00,000. 50% advance, 50% on delivery."},
            ]},
        },
        {
            "title": "Mobile App Development Proposal",
            "description": "iOS + Android app built with React Native.",
            "amount": 800000,
            "terms": "40% advance. 30% alpha. 30% final. 60 days support.",
            "content": {"sections": [
                {"title": "Overview", "body": "Cross-platform mobile app for iOS & Android."},
                {"title": "Scope", "body": "UI/UX, React Native, APIs, push, app stores."},
                {"title": "Timeline", "body": "16 weeks total"},
                {"title": "Commercial Terms", "body": "₹8,00,000 in 3 milestones."},
            ]},
        },
        {
            "title": "Annual Support & Maintenance Contract",
            "description": "12-month AMC with SLA-based support.",
            "amount": 200000,
            "terms": "Annual upfront. SLA: 4/8/24/72 hours.",
            "content": {"sections": [
                {"title": "Service Overview", "body": "Support & maintenance for existing applications."},
                {"title": "Coverage", "body": "Bug fixes, minor enhancements, monitoring, backups."},
                {"title": "SLA", "body": "Critical 4hr / High 8hr / Medium 24hr / Low 72hr."},
                {"title": "Commercial Terms", "body": "₹2,00,000 annual, upfront."},
            ]},
        },
    ],

    # ── REAL ESTATE ──
    "real_estate": [
        {
            "title": "Property Sale Agreement",
            "description": "Standard sale agreement for residential/commercial property.",
            "amount": 0,
            "terms": "10% token advance. Balance on registration.",
            "content": {"sections": [
                {"title": "Parties", "body": "Seller: [Name] | Buyer: [Name]"},
                {"title": "Property Details", "body": "Area, Type, Floor, Parking, Furnishing"},
                {"title": "Sale Consideration", "body": "Total, Token, Balance"},
                {"title": "Payment Schedule", "body": "Token → 40% → Balance on registration"},
                {"title": "Timeline", "body": "Registration within 90 days"},
            ]},
        },
        {
            "title": "Rental Agreement",
            "description": "Standard 11-month residential rental agreement.",
            "amount": 0,
            "terms": "3 months deposit. Rent by 5th of month.",
            "content": {"sections": [
                {"title": "Parties", "body": "Landlord | Tenant"},
                {"title": "Term", "body": "11 months, renewable"},
                {"title": "Rent & Deposit", "body": "Monthly rent + 3x deposit"},
                {"title": "Terms", "body": "Rent due 5th, no structural changes, 1-month notice"},
            ]},
        },
        {
            "title": "Property Management Contract",
            "description": "Annual property management services.",
            "amount": 120000,
            "terms": "8% of monthly rent. 12-month minimum.",
            "content": {"sections": [
                {"title": "Service Scope", "body": "Complete property management."},
                {"title": "Services", "body": "Tenant sourcing, rent collection, maintenance, inspections."},
                {"title": "Fee Structure", "body": "8% management fee + 1-month onboarding."},
            ]},
        },
    ],

    # ── COACHING ──
    "coaching": [
        {
            "title": "6-Month Course Package",
            "description": "Comprehensive 6-month coaching program.",
            "amount": 60000,
            "terms": "Full payment or 3 installments. Non-refundable after week 2.",
            "content": {"sections": [
                {"title": "Program Overview", "body": "6-month structured coaching program."},
                {"title": "Inclusions", "body": "48 live sessions, mentorship, materials, certificate."},
                {"title": "Schedule", "body": "2 hr × 2 days/week. Bi-weekly mentorship."},
                {"title": "Fee", "body": "₹60,000 full or ₹20,000 × 3"},
            ]},
        },
        {
            "title": "1-on-1 Coaching Package",
            "description": "Personalized 1-on-1 coaching with dedicated mentor.",
            "amount": 45000,
            "terms": "Full payment upfront. Valid 4 months.",
            "content": {"sections": [
                {"title": "Overview", "body": "Personalized coaching for specific goals."},
                {"title": "Inclusions", "body": "12 sessions, custom path, WhatsApp support."},
                {"title": "Schedule", "body": "12 sessions over 4 months."},
                {"title": "Fee", "body": "₹45,000 for full package."},
            ]},
        },
        {
            "title": "Corporate Training Proposal",
            "description": "Team training for corporate clients.",
            "amount": 200000,
            "terms": "50% advance. 50% on completion. Travel extra.",
            "content": {"sections": [
                {"title": "Overview", "body": "Customized corporate training program."},
                {"title": "Design", "body": "Assessment, curriculum, 40 hours, evaluation, 60-day support."},
                {"title": "Team Size", "body": "Up to 25. Additional: ₹5,000 each."},
                {"title": "Commercial", "body": "₹2,00,000 + travel at actuals."},
            ]},
        },
    ],
}


# ============================================================
# TIER B — GENERIC TEMPLATES (all other industries)
# ============================================================

def _generate_generic_templates(industry_key: str) -> List[dict]:
    """
    Generate 2 generic templates for any industry.
    Uses the industry's display name in titles and content.
    """
    industry_name = INDUSTRY_NAMES.get(industry_key, industry_key.replace("_", " ").title())

    return [
        {
            "title": f"{industry_name} Solution Proposal",
            "description": f"Proposal for {industry_name.lower()} services tailored to client needs.",
            "amount": 0,
            "terms": "50% advance. 50% on completion. 30 days support.",
            "content": {"sections": [
                {"title": "Executive Summary", "body": f"We propose to deliver a comprehensive {industry_name.lower()} solution tailored to your business requirements."},
                {"title": "Scope of Work", "body": f"1. Discovery & requirements\n2. Solution design\n3. Implementation\n4. Testing & QA\n5. Delivery & handover"},
                {"title": "Timeline", "body": "Estimated duration will be confirmed after detailed requirements gathering."},
                {"title": "Deliverables", "body": f"All deliverables related to {industry_name.lower()} solution, with documentation and handover."},
                {"title": "Commercial Terms", "body": "Total cost to be finalized based on scope. 50% advance, 50% on completion."},
                {"title": "Support", "body": "30 days post-delivery support included."},
            ]},
        },
        {
            "title": f"{industry_name} Annual Contract",
            "description": f"Annual engagement contract for ongoing {industry_name.lower()} services.",
            "amount": 0,
            "terms": "Annual upfront. Renewal discount: 10%. SLA per service tier.",
            "content": {"sections": [
                {"title": "Service Overview", "body": f"Ongoing {industry_name.lower()} services under a 12-month annual contract."},
                {"title": "Scope", "body": "• Regular service delivery\n• Priority support\n• Quarterly reviews\n• Annual planning session"},
                {"title": "SLA", "body": "Critical: 4 hours | High: 8 hours | Medium: 24 hours | Low: 72 hours"},
                {"title": "Commercial Terms", "body": "Annual contract value to be finalized. Payable upfront. 10% renewal discount."},
                {"title": "Reporting", "body": "Monthly status reports. Quarterly business reviews. Annual summary."},
            ]},
        },
    ]


def _get_templates_for_industry(industry_key: str) -> List[dict]:
    """Return specialized templates if available, else generic."""
    if industry_key in SPECIALIZED_TEMPLATES:
        templates = SPECIALIZED_TEMPLATES[industry_key]
        # Tag each with category
        for t in templates:
            t["category"] = industry_key
        return templates

    templates = _generate_generic_templates(industry_key)
    for t in templates:
        t["category"] = industry_key
    return templates


# ============================================================
# SEED FUNCTION
# ============================================================

def create_default_templates_for_industry(
    db: Session,
    tenant_id: int,
    industry_key: str,
    created_by: int = None,
) -> int:
    """
    Seed proposal templates for a tenant based on industry.
    Idempotent — skips existing ones by (tenant_id, title, category).
    """
    templates = _get_templates_for_industry(industry_key)
    if not templates:
        logger.info("No templates for industry '%s'", industry_key)
        return 0

    created = 0
    for tpl in templates:
        existing = (
            db.query(ProposalTemplate)
            .filter(
                ProposalTemplate.tenant_id == tenant_id,
                ProposalTemplate.title == tpl["title"],
                ProposalTemplate.category == tpl["category"],
            )
            .first()
        )
        if existing:
            continue

        template = ProposalTemplate(
            tenant_id=tenant_id,
            title=tpl["title"],
            description=tpl.get("description"),
            category=tpl["category"],
            owner_label=tpl.get("owner_label", "Sales Team"),
            amount=tpl.get("amount", 0),
            currency=tpl.get("currency", "INR"),
            terms=tpl.get("terms"),
            content=tpl.get("content", {}),
            shared_with_team=True,
            created_by=created_by,
        )
        db.add(template)
        created += 1

    db.flush()
    logger.info(
        "✅ Created %d templates for tenant %d (industry=%s)",
        created, tenant_id, industry_key,
    )
    return created

# ============================================================
# TEMPLATE RENDERING — convert content JSON to full document
# ============================================================

def render_template_content(template, client_name: str = None) -> str:
    """
    Convert a ProposalTemplate into a full proposal document (markdown).

    Uses template.content.sections to build a formatted document.
    """
    from datetime import datetime

    lines = []

    # ── Title ──
    lines.append(f"# {template.title}")
    lines.append("")

    # ── Meta ──
    if client_name:
        lines.append(f"**Prepared for:** {client_name}")
    lines.append(f"**Date:** {datetime.now().strftime('%d %b %Y')}")

    if template.amount and float(template.amount) > 0:
        amount_str = f"₹{float(template.amount):,.2f}"
        lines.append(f"**Amount:** {amount_str} {template.currency or 'INR'}")

    lines.append("")
    lines.append("---")
    lines.append("")

    # ── Sections from content JSON ──
    content = template.content or {}
    sections = content.get("sections", [])

    if sections:
        for idx, section in enumerate(sections, start=1):
            title = section.get("title", f"Section {idx}")
            body = section.get("body", "")

            lines.append(f"## {idx}. {title}")
            lines.append("")
            if body:
                lines.append(body)
                lines.append("")

    # ── Terms ──
    if template.terms:
        lines.append("## Commercial Terms")
        lines.append("")
        lines.append(template.terms)
        lines.append("")

    # ── Footer ──
    lines.append("---")
    lines.append("")
    lines.append("*Thank you for your consideration.*")

    return "\n".join(lines)