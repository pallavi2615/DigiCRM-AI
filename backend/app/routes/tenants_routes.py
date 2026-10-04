"""
Tenant settings & metadata.

Endpoints:
    GET    /tenant/me                        — read own tenant (any user)
    PUT    /tenant/me                        — update name/subdomain (Admin+)
    PUT    /tenant/branding                  — merge branding JSON (Admin+)
    PUT    /tenant/settings                  — merge settings JSON (Admin+)
    POST   /tenant/regenerate-webhook        — new webhook_id (Admin+)
    GET    /tenant/settings/auto-followup    — read auto-followup (Admin+)
    PUT    /tenant/settings/auto-followup    — update auto-followup (Admin+)
    GET    /tenant/all                       — list all tenants (SuperAdmin)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
import secrets

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.core.permissions import require_role
from app.core.constants import (
    SUPER_ADMIN_ROLE as SA_CONST,
    ADMIN_ROLE,
)
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.tenant import (
    AutoFollowupSettingsUpdate,
    AutoFollowupSettingsResponse,
    TenantResponse,
    TenantUpdate,
    TenantBrandingUpdate,
    TenantSettingsUpdate,
    TenantListItem,
)
from app.schemas.tenant import TenantCreateWithAdmin, TenantCreateResponse
from app.services.tenant_service import create_tenant_with_admin, TEMPLATE_TO_INDUSTRIES
from app.models.industry import Industry, TenantIndustry
from app.utils.password import generate_temp_password
from app.core.security import hash_password
from app.utils.email import send_tenant_welcome_with_credentials

router = APIRouter(prefix="/tenant", tags=["Tenant"])


# ============================================================
# HELPERS
# ============================================================

def _get_own_tenant(db: Session, user: User) -> Tenant:
    """Get the current user's tenant. 404 if none."""
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")
    return tenant


# ============================================================
# GET MY TENANT
# ============================================================

# 

@router.get("/me", response_model=TenantResponse)
def get_my_tenant(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve current user's tenant information.
    
    - SuperAdmin and Admin: see webhook_id, webhook_url, api_key
    - Manager and Executive: webhook fields are hidden (null)
    """
    # SuperAdmin has no tenant
    if not user.tenant_id:
        return TenantResponse(
            id=0,
            name="Platform Admin",
            subdomain=None,
            webhook_id=None,
            webhook_url=None,
            api_key=None,
            branding={},
            settings={},
            status="superadmin",
        )

    tenant = _get_own_tenant(db, user)

    # ⭐ Only SuperAdmin and Admin can see webhook credentials
    can_see_secret = user.role in ("super_admin", "admin")

    webhook_url = None
    if tenant.webhook_id and can_see_secret:
        webhook_url = f"{settings.WEBHOOK_BASE_URL}/{tenant.webhook_id}"

    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        subdomain=tenant.subdomain,
        webhook_id=tenant.webhook_id if can_see_secret else None,
        webhook_url=webhook_url,
        api_key=tenant.api_key if can_see_secret else None,
        branding=tenant.branding or {},
        settings=tenant.settings or {},
        status=tenant.status,
        created_at=tenant.created_at,
    )

# ============================================================
# UPDATE MY TENANT (name, subdomain)
# ============================================================

@router.put("/me", response_model=TenantResponse)
def update_my_tenant(
    payload: TenantUpdate,
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    """Update tenant name or subdomain. Admin+ only."""
    tenant = _get_own_tenant(db, user)

    update_data = payload.model_dump(exclude_unset=True)

    # Check subdomain uniqueness if changing
    if "subdomain" in update_data and update_data["subdomain"]:
        existing = (
            db.query(Tenant)
            .filter(
                Tenant.subdomain == update_data["subdomain"],
                Tenant.id != tenant.id,
            )
            .first()
        )
        if existing:
            raise HTTPException(400, "Subdomain already taken")

    for key, value in update_data.items():
        setattr(tenant, key, value)

    db.commit()
    db.refresh(tenant)

    webhook_url = None
    if tenant.webhook_id:
        webhook_url = f"{settings.WEBHOOK_BASE_URL}/{tenant.webhook_id}"

    return TenantResponse(
        id=tenant.id,
        name=tenant.name,
        subdomain=tenant.subdomain,
        webhook_id=tenant.webhook_id,
        webhook_url=webhook_url,
        api_key=tenant.api_key,
        branding=tenant.branding or {},
        settings=tenant.settings or {},
        status=tenant.status,
        created_at=tenant.created_at,
    )


# ============================================================
# UPDATE BRANDING (merge JSON)
# ============================================================

@router.put("/branding")
def update_tenant_branding(
    payload: TenantBrandingUpdate,
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    """Merge branding keys into tenant.branding. Admin+ only."""
    tenant = _get_own_tenant(db, user)

    current = dict(tenant.branding or {})
    updates = payload.model_dump(exclude_unset=True)
    current.update(updates)
    tenant.branding = current

    db.commit()
    db.refresh(tenant)

    return {"success": True, "branding": tenant.branding}


# ============================================================
# UPDATE SETTINGS (merge JSON)
# ============================================================

@router.put("/settings")
def update_tenant_settings(
    payload: TenantSettingsUpdate,
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    """Merge settings keys into tenant.settings. Admin+ only."""
    tenant = _get_own_tenant(db, user)

    current = dict(tenant.settings or {})
    updates = payload.model_dump(exclude_unset=True)
    current.update(updates)
    tenant.settings = current

    db.commit()
    db.refresh(tenant)

    return {"success": True, "settings": tenant.settings}


# ============================================================
# REGENERATE WEBHOOK
# ============================================================

@router.post("/regenerate-webhook")
def regenerate_webhook(
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    """Generate a new webhook_id for the tenant. Admin+ only."""
    tenant = _get_own_tenant(db, user)

    tenant.webhook_id = f"wh_{secrets.token_urlsafe(16)}"
    db.commit()
    db.refresh(tenant)

    return {
        "webhook_id": tenant.webhook_id,
        "webhook_url": f"{settings.WEBHOOK_BASE_URL}/{tenant.webhook_id}",
    }


# ============================================================
# AUTO-FOLLOWUP SETTINGS
# ============================================================

@router.get(
    "/settings/auto-followup",
    response_model=AutoFollowupSettingsResponse,
)
def get_auto_followup_settings(
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    """Get auto-followup settings for current tenant."""
    tenant = _get_own_tenant(db, user)

    return AutoFollowupSettingsResponse(
        auto_followup_enabled=bool(tenant.auto_followup_enabled),
        default_followup_sequence_id=tenant.default_followup_sequence_id,
        default_assignee_id=tenant.default_assignee_id,
    )


@router.put(
    "/settings/auto-followup",
    response_model=AutoFollowupSettingsResponse,
)
def update_auto_followup_settings(
    payload: AutoFollowupSettingsUpdate,
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    """Update auto-followup settings."""
    tenant = _get_own_tenant(db, user)

    update_data = payload.model_dump(exclude_unset=True)

    if "auto_followup_enabled" in update_data:
        tenant.auto_followup_enabled = bool(update_data["auto_followup_enabled"])
    if "default_followup_sequence_id" in update_data:
        tenant.default_followup_sequence_id = update_data["default_followup_sequence_id"]
    if "default_assignee_id" in update_data:
        tenant.default_assignee_id = update_data["default_assignee_id"]

    db.commit()
    db.refresh(tenant)

    return AutoFollowupSettingsResponse(
        auto_followup_enabled=bool(tenant.auto_followup_enabled),
        default_followup_sequence_id=tenant.default_followup_sequence_id,
        default_assignee_id=tenant.default_assignee_id,
    )


# ============================================================
# LIST ALL TENANTS (SuperAdmin only)
# ============================================================

@router.get("/all", response_model=List[TenantListItem])
def list_all_tenants(
    search: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(require_role(SA_CONST)),
    db: Session = Depends(get_db),
):
    """List all tenants on the platform. SuperAdmin only."""
    query = db.query(Tenant)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (Tenant.name.ilike(pattern)) |
            (Tenant.subdomain.ilike(pattern))
        )
    if status:
        query = query.filter(Tenant.status == status)

    tenants = (
        query
        .order_by(desc(Tenant.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )

    return [TenantListItem.model_validate(t) for t in tenants]

# ============================================================
# CREATE TENANT WITH ADMIN (SuperAdmin)
# ============================================================

@router.post("/with-admin", response_model=TenantCreateResponse, status_code=201)
def create_tenant_with_admin_user(
    payload: TenantCreateWithAdmin,
    admin: User = Depends(require_role(SA_CONST)),
    db: Session = Depends(get_db),
):
    """
    SuperAdmin creates tenant + admin user + auto-assigns industries + sends welcome email.
    """
    # Slug uniqueness
    if db.query(Tenant).filter(Tenant.subdomain == payload.slug).first():
        raise HTTPException(400, f"Slug '{payload.slug}' already taken")

    # Email uniqueness
    if db.query(User).filter(User.email == payload.admin_email).first():
        raise HTTPException(400, f"Email '{payload.admin_email}' already registered")

    # Custom domain uniqueness
    if payload.custom_domain:
        if db.query(Tenant).filter(Tenant.custom_domain == payload.custom_domain).first():
            raise HTTPException(400, f"Custom domain '{payload.custom_domain}' already taken")

    try:
        (tenant, admin_user, temp_password,
         industry_keys, email_sent, email_error) = create_tenant_with_admin(
            db,
            name=payload.name,
            slug=payload.slug,
            admin_email=payload.admin_email,
            admin_full_name=payload.admin_full_name,
            plan=payload.plan,
            industry_template=payload.industry_template,
            tagline=payload.tagline,
            primary_color=payload.primary_color,
            accent_color=payload.accent_color,
            logo_url=payload.logo_url,
            custom_domain=payload.custom_domain,
            created_by=admin,
        )
        db.commit()
        db.refresh(tenant)
        db.refresh(admin_user)
    except Exception as e:
        db.rollback()
        raise HTTPException(500, f"Failed to create tenant: {str(e)}")

    return TenantCreateResponse(
        tenant_id=tenant.id,
        tenant_name=tenant.name,
        tenant_slug=tenant.subdomain,
        admin_user_id=admin_user.id,
        admin_email=admin_user.email,
        admin_full_name=admin_user.full_name,
        temp_password=temp_password,
        email_sent=email_sent,
        email_error=email_error,
        industries_assigned=industry_keys,
    )


# ============================================================
# RESEND WELCOME EMAIL (SuperAdmin)
# ============================================================

@router.post("/{tenant_id}/resend-welcome")
def resend_welcome_email(
    tenant_id: int,
    admin: User = Depends(require_role(SA_CONST)),
    db: Session = Depends(get_db),
):
    """Regenerate temp password + resend welcome email."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    admin_user = (
        db.query(User)
        .filter(User.tenant_id == tenant_id, User.role.in_(["admin", "super_admin"]))
        .order_by(User.id)
        .first()
    )
    if not admin_user:
        raise HTTPException(404, "No admin user found for this tenant")

    temp_password = generate_temp_password(12)
    admin_user.password_hash = hash_password(temp_password)
    admin_user.must_change_password = True
    db.commit()

    email_sent = False
    email_error = None
    try:
        email_sent = send_tenant_welcome_with_credentials(
            to_email=admin_user.email,
            admin_name=admin_user.full_name,
            tenant_name=tenant.name,
            temp_password=temp_password,
        )
    except Exception as e:
        email_error = str(e)

    return {
        "success": True,
        "email_sent": email_sent,
        "email_error": email_error,
        "temp_password": temp_password,
        "admin_email": admin_user.email,
    }


# ============================================================
# TEMPLATE → INDUSTRY MAPPING (SuperAdmin, for frontend dropdown)
# ============================================================

@router.get("/templates")
def list_industry_templates(
    admin: User = Depends(require_role(SA_CONST)),
    db: Session = Depends(get_db),
):
    """
    Return all available industries for the New Tenant form.
    Dynamically reads from the `industries` table.
    """
    from app.models.industry import Industry

    industries = (
        db.query(Industry)
        .filter(Industry.is_active == True)
        .order_by(Industry.order_index, Industry.name)
        .all()
    )

    result = {}
    for ind in industries:
        result[ind.key] = {
            "label": ind.name,
            "industries": [ind.key],
        }

    return result