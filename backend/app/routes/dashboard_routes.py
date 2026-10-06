from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, desc, extract
from datetime import date, datetime, timedelta
from typing import Optional

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.permissions import require_feature_permission  # <-- NEW
from app.models.user import User
from app.models.lead import Lead
from app.models.proposal import Proposal
from app.models.audit_log import AuditLog
from app.models.task import Task
from dateutil.relativedelta import relativedelta 

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

SUPER_ADMIN_ROLE = "super_admin"


def _apply_tenant_filter(query, model, user: User):
    """Apply role-based tenant filtering. SuperAdmin → no filter."""
    if user.role != SUPER_ADMIN_ROLE:
        query = query.filter(model.tenant_id == user.tenant_id)

    if user.role in ("sales_executive", "executive"):
        # Check karo model mein `assigned_to` hai ya nahi
        if hasattr(model, "assigned_to"):
            query = query.filter(model.assigned_to == user.id)
    return query


# ============================================================
# STATS — 10 Cards
# ============================================================

@router.get("/stats")
def get_dashboard_stats(
    # 🔒 FEATURE MATRIX: dashboard.view
    user: User = Depends(require_feature_permission("dashboard", "view")),
    db: Session = Depends(get_db),
):
    """Retrieve dashboard statistics."""

    # === LEADS ===
    leads_query = _apply_tenant_filter(db.query(Lead), Lead, user)
    total_leads = leads_query.count()
    qualified = leads_query.filter(Lead.status == "qualified").count()
    won_leads = leads_query.filter(Lead.status == "won").count()
    lost_leads = leads_query.filter(Lead.status == "lost").count()

    open_deals = leads_query.filter(
        ~Lead.status.in_(["won", "lost"])
    ).count()

    # === PROPOSALS ===
    proposals_query = _apply_tenant_filter(db.query(Proposal), Proposal, user)

    # === Revenue ===
    revenue = (
        _apply_tenant_filter(
            db.query(func.coalesce(func.sum(Lead.estimated_value), 0)),
            Lead,
            user,
        )
        .filter(Lead.status == "won")
        .scalar()
        or 0
    )

    # === Pipeline value ===
    OPEN_STAGES = {"new", "contacted", "qualified", "proposal_sent", "negotiation"}

    pipeline_value = (
        leads_query
        .filter(Lead.status.in_(list(OPEN_STAGES)))
        .with_entities(func.coalesce(func.sum(Lead.estimated_value), 0))
        .scalar()
        or 0
    )

    # === Average deal size ===
    total_proposals = proposals_query.count()
    total_proposal_value = (
        proposals_query
        .with_entities(func.sum(Proposal.amount))
        .scalar()
        or 0
    )
    avg_deal_size = (
        float(total_proposal_value) / total_proposals
        if total_proposals > 0
        else 0
    )

    # === Conversion ===
    conversion_rate = (
        (won_leads / total_leads * 100)
        if total_leads > 0
        else 0
    )

    # === Tasks today ===
    tasks_query = _apply_tenant_filter(
        db.query(func.count(Task.id)), Task, user
    )
    tasks_today = (
        tasks_query
        .filter(func.date(Task.due_date) == date.today())
        .filter(Task.status != "completed")
        .scalar()
        or 0
    )

    return {
        "total_leads": total_leads,
        "qualified": qualified,
        "open_deals": open_deals,
        "won": won_leads,
        "lost": lost_leads,
        "revenue": float(revenue),
        "pipeline_value": float(pipeline_value),
        "avg_deal_size": float(avg_deal_size),
        "conversion_rate": round(conversion_rate, 2),
        "tasks_today": tasks_today,
    }


# ============================================================
# REVENUE CHART (Monthly)
# ============================================================

# @router.get("/revenue-chart")
# def get_revenue_chart(
#     months: int = Query(12, ge=1, le=24),
#     # 🔒 FEATURE MATRIX: dashboard.view
#     user: User = Depends(require_feature_permission("dashboard", "view")),
#     db: Session = Depends(get_db),
# ):
#     query = _apply_tenant_filter(db.query(Proposal), Proposal, user)
#     query = query.filter(Proposal.status == "accepted")

#     now = datetime.utcnow()
#     start_date = now - timedelta(days=months * 30)

#     results = (
#         query
#         .filter(Proposal.accepted_at >= start_date)
#         .with_entities(
#             extract("year", Proposal.accepted_at).label("year"),
#             extract("month", Proposal.accepted_at).label("month"),
#             func.sum(Proposal.amount).label("revenue"),
#             func.count(Proposal.id).label("count"),
#         )
#         .group_by("year", "month")
#         .order_by("year", "month")
#         .all()
#     )

#     month_names = [
#         "Jan", "Feb", "Mar", "Apr", "May", "Jun",
#         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
#     ]

#     data = []
#     for row in results:
#         month_idx = int(row.month) - 1
#         data.append({
#             "month": month_names[month_idx],
#             "year": int(row.year),
#             "label": f"{month_names[month_idx]} {int(row.year)}",
#             "revenue": float(row.revenue or 0),
#             "count": int(row.count or 0),
#         })

#     return {"data": data}

@router.get("/revenue-chart")
def get_revenue_chart(
    months: int = Query(12, ge=1, le=24),
    user: User = Depends(require_feature_permission("dashboard", "view")),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(Proposal), Proposal, user)
    query = query.filter(Proposal.status == "accepted")

    # ─────────────────────────────────────────
    # 12 months ka range: current month + 11 pichhle
    # ─────────────────────────────────────────
    now = datetime.utcnow()
    end_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    start_month = end_month - relativedelta(months=months - 1)

    results = (
        query
        .filter(Proposal.accepted_at >= start_month)
        .with_entities(
            extract("year", Proposal.accepted_at).label("year"),
            extract("month", Proposal.accepted_at).label("month"),
            func.sum(Proposal.amount).label("revenue"),
            func.count(Proposal.id).label("count"),
        )
        .group_by("year", "month")
        .order_by("year", "month")
        .all()
    )

    # ─────────────────────────────────────────
    # DB results ko dict mein convert karo
    # Key: "2025-11", "2025-12", ...
    # ─────────────────────────────────────────
    data_map = {}
    for row in results:
        key = f"{int(row.year)}-{int(row.month):02d}"
        data_map[key] = {
            "revenue": float(row.revenue or 0),
            "count": int(row.count or 0),
        }

    month_names = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    ]

    # ─────────────────────────────────────────
    # 12 months ka COMPLETE skeleton banao
    # Missing months → revenue: 0
    # ─────────────────────────────────────────
    data = []
    current = start_month
    for _ in range(months):
        key = f"{current.year}-{current.month:02d}"
        month_idx = current.month - 1

        entry = data_map.get(key, {"revenue": 0.0, "count": 0})

        data.append({
            "month": month_names[month_idx],
            "year": current.year,
            "label": f"{month_names[month_idx]} {current.year}",
            "revenue": entry["revenue"],
            "count": entry["count"],
        })

        current = current + relativedelta(months=1)

    return {"data": data}

# ============================================================
# LEAD SOURCES
# ============================================================

@router.get("/lead-sources")
def get_lead_sources(
    # 🔒 FEATURE MATRIX: dashboard.view
    user: User = Depends(require_feature_permission("dashboard", "view")),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(Lead), Lead, user)

    results = (
        query
        .with_entities(
            Lead.source,
            func.count(Lead.id).label("count"),
        )
        .group_by(Lead.source)
        .order_by(desc("count"))
        .all()
    )

    total = sum(int(row.count or 0) for row in results)

    data = []
    for row in results:
        count = int(row.count or 0)
        data.append({
            "source": row.source or "unknown",
            "count": count,
            "percentage": round((count / total * 100) if total > 0 else 0, 2),
        })

    return {"data": data, "total": total}


# ============================================================
# RECENT ACTIVITY
# ============================================================

@router.get("/recent-activity")
def get_recent_activity(
    limit: int = Query(20, ge=1, le=100),
    # 🔒 FEATURE MATRIX: dashboard.view
    user: User = Depends(require_feature_permission("dashboard", "view")),
    db: Session = Depends(get_db),
):
    """Return recent activity across audit logs, leads, and proposals."""
    activities = []

    # === AUDIT LOGS ===
    audit_query = _apply_tenant_filter(
        db.query(AuditLog), AuditLog, user
    )
    audit_logs = audit_query.order_by(
        desc(AuditLog.created_at)
    ).limit(limit).all()

    for log in audit_logs:
        log_user = db.query(User).filter(User.id == log.user_id).first()
        user_name = log_user.full_name if log_user else "System"

        activities.append({
            "type": "audit",
            "action": log.action,
            "entity": log.table_name,       
            "entity_id": str(log.row_id) if log.row_id else None,
            "title": f"{log.action}",
            "description": f"by {user_name}",
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })

    # === LEADS ===
    leads_query = _apply_tenant_filter(db.query(Lead), Lead, user)
    recent_leads = leads_query.order_by(desc(Lead.created_at)).limit(limit).all()

    for lead in recent_leads:
        activities.append({
            "type": "lead_created",
            "action": "Created lead",
            "title": f"Created lead: {lead.name or lead.email or 'Unknown'}",
            "description": f"Source: {lead.source} • Status: {lead.status}",
            "entity_id": lead.id,
            "created_at": lead.created_at.isoformat() if lead.created_at else None,
        })

    # === PROPOSALS ===
    proposals_query = _apply_tenant_filter(db.query(Proposal), Proposal, user)
    recent_proposals = proposals_query.order_by(
        desc(Proposal.created_at)
    ).limit(limit).all()

    for proposal in recent_proposals:
        activities.append({
            "type": "proposal_created",
            "action": "Updated proposals",
            "title": f"Proposal: {proposal.title}",
            "description": f"₹{proposal.amount} • Status: {proposal.status}",
            "entity_id": proposal.id,
            "created_at": proposal.created_at.isoformat() if proposal.created_at else None,
        })

    activities.sort(
        key=lambda x: x["created_at"] or "",
        reverse=True,
    )

    return {"data": activities[:limit]}


# ============================================================
# PIPELINE
# ============================================================

@router.get("/pipeline")
def get_pipeline(
    # 🔒 FEATURE MATRIX: dashboard.view
    user: User = Depends(require_feature_permission("dashboard", "view")),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(Proposal), Proposal, user)

    results = (
        query
        .with_entities(
            Proposal.pipeline_stage,
            func.count(Proposal.id).label("count"),
            func.sum(Proposal.amount).label("value"),
        )
        .group_by(Proposal.pipeline_stage)
        .all()
    )

    data = []
    for row in results:
        data.append({
            "stage": row.pipeline_stage or "unknown",
            "count": int(row.count or 0),
            "value": float(row.value or 0),
        })

    return {"data": data}


# ============================================================
# FUNNEL
# ============================================================

@router.get("/funnel")
def get_sales_funnel(
    # 🔒 FEATURE MATRIX: dashboard.view
    user: User = Depends(require_feature_permission("dashboard", "view")),
    db: Session = Depends(get_db),
):
    """Return complete sales funnel with lead and proposal counts."""

    leads_query = _apply_tenant_filter(db.query(Lead), Lead, user)

    new_count = leads_query.filter(Lead.status == "new").count()
    contacted_count = leads_query.filter(Lead.status == "contacted").count()
    qualified_count = leads_query.filter(Lead.status == "qualified").count()
    won_count = leads_query.filter(Lead.status == "won").count()
    lost_count = leads_query.filter(Lead.status == "lost").count()

    proposals_query = _apply_tenant_filter(db.query(Proposal), Proposal, user)

    proposal_sent = proposals_query.filter(Proposal.status == "sent").count()
    negotiation = proposals_query.filter(
        Proposal.pipeline_stage == "negotiation"
    ).count()

    total_leads = new_count + contacted_count + qualified_count + won_count + lost_count

    return {
        "stages": [
            {"name": "new", "label": "New", "count": new_count},
            {"name": "contacted", "label": "Contacted", "count": contacted_count},
            {"name": "qualified", "label": "Qualified", "count": qualified_count},
            {"name": "proposal_sent", "label": "Proposal Sent", "count": proposal_sent},
            {"name": "negotiation", "label": "Negotiation", "count": negotiation},
            {"name": "won", "label": "Won", "count": won_count},
        ],
        "total_leads": total_leads,
        "conversion_rate": (
            round(won_count / total_leads * 100, 2)
            if total_leads > 0
            else 0
        ),
    }


# ============================================================
# TOP PERFORMERS
# ============================================================

@router.get("/top-performers")
def get_top_performers(
    limit: int = Query(5, ge=1, le=20),
    # 🔒 FEATURE MATRIX: dashboard.view
    user: User = Depends(require_feature_permission("dashboard", "view")),
    db: Session = Depends(get_db),
):
    """Return top owners by revenue and top lead sources."""

    proposals_query = _apply_tenant_filter(db.query(Proposal), Proposal, user)

    top_owners = (
        proposals_query
        .filter(Proposal.status == "accepted")
        .with_entities(
            Proposal.owner,
            func.sum(Proposal.amount).label("revenue"),
            func.count(Proposal.id).label("deals"),
        )
        .group_by(Proposal.owner)
        .order_by(desc("revenue"))
        .limit(limit)
        .all()
    )

    leads_query = _apply_tenant_filter(db.query(Lead), Lead, user)

    top_sources = (
        leads_query
        .with_entities(
            Lead.source,
            func.count(Lead.id).label("count"),
        )
        .group_by(Lead.source)
        .order_by(desc("count"))
        .limit(limit)
        .all()
    )

    return {
        "top_owners": [
            {
                "owner": row.owner or "Unassigned",
                "revenue": float(row.revenue or 0),
                "deals": int(row.deals or 0),
            }
            for row in top_owners
        ],
        "top_sources": [
            {
                "source": row.source or "unknown",
                "count": int(row.count or 0),
            }
            for row in top_sources
        ],
    }