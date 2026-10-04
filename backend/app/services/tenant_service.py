"""
Tenant onboarding service.
"""

import logging
from typing import Optional, List, Tuple

from sqlalchemy.orm import Session

from app.models.tenant import Tenant
from app.models.user import User
from app.models.industry import Industry, TenantIndustry
from app.core.security import hash_password
from app.utils.password import generate_temp_password
from app.utils.email import send_tenant_welcome_with_credentials
from app.services.automation_service import create_default_automation_rules
from app.services.template_services import create_default_templates_for_industry   # ⭐ NEW

logger = logging.getLogger(__name__)


TEMPLATE_TO_INDUSTRIES = {
    "it_services":  ["it_company"],
    "real_estate":  ["real_estate"],
    "coaching":     ["coaching"],
}


def create_tenant_with_admin(
    db: Session,
    *,
    name: str,
    slug: str,
    admin_email: str,
    admin_full_name: str,
    admin_role: str = "admin",
    plan: Optional[str] = "lite",
    industry_template: Optional[str] = None,
    tagline: Optional[str] = None,
    primary_color: Optional[str] = "#4F46E5",
    accent_color: Optional[str] = "#a855f7",
    logo_url: Optional[str] = None,
    custom_domain: Optional[str] = None,
    created_by: Optional[User] = None,
) -> Tuple[Tenant, User, str, List[str], bool, Optional[str]]:
    """
    Returns:
        (tenant, admin_user, temp_password, assigned_industry_keys, email_sent, email_error)
    """

    # 1. Create Tenant
    tenant = Tenant(
        name=name,
        subdomain=slug,
        plan=plan or "lite",
        industry_template=industry_template,
        tagline=tagline,
        primary_color=primary_color or "#4F46E5",
        accent_color=accent_color or "#a855f7",
        logo_url=logo_url,
        custom_domain=custom_domain,
        status="active",
        settings={"webhook_enabled": True},
        branding={},
    )
    db.add(tenant)
    db.flush()

    # ⭐ 1b. Seed default automation rules (5 rules per tenant)
    create_default_automation_rules(db, tenant.id)

    # 2. Generate temp password
    temp_password = generate_temp_password(12)
    password_hash = hash_password(temp_password)

    # 3. Create admin user
    admin_user = User(
        full_name=admin_full_name,
        email=admin_email,
        password_hash=password_hash,
        role=admin_role,
        status="active",
        tenant_id=tenant.id,
        must_change_password=True,
        email_verified=False,
        invited_by=created_by.id if created_by else None,
    )
    db.add(admin_user)
    db.flush()

    # 4. Assign industries from template
    assigned_keys: List[str] = []
    if industry_template:
        keys_to_assign = TEMPLATE_TO_INDUSTRIES.get(industry_template, [])
        for key in keys_to_assign:
            industry = db.query(Industry).filter(Industry.key == key).first()
            if not industry:
                logger.warning("Industry '%s' not found — skipping", key)
                continue
            db.add(TenantIndustry(
                tenant_id=tenant.id,
                industry_id=industry.id,
                granted_by=created_by.id if created_by else None,
                status="active",
            ))
            assigned_keys.append(key)

    db.flush()

    # ⭐ 4b. Seed proposal templates for each subscribed industry
    for industry_key in assigned_keys:
        create_default_templates_for_industry(
            db,
            tenant_id=tenant.id,
            industry_key=industry_key,
            created_by=created_by.id if created_by else None,
        )

    # 5. Try to send welcome email (non-blocking)
    email_sent = False
    email_error: Optional[str] = None
    try:
        email_sent = send_tenant_welcome_with_credentials(
            to_email=admin_email,
            admin_name=admin_full_name,
            tenant_name=name,
            temp_password=temp_password,
        )
        if not email_sent:
            email_error = "SMTP send failed — check SMTP settings"
    except Exception as e:
        logger.exception("Welcome email failed: %s", e)
        email_error = str(e)

    return tenant, admin_user, temp_password, assigned_keys, email_sent, email_error