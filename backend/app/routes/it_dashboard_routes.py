"""
IT Services — Dashboard routes (KPIs + charts).
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from datetime import datetime, timedelta

from app.db.database import get_db
from app.core.industry_gate import require_industry
from app.models.user import User
from app.models.it_project import ITProject, IT_PROJECT_STAGES
from app.models.it_ticket import ITTicket, IT_TICKET_PRIORITIES

router = APIRouter(prefix="/it/dashboard", tags=["IT Dashboard"])


# ============================================================
# MAIN KPIs
# ============================================================

@router.get("")
def get_it_dashboard(
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    """Return IT dashboard KPIs + charts."""

    # Base queries
    proj_q = db.query(ITProject)
    tick_q = db.query(ITTicket)

    if user.role != "super_admin":
        proj_q = proj_q.filter(ITProject.tenant_id == user.tenant_id)
        tick_q = tick_q.filter(ITTicket.tenant_id == user.tenant_id)

    # ── KPI cards ──
    active_projects = proj_q.filter(
        ~ITProject.stage.in_(["delivered", "closed"])
    ).count()

    delivered_projects = proj_q.filter(
        ITProject.stage.in_(["delivered", "closed"])
    ).count()

    open_tickets = tick_q.filter(
        ITTicket.status.in_(["open", "in_progress", "blocked"])
    ).count()

    revenue_booked = (
        proj_q
        .filter(ITProject.stage.in_(["delivered", "closed"]))
        .with_entities(func.coalesce(func.sum(ITProject.value), 0))
        .scalar()
        or 0
    )

    # ── Projects by stage (bar chart) ──
    projects_by_stage = []
    for s in IT_PROJECT_STAGES:
        count = proj_q.filter(ITProject.stage == s).count()
        projects_by_stage.append({"stage": s, "count": count})

    # ── Tickets by priority (pie chart) ──
    tickets_by_priority = []
    for p in IT_TICKET_PRIORITIES:
        count = tick_q.filter(ITTicket.priority == p).count()
        tickets_by_priority.append({"priority": p, "count": count})

    return {
        "active_projects": active_projects,
        "delivered_projects": delivered_projects,
        "open_tickets": open_tickets,
        "revenue_booked": float(revenue_booked),
        "projects_by_stage": projects_by_stage,
        "tickets_by_priority": tickets_by_priority,
    }