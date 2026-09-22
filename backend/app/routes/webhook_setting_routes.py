# from fastapi import APIRouter, Depends, HTTPException
# from sqlalchemy.orm import Session
# from typing import List

# from app.db.database import get_db
# from app.core.deps import get_current_user
# from app.core.permissions import require_super_admin
# from app.models.user import User
# from app.models.tenant import Tenant
# from app.models.webhook_retry_settings import WebhookRetrySettings
# from app.schemas.webhook_setting import (
#     RetrySettingsUpdate,
#     RetrySettingsResponse,
# )

# router = APIRouter(prefix="/webhook-settings", tags=["Webhook Settings"])

# SUPER_ADMIN_ROLE = "super_admin"


# def _ensure_settings(db: Session, tenant_id: int) -> WebhookRetrySettings:
#     """Get or create retry settings for a tenant."""
#     settings = (
#         db.query(WebhookRetrySettings)
#         .filter(WebhookRetrySettings.tenant_id == tenant_id)
#         .first()
#     )
#     if not settings:
#         settings = WebhookRetrySettings(
#             tenant_id=tenant_id,
#             max_attempts=5,
#             base_delay_minutes=1,
#             backoff_factor=3,
#             enabled=True,
#         )
#         db.add(settings)
#         db.commit()
#         db.refresh(settings)
#     return settings


# @router.get("/retry", response_model=List[RetrySettingsResponse])
# def list_all_retry_settings(
#     user: User = Depends(require_super_admin),
#     db: Session = Depends(get_db),
# ):
#     """List retry settings for all tenants (SuperAdmin)."""
#     tenants = db.query(Tenant).order_by(Tenant.name).all()

#     result = []
#     for tenant in tenants:
#         settings = _ensure_settings(db, tenant.id)
#         result.append(
#             RetrySettingsResponse(
#                 id=settings.id,
#                 tenant_id=settings.tenant_id,
#                 tenant_name=tenant.name,
#                 tenant_subdomain=tenant.subdomain,
#                 max_attempts=settings.max_attempts,
#                 base_delay_minutes=settings.base_delay_minutes,
#                 backoff_factor=settings.backoff_factor,
#                 enabled=settings.enabled,
#                 created_at=settings.created_at,
#                 updated_at=settings.updated_at,
#             )
#         )
#     return result


# @router.get("/retry/{tenant_id}", response_model=RetrySettingsResponse)
# def get_retry_settings(
#     tenant_id: int,
#     user: User = Depends(get_current_user),
#     db: Session = Depends(get_db),
# ):
#     """Get retry settings for a specific tenant."""
#     if user.role != SUPER_ADMIN_ROLE and user.tenant_id != tenant_id:
#         raise HTTPException(403, "Access denied")

#     tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
#     if not tenant:
#         raise HTTPException(404, "Tenant not found")

#     settings = _ensure_settings(db, tenant_id)

#     return RetrySettingsResponse(
#         id=settings.id,
#         tenant_id=settings.tenant_id,
#         tenant_name=tenant.name,
#         tenant_subdomain=tenant.subdomain,
#         max_attempts=settings.max_attempts,
#         base_delay_minutes=settings.base_delay_minutes,
#         backoff_factor=settings.backoff_factor,
#         enabled=settings.enabled,
#         created_at=settings.created_at,
#         updated_at=settings.updated_at,
#     )


# @router.put("/retry/{tenant_id}", response_model=RetrySettingsResponse)
# def update_retry_settings(
#     tenant_id: int,
#     payload: RetrySettingsUpdate,
#     user: User = Depends(get_current_user),
#     db: Session = Depends(get_db),
# ):
#     """Update retry settings for a tenant."""
#     if user.role != SUPER_ADMIN_ROLE and user.tenant_id != tenant_id:
#         raise HTTPException(403, "Access denied")

#     tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
#     if not tenant:
#         raise HTTPException(404, "Tenant not found")

#     settings = _ensure_settings(db, tenant_id)

#     update_data = payload.model_dump(exclude_unset=True)
#     for key, value in update_data.items():
#         setattr(settings, key, value)

#     db.commit()
#     db.refresh(settings)

#     return RetrySettingsResponse(
#         id=settings.id,
#         tenant_id=settings.tenant_id,
#         tenant_name=tenant.name,
#         tenant_subdomain=tenant.subdomain,
#         max_attempts=settings.max_attempts,
#         base_delay_minutes=settings.base_delay_minutes,
#         backoff_factor=settings.backoff_factor,
#         enabled=settings.enabled,
#         created_at=settings.created_at,
#         updated_at=settings.updated_at,
#     )





from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.permissions import require_super_admin
from app.models.user import User
from app.models.tenant import Tenant
from app.models.webhook_retry_settings import WebhookRetrySettings
from app.schemas.webhook_setting import (
    RetrySettingsUpdate,
    RetrySettingsResponse,
)

router = APIRouter(prefix="/webhook-settings", tags=["Webhook Settings"])

SUPER_ADMIN_ROLE = "super_admin"


def _get_settings(db: Session, tenant_id: int) -> WebhookRetrySettings:
    """
    Fetch retry settings for a tenant.

    Raises 404 if settings do not exist. Settings are created
    automatically during tenant signup.
    """
    settings = (
        db.query(WebhookRetrySettings)
        .filter(WebhookRetrySettings.tenant_id == tenant_id)
        .first()
    )
    if not settings:
        raise HTTPException(
            status_code=404,
            detail=f"Retry settings not found for tenant {tenant_id}",
        )
    return settings


@router.get("/retry", response_model=List[RetrySettingsResponse])
def list_all_retry_settings(
    user: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """List retry settings for all tenants (SuperAdmin)."""
    tenants = db.query(Tenant).order_by(Tenant.name).all()

    result = []
    for tenant in tenants:
        settings = (
            db.query(WebhookRetrySettings)
            .filter(WebhookRetrySettings.tenant_id == tenant.id)
            .first()
        )
        if not settings:
            continue   # Skip tenants without settings

        result.append(
            RetrySettingsResponse(
                id=settings.id,
                tenant_id=settings.tenant_id,
                tenant_name=tenant.name,
                tenant_subdomain=tenant.subdomain,
                max_attempts=settings.max_attempts,
                base_delay_minutes=settings.base_delay_minutes,
                backoff_factor=settings.backoff_factor,
                enabled=settings.enabled,
                created_at=settings.created_at,
                updated_at=settings.updated_at,
            )
        )
    return result


@router.get("/retry/{tenant_id}", response_model=RetrySettingsResponse)
def get_retry_settings(
    tenant_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get retry settings for a specific tenant."""
    if user.role != SUPER_ADMIN_ROLE and user.tenant_id != tenant_id:
        raise HTTPException(403, "Access denied")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    settings = _get_settings(db, tenant_id)   # ← Ab auto-create nahi

    return RetrySettingsResponse(
        id=settings.id,
        tenant_id=settings.tenant_id,
        tenant_name=tenant.name,
        tenant_subdomain=tenant.subdomain,
        max_attempts=settings.max_attempts,
        base_delay_minutes=settings.base_delay_minutes,
        backoff_factor=settings.backoff_factor,
        enabled=settings.enabled,
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )


@router.put("/retry/{tenant_id}", response_model=RetrySettingsResponse)
def update_retry_settings(
    tenant_id: int,
    payload: RetrySettingsUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update retry settings for a tenant."""
    if user.role != SUPER_ADMIN_ROLE and user.tenant_id != tenant_id:
        raise HTTPException(403, "Access denied")

    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    settings = _get_settings(db, tenant_id)   # ← Ab auto-create nahi

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(settings, key, value)

    db.commit()
    db.refresh(settings)

    return RetrySettingsResponse(
        id=settings.id,
        tenant_id=settings.tenant_id,
        tenant_name=tenant.name,
        tenant_subdomain=tenant.subdomain,
        max_attempts=settings.max_attempts,
        base_delay_minutes=settings.base_delay_minutes,
        backoff_factor=settings.backoff_factor,
        enabled=settings.enabled,
        created_at=settings.created_at,
        updated_at=settings.updated_at,
    )