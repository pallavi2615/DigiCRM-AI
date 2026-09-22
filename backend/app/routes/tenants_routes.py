from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.config import settings
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.tenant import (
    AutoFollowupSettingsUpdate,
    AutoFollowupSettingsResponse,
)

router = APIRouter(prefix="/tenant", tags=["Tenant"])


# ============================================================
# TENANT INFO
# ============================================================

@router.get("/me")
def get_my_tenant(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve current user's tenant information."""
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    webhook_url = None
    if tenant.webhook_id:
        webhook_url = f"{settings.WEBHOOK_BASE_URL}/{tenant.webhook_id}"

    return {
        "id": tenant.id,
        "name": tenant.name,
        "subdomain": tenant.subdomain,
        "webhook_id": tenant.webhook_id,
        "webhook_url": webhook_url,
        "api_key": tenant.api_key,
        "status": tenant.status,
        "settings": tenant.settings,
    }


# ============================================================
# REGENERATE WEBHOOK
# ============================================================

@router.post("/regenerate-webhook")
def regenerate_webhook(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Generate a new webhook_id for the tenant."""
    import secrets

    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    tenant.webhook_id = f"wh_{secrets.token_urlsafe(16)}"
    db.commit()
    db.refresh(tenant)

    return {
        "webhook_id": tenant.webhook_id,
        "webhook_url": f"{settings.WEBHOOK_BASE_URL}/{tenant.webhook_id}",
    }


# ============================================================
# ⭐ AUTO-FOLLOWUP SETTINGS
# ============================================================

@router.get(
    "/settings/auto-followup",
    response_model=AutoFollowupSettingsResponse,
)
def get_auto_followup_settings(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get auto-followup settings for current tenant."""
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    return AutoFollowupSettingsResponse(
        auto_followup_enabled=bool(getattr(tenant, "auto_followup_enabled", False)),
        default_followup_sequence_id=getattr(tenant, "default_followup_sequence_id", None),
        default_assignee_id=getattr(tenant, "default_assignee_id", None),
    )


@router.put(
    "/settings/auto-followup",
    response_model=AutoFollowupSettingsResponse,
)
def update_auto_followup_settings(
    payload: AutoFollowupSettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update auto-followup settings."""
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    if user.role not in ("admin", "super_admin"):
        raise HTTPException(403, "Admin access required")

    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

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
        auto_followup_enabled=bool(getattr(tenant, "auto_followup_enabled", False)),
        default_followup_sequence_id=getattr(tenant, "default_followup_sequence_id", None),
        default_assignee_id=getattr(tenant, "default_assignee_id", None),
    )