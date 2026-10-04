"""
Role Change History API.

Endpoints:
    GET /role-changes              — list with filters
    GET /role-changes/export       — CSV export
    GET /role-changes/filter-options — dropdowns data
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func
from typing import Optional
from datetime import datetime
import csv
import io

from app.db.database import get_db
from app.core.permissions import require_role
from app.core.constants import (
    SUPER_ADMIN_ROLE as SA_CONST,
    ADMIN_ROLE,
)
from app.models.user import User
from app.models.role_change_history import RoleChangeHistory
from app.schemas.role_change_history import (
    RoleChangeResponse,
    RoleChangeListResponse,
)

router = APIRouter(prefix="/role-changes", tags=["Role Changes"])

SUPER_ADMIN_ROLE = "super_admin"
ALLOWED_ROLES = (SA_CONST, ADMIN_ROLE)


# ============================================================
# LIST
# ============================================================

@router.get("", response_model=RoleChangeListResponse)
def list_role_changes(
    search: Optional[str] = None,
    old_role: Optional[str] = None,
    new_role: Optional[str] = None,
    user_id: Optional[int] = None,
    actor_id: Optional[int] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(require_role(*ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    """List role change history for the tenant."""

    # SuperAdmin sees all; others see own tenant only
    query = db.query(RoleChangeHistory)

    if user.role != SA_CONST:
        if not user.tenant_id:
            raise HTTPException(400, "User has no tenant")
        query = query.filter(RoleChangeHistory.tenant_id == user.tenant_id)

    # ── Search ──
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                RoleChangeHistory.user_name.ilike(pattern),
                RoleChangeHistory.user_email.ilike(pattern),
                RoleChangeHistory.actor_name.ilike(pattern),
                RoleChangeHistory.actor_email.ilike(pattern),
                RoleChangeHistory.old_role.ilike(pattern),
                RoleChangeHistory.new_role.ilike(pattern),
            )
        )

    # ── Filters ──
    if old_role:
        query = query.filter(RoleChangeHistory.old_role == old_role)
    if new_role:
        query = query.filter(RoleChangeHistory.new_role == new_role)
    if user_id:
        query = query.filter(RoleChangeHistory.user_id == user_id)
    if actor_id:
        query = query.filter(RoleChangeHistory.actor_id == actor_id)
    if from_date:
        query = query.filter(RoleChangeHistory.created_at >= from_date)
    if to_date:
        query = query.filter(RoleChangeHistory.created_at <= to_date)

    total = query.count()
    rows = (
        query.order_by(desc(RoleChangeHistory.created_at))
        .offset(skip).limit(limit).all()
    )

    return RoleChangeListResponse(
        data=[RoleChangeResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


# ============================================================
# FILTER OPTIONS (for dropdowns)
# ============================================================

@router.get("/filter-options")
def get_filter_options(
    user: User = Depends(require_role(*ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    """Return distinct users and roles for the frontend filters."""

    base = db.query(RoleChangeHistory)
    if user.role != SA_CONST:
        if not user.tenant_id:
            raise HTTPException(400, "User has no tenant")
        base = base.filter(RoleChangeHistory.tenant_id == user.tenant_id)

    # Distinct users
    users_rows = (
        base.with_entities(
            RoleChangeHistory.user_id,
            RoleChangeHistory.user_name,
            RoleChangeHistory.user_email,
        )
        .distinct()
        .all()
    )
    users = [
        {"id": uid, "name": uname or uemail or f"User {uid}"}
        for uid, uname, uemail in users_rows
        if uid
    ]

    # Distinct roles (union of old + new)
    old_roles = {r[0] for r in base.with_entities(RoleChangeHistory.old_role).distinct().all() if r[0]}
    new_roles = {r[0] for r in base.with_entities(RoleChangeHistory.new_role).distinct().all() if r[0]}
    roles = sorted(old_roles | new_roles)

    return {
        "users": users,
        "roles": roles,
    }


# ============================================================
# EXPORT CSV
# ============================================================

@router.get("/export")
def export_role_changes(
    search: Optional[str] = None,
    old_role: Optional[str] = None,
    new_role: Optional[str] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    user: User = Depends(require_role(*ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    """Export role change history as CSV."""

    query = db.query(RoleChangeHistory)
    if user.role != SA_CONST:
        if not user.tenant_id:
            raise HTTPException(400, "User has no tenant")
        query = query.filter(RoleChangeHistory.tenant_id == user.tenant_id)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                RoleChangeHistory.user_name.ilike(pattern),
                RoleChangeHistory.user_email.ilike(pattern),
                RoleChangeHistory.actor_name.ilike(pattern),
            )
        )
    if old_role:
        query = query.filter(RoleChangeHistory.old_role == old_role)
    if new_role:
        query = query.filter(RoleChangeHistory.new_role == new_role)
    if from_date:
        query = query.filter(RoleChangeHistory.created_at >= from_date)
    if to_date:
        query = query.filter(RoleChangeHistory.created_at <= to_date)

    rows = query.order_by(desc(RoleChangeHistory.created_at)).limit(5000).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "created_at", "user_name", "user_email",
        "old_role", "new_role", "actor_name", "actor_email",
    ])
    for r in rows:
        writer.writerow([
            r.id,
            r.created_at.isoformat() if r.created_at else "",
            r.user_name or "",
            r.user_email or "",
            r.old_role,
            r.new_role,
            r.actor_name or "",
            r.actor_email or "",
        ])

    output.seek(0)
    filename = f"role_changes_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )