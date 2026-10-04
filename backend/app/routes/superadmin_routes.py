"""
SuperAdmin API endpoints.
Provides cross-tenant administrative access to platform-wide
data including clients, leads, proposals, users, and audit logs.
All endpoints in this module require SuperAdmin privileges.
"""

from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List

from app.db.database import get_db
from app.core.permissions import require_super_admin
from app.models.user import User
from app.models.tenant import Tenant
from app.models.lead import Lead
from app.models.proposal import Proposal

router = APIRouter(prefix="/superadmin", tags=["SuperAdmin"])


# ============================================================
# GLOBAL STATISTICS
# ============================================================

@router.get("/stats")
def get_global_stats(
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Retrieve platform-wide statistics.

    Aggregates counts and totals across all tenants.
    Requires SuperAdmin access.
    """
    total_clients = db.query(Tenant).count()
    active_clients = db.query(Tenant).filter(Tenant.status == "active").count()

    total_users = db.query(User).count()
    total_leads = db.query(Lead).count()
    total_proposals = db.query(Proposal).count()
    accepted_proposals = (
        db.query(Proposal).filter(Proposal.status == "accepted").count()
    )

    total_revenue = (
        db.query(func.sum(Proposal.amount))
        .filter(Proposal.status == "accepted")
        .scalar()
        or 0
    )

    return {
        "clients": {
            "total": total_clients,
            "active": active_clients,
        },
        "users": {
            "total": total_users,
        },
        "leads": {
            "total": total_leads,
        },
        "proposals": {
            "total": total_proposals,
            "accepted": accepted_proposals,
        },
        "revenue": {
            "total": float(total_revenue),
        },
    }


# ============================================================
# CLIENTS (TENANTS)
# ============================================================

@router.get("/clients")
def list_all_clients(
    search: Optional[str] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Retrieve all clients (tenants) with optional filters.

    Enriched with lead/proposal/user counts using grouped queries
    (avoids N+1 — only 4 queries total regardless of page size).
    """
    query = db.query(Tenant)

    if status_filter:
        query = query.filter(Tenant.status == status_filter)
    if search:
        query = query.filter(Tenant.name.ilike(f"%{search}%"))

    clients = query.order_by(desc(Tenant.created_at)).offset(skip).limit(limit).all()

    if not clients:
        return []

    tenant_ids = [c.id for c in clients]

    # ---- Single grouped query per entity (avoids N+1) ----
    lead_counts = dict(
        db.query(Lead.tenant_id, func.count(Lead.id))
        .filter(Lead.tenant_id.in_(tenant_ids))
        .group_by(Lead.tenant_id)
        .all()
    )

    proposal_counts = dict(
        db.query(Proposal.tenant_id, func.count(Proposal.id))
        .filter(Proposal.tenant_id.in_(tenant_ids))
        .group_by(Proposal.tenant_id)
        .all()
    )

    user_counts = dict(
        db.query(User.tenant_id, func.count(User.id))
        .filter(User.tenant_id.in_(tenant_ids))
        .group_by(User.tenant_id)
        .all()
    )

    return [
        {
            "id": c.id,
            "name": c.name,
            "subdomain": c.subdomain,
            "status": c.status,
            "created_at": c.created_at,
            "lead_count": lead_counts.get(c.id, 0),
            "proposal_count": proposal_counts.get(c.id, 0),
            "user_count": user_counts.get(c.id, 0),
        }
        for c in clients
    ]


@router.get("/clients/{client_id}")
def get_client_detail(
    client_id: int,
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Retrieve detailed information for a specific client.

    Includes counts of associated leads, proposals, and users.
    """
    client = db.query(Tenant).filter(Tenant.id == client_id).first()
    if not client:
        raise HTTPException(status_code=404, detail="Client not found")

    return {
        "id": client.id,
        "name": client.name,
        "subdomain": client.subdomain,
        "status": client.status,
        "settings": client.settings,
        "branding": client.branding,
        "created_at": client.created_at,
        "lead_count": db.query(Lead).filter(Lead.tenant_id == client.id).count(),
        "proposal_count": (
            db.query(Proposal).filter(Proposal.tenant_id == client.id).count()
        ),
        "user_count": db.query(User).filter(User.tenant_id == client.id).count(),
    }


# ============================================================
# LEADS (ALL TENANTS)
# ============================================================

@router.get("/leads")
def list_all_leads(
    tenant_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Retrieve leads across all tenants.

    Optionally filter by a specific tenant.
    """
    query = db.query(Lead)

    if tenant_id:
        query = query.filter(Lead.tenant_id == tenant_id)
    if status_filter:
        query = query.filter(Lead.status == status_filter)

    return query.order_by(desc(Lead.created_at)).offset(skip).limit(limit).all()


# ============================================================
# PROPOSALS (ALL TENANTS)
# ============================================================

@router.get("/proposals")
def list_all_proposals(
    tenant_id: Optional[int] = None,
    status_filter: Optional[str] = Query(None, alias="status"),
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Retrieve proposals across all tenants.

    Optionally filter by a specific tenant.
    """
    query = db.query(Proposal)

    if tenant_id:
        query = query.filter(Proposal.tenant_id == tenant_id)
    if status_filter:
        query = query.filter(Proposal.status == status_filter)

    return query.order_by(desc(Proposal.created_at)).offset(skip).limit(limit).all()


# ============================================================
# USERS (ALL TENANTS)
# ============================================================

@router.get("/users")
def list_all_users(
    tenant_id: Optional[int] = None,
    role: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    admin: User = Depends(require_super_admin),
    db: Session = Depends(get_db),
):
    """
    Retrieve users across all tenants.

    Optionally filter by tenant or role.
    """
    query = db.query(User)

    if tenant_id:
        query = query.filter(User.tenant_id == tenant_id)
    if role:
        query = query.filter(User.role == role)

    users = query.order_by(desc(User.created_at)).offset(skip).limit(limit).all()

    return [
        {
            "id": u.id,
            "full_name": u.full_name,
            "email": u.email,
            "role": u.role,
            "status": u.status,
            "tenant_id": u.tenant_id,
            "created_at": u.created_at,
        }
        for u in users
    ]