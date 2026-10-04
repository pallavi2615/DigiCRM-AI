"""
Audit Log API routes — read-only.

Permissions:
    - super_admin: all tenants
    - admin:       own tenant only
    - manager / executive: 403
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional
from datetime import datetime, date
from uuid import UUID
import csv
import io

from app.db.database import get_db
from app.core.permissions import require_role
from app.core.constants import (
    SUPER_ADMIN_ROLE as SA_CONST,
    ADMIN_ROLE,
)
from app.models.user import User
from app.models.audit_log import AuditLog
from app.schemas.audit_log import (
    AuditLogResponse,
    AuditLogListResponse,
    AuditLogStats,
)

router = APIRouter(prefix="/audit-logs", tags=["Audit Logs"])


def _apply_tenant_filter(query, user: User):
    if user.role != SA_CONST:
        query = query.filter(AuditLog.tenant_id == user.tenant_id)
    return query


# ── LIST ──────────────────────────────────────────
@router.get("", response_model=AuditLogListResponse)
def list_audit_logs(
    search: Optional[str] = Query(None),
    table_name: Optional[str] = Query(None, alias="table"),
    action: Optional[str] = Query(None),
    user_id: Optional[int] = Query(None),
    row_id: Optional[UUID] = Query(None),
    from_date: Optional[datetime] = Query(None),
    to_date: Optional[datetime] = Query(None),
    tenant_id: Optional[int] = Query(None, description="SuperAdmin only"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(AuditLog), user)

    if tenant_id and user.role == SA_CONST:
        query = query.filter(AuditLog.tenant_id == tenant_id)
    if search:
        query = query.filter(AuditLog.description.ilike(f"%{search}%"))
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    if action:
        query = query.filter(AuditLog.action == action)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if row_id:
        query = query.filter(AuditLog.row_id == row_id)
    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)

    total = query.count()
    rows = (
        query.order_by(desc(AuditLog.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )

    return AuditLogListResponse(
        data=[AuditLogResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


# ── STATS ─────────────────────────────────────────
@router.get("/stats", response_model=AuditLogStats)
def audit_log_stats(
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(AuditLog), user)
    today = date.today()

    return AuditLogStats(
        total=query.count(),
        today=query.filter(func.date(AuditLog.created_at) == today).count(),
        created=query.filter(AuditLog.action == "created").count(),
        updated=query.filter(AuditLog.action == "updated").count(),
        deleted=query.filter(AuditLog.action == "deleted").count(),
    )


# ── FILTER OPTIONS ────────────────────────────────
@router.get("/filter-options")
def get_filter_options(
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    """Distinct tables, actions, and users for the dropdowns."""
    query = _apply_tenant_filter(db.query(AuditLog), user)

    tables = [
        row[0]
        for row in query.with_entities(AuditLog.table_name)
        .distinct()
        .order_by(AuditLog.table_name)
        .all()
    ]

    actions = [
        row[0]
        for row in query.with_entities(AuditLog.action)
        .distinct()
        .order_by(AuditLog.action)
        .all()
    ]

    users = (
        query.with_entities(AuditLog.user_id, AuditLog.user_name)
        .filter(AuditLog.user_id.isnot(None))
        .distinct()
        .all()
    )
    user_options = [
        {"id": uid, "name": uname}
        for uid, uname in users
        if uid is not None
    ]

    return {
        "tables": tables,
        "actions": actions,
        "users": user_options,
    }


# ── EXPORT CSV ────────────────────────────────────
@router.get("/export")
def export_audit_logs(
    search: Optional[str] = None,
    table_name: Optional[str] = Query(None, alias="table"),
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    from_date: Optional[datetime] = None,
    to_date: Optional[datetime] = None,
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    """Export up to 500 audit logs as CSV."""
    query = _apply_tenant_filter(db.query(AuditLog), user)

    if search:
        query = query.filter(AuditLog.description.ilike(f"%{search}%"))
    if table_name:
        query = query.filter(AuditLog.table_name == table_name)
    if action:
        query = query.filter(AuditLog.action == action)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if from_date:
        query = query.filter(AuditLog.created_at >= from_date)
    if to_date:
        query = query.filter(AuditLog.created_at <= to_date)

    logs = query.order_by(desc(AuditLog.created_at)).limit(500).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "id", "created_at", "user_name", "table_name",
        "row_id", "action", "description",
    ])
    for log in logs:
        writer.writerow([
            log.id,
            log.created_at.isoformat() if log.created_at else "",
            log.user_name or "System",
            log.table_name,
            str(log.row_id),
            log.action,
            log.description or "",
        ])

    output.seek(0)
    filename = f"audit_logs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ── GET SINGLE ────────────────────────────────────
@router.get("/{log_id}", response_model=AuditLogResponse)
def get_audit_log(
    log_id: int,
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    log = (
        _apply_tenant_filter(db.query(AuditLog), user)
        .filter(AuditLog.id == log_id)
        .first()
    )
    if not log:
        raise HTTPException(404, "Audit log not found")
    return log