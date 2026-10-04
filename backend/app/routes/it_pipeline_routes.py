"""
IT Services — Pipeline (Kanban) view.

Returns IT projects grouped by stage for the Kanban board.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from app.db.database import get_db
from app.core.industry_gate import require_industry
from app.models.user import User
from app.models.it_project import ITProject, IT_PROJECT_STAGES

router = APIRouter(prefix="/it/pipeline", tags=["IT Pipeline"])


# ============================================================
# Stage metadata (label, color for UI)
# ============================================================

STAGE_META = {
    "discovery":    {"label": "Discovery",    "color": "#6B7280", "order": 1},
    "proposal":     {"label": "Proposal",     "color": "#3B82F6", "order": 2},
    "negotiation":  {"label": "Negotiation",  "color": "#F59E0B", "order": 3},
    "contract":     {"label": "Contract",     "color": "#8B5CF6", "order": 4},
    "kickoff":      {"label": "Kickoff",      "color": "#06B6D4", "order": 5},
    "in_progress":  {"label": "In Progress",  "color": "#10B981", "order": 6},
    "uat":          {"label": "UAT",          "color": "#EC4899", "order": 7},
    "delivered":    {"label": "Delivered",    "color": "#22C55E", "order": 8},
    "closed":       {"label": "Closed",       "color": "#64748B", "order": 9},
}


# ============================================================
# GET PIPELINE
# ============================================================

@router.get("")
def get_it_pipeline(
    owner_id: Optional[int] = Query(None),
    search: Optional[str] = Query(None),
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    """
    Return IT projects grouped by stage for the Kanban board.
    """
    query = db.query(ITProject)

    if user.role != "super_admin":
        query = query.filter(ITProject.tenant_id == user.tenant_id)

    if owner_id:
        query = query.filter(ITProject.owner_id == owner_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (ITProject.name.ilike(pattern)) |
            (ITProject.client_name.ilike(pattern))
        )

    projects = query.order_by(desc(ITProject.updated_at)).all()

    # Group by stage
    stage_groups = []
    total_deals = 0
    total_value = 0.0

    for stage_key in IT_PROJECT_STAGES:
        meta = STAGE_META.get(stage_key, {})
        stage_projects = [p for p in projects if p.stage == stage_key]

        stage_value = sum(float(p.value or 0) for p in stage_projects)

        deals = [
            {
                "id": p.id,
                "uuid": str(p.uuid),
                "name": p.name,
                "client_name": p.client_name,
                "client_email": p.client_email,
                "stack": p.stack,
                "stage": p.stage,
                "value": float(p.value or 0),
                "currency": p.currency or "INR",
                "start_date": p.start_date.isoformat() if p.start_date else None,
                "end_date": p.end_date.isoformat() if p.end_date else None,
                "owner_id": p.owner_id,
                "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            }
            for p in stage_projects
        ]

        stage_groups.append({
            "stage": stage_key,
            "label": meta.get("label", stage_key.title()),
            "color": meta.get("color", "#6B7280"),
            "order": meta.get("order", 99),
            "deals": deals,
            "count": len(stage_projects),
            "total_value": stage_value,
        })

        total_deals += len(stage_projects)
        total_value += stage_value

    return {
        "stages": stage_groups,
        "total_deals": total_deals,
        "total_value": total_value,
    }


# ============================================================
# PIPELINE STATS (mini summary)
# ============================================================

@router.get("/summary")
def get_it_pipeline_summary(
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    """Small summary for the pipeline header."""
    query = db.query(ITProject)

    if user.role != "super_admin":
        query = query.filter(ITProject.tenant_id == user.tenant_id)

    total = query.count()

    active = query.filter(
        ~ITProject.stage.in_(["delivered", "closed"])
    ).count()

    delivered = query.filter(
        ITProject.stage.in_(["delivered", "closed"])
    ).count()

    pipeline_value = (
        query
        .filter(~ITProject.stage.in_(["delivered", "closed"]))
        .with_entities(__import__("sqlalchemy").func.coalesce(
            __import__("sqlalchemy").func.sum(ITProject.value), 0
        ))
        .scalar() or 0
    )

    return {
        "total": total,
        "active": active,
        "delivered": delivered,
        "pipeline_value": float(pipeline_value),
    }