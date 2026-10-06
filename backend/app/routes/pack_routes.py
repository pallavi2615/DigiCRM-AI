"""Industry Pack configs API — replaces Supabase pack_configs."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from typing import List, Optional
from uuid import UUID

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.constants import SUPER_ADMIN_ROLE as SA_CONST
from app.models.user import User
from app.models.pack import PackConfig
from app.schemas.pack import PackConfigResponse

router = APIRouter(prefix="/packs", tags=["Industry Packs"])


# ═══════════════════════════════════════════════════════
# LIST all pack configs (visible to current user)
# ═══════════════════════════════════════════════════════

@router.get("/configs", response_model=List[PackConfigResponse])
def list_pack_configs(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return pack configs visible to the current user:
    - SuperAdmin: all rows
    - Others: global rows (tenant_id null) + own tenant rows
    """
    query = db.query(PackConfig)

    if user.role != SA_CONST:
        if user.tenant_id:
            query = query.filter(
                or_(
                    PackConfig.tenant_id.is_(None),
                    PackConfig.tenant_id == user.tenant_id,
                )
            )
        else:
            query = query.filter(PackConfig.tenant_id.is_(None))

    return query.order_by(desc(PackConfig.created_at)).all()


# ═══════════════════════════════════════════════════════
# GET one pack config (by group + slug)
# ═══════════════════════════════════════════════════════

@router.get("/configs/{group_slug}/{pack_slug}", response_model=List[PackConfigResponse])
def get_pack_config(
    group_slug: str,
    pack_slug: str,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Return all matching pack configs (global + tenant-specific).
    Frontend picks the tenant-specific one first.
    """
    query = db.query(PackConfig).filter(
        PackConfig.group_slug == group_slug,
        PackConfig.pack_slug == pack_slug,
    )

    if user.role != SA_CONST:
        if user.tenant_id:
            query = query.filter(
                or_(
                    PackConfig.tenant_id.is_(None),
                    PackConfig.tenant_id == user.tenant_id,
                )
            )
        else:
            query = query.filter(PackConfig.tenant_id.is_(None))

    return query.all()


# ═══════════════════════════════════════════════════════
# TENANT's active pack key
# ═══════════════════════════════════════════════════════

@router.get("/tenant-pack-key")
def get_tenant_pack_key(
    tenant_id: Optional[int] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the pack key (group::slug) for a tenant."""
    target_tenant = tenant_id or user.tenant_id
    if not target_tenant:
        return {"key": None}

    row = (
        db.query(PackConfig)
        .filter(
            PackConfig.tenant_id == target_tenant,
            PackConfig.archived_at.is_(None),
        )
        .order_by(PackConfig.created_at.asc())
        .limit(1)
        .first()
    )

    if not row:
        return {"key": None}

    return {"key": f"{row.group_slug}::{row.pack_slug}"}