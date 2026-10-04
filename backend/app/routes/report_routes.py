"""
Reports API — read-only aggregates matching the Reports & Analytics UI.

Endpoints:
    GET /reports/summary                 — 5 KPI cards
    GET /reports/revenue-trend           — leads + revenue per month (dual chart)
    GET /reports/lead-sources            — pie chart of sources
    GET /reports/priority-distribution   — horizontal bar chart
    GET /reports/top-industries          — pie chart of industries
    GET /reports/sales-performance       — rep-wise performance (secondary)
    GET /reports/activity                — per-user activity (secondary)
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, extract, case
from typing import Optional
from datetime import datetime, timedelta

from app.db.database import get_db
from app.core.permissions import require_role
from app.core.constants import (
    SUPER_ADMIN_ROLE as SA_CONST,
    ADMIN_ROLE,
    MANAGER_ROLE,
    EXECUTIVE_ROLE,
)
from app.models.user import User
from app.models.lead import Lead
from app.models.task import Task
from app.models.ticket import Ticket
from app.models.meeting import Meeting
from app.schemas.report import (
    ReportSummary,
    RevenueTrendReport,
    RevenueTrendPoint,
    LeadSourcesReport,
    LeadSourcePoint,
    PriorityDistributionReport,
    PriorityPoint,
    TopIndustriesReport,
    IndustryPoint,
    SalesPerformanceReport,
    SalesPerformerRow,
    ActivityReport,
    ActivityRow,
)

router = APIRouter(prefix="/reports", tags=["Reports"])

SUPER_ADMIN_ROLE = "super_admin"


# ============================================================
# HELPERS
# ============================================================

def _scope(query, model, user: User, tenant_id: Optional[int] = None):
    """Apply tenant + executive scoping."""
    if user.role == SA_CONST:
        if tenant_id:
            query = query.filter(model.tenant_id == tenant_id)
        return query

    query = query.filter(model.tenant_id == user.tenant_id)

    if user.role == EXECUTIVE_ROLE and hasattr(model, "assigned_to"):
        query = query.filter(model.assigned_to == user.id)

    return query


ALLOWED_ROLES = (SA_CONST, ADMIN_ROLE, MANAGER_ROLE, EXECUTIVE_ROLE)


# ============================================================
# 1. SUMMARY (5 KPI cards)
# ============================================================

@router.get("/summary", response_model=ReportSummary)
def get_report_summary(
    tenant_id: Optional[int] = Query(None, description="SuperAdmin only"),
    user: User = Depends(require_role(*ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    """Top-level KPI cards."""
    leads_q = _scope(db.query(Lead), Lead, user, tenant_id)

    total_leads = leads_q.count()
    won_deals = leads_q.filter(Lead.status == "won").count()
    total_revenue = (
        leads_q
        .filter(Lead.status == "won")
        .with_entities(func.coalesce(func.sum(Lead.estimated_value), 0))
        .scalar()
        or 0
    )

    avg_deal_size = float(total_revenue) / won_deals if won_deals > 0 else 0.0
    conversion_rate = (won_deals / total_leads * 100) if total_leads > 0 else 0.0

    return ReportSummary(
        total_leads=total_leads,
        won_deals=won_deals,
        total_revenue=float(total_revenue),
        avg_deal_size=round(avg_deal_size, 2),
        conversion_rate=round(conversion_rate, 2),
    )


# ============================================================
# 2. REVENUE TREND (dual chart: leads + revenue per month)
# ============================================================

@router.get("/revenue-trend", response_model=RevenueTrendReport)
def get_revenue_trend(
    months: int = Query(12, ge=1, le=24),
    tenant_id: Optional[int] = Query(None),
    user: User = Depends(require_role(*ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    """
    Return monthly leads count + revenue.
    - leads: count of leads created in that month
    - revenue: sum of estimated_value of leads WON that month
    """
    now = datetime.utcnow()
    start_date = now - timedelta(days=months * 30)

    # ----- Leads per month (all statuses) -----
    leads_by_month_q = _scope(db.query(Lead), Lead, user, tenant_id)
    leads_by_month_q = leads_by_month_q.filter(Lead.created_at >= start_date)

    lead_rows = (
        leads_by_month_q
        .with_entities(
            extract("year", Lead.created_at).label("year"),
            extract("month", Lead.created_at).label("month"),
            func.count(Lead.id).label("count"),
        )
        .group_by("year", "month")
        .all()
    )

    # ----- Revenue per month (only won leads) -----
    rev_q = _scope(db.query(Lead), Lead, user, tenant_id)
    rev_q = rev_q.filter(
        Lead.status == "won",
        Lead.updated_at >= start_date,
    )

    revenue_rows = (
        rev_q
        .with_entities(
            extract("year", Lead.updated_at).label("year"),
            extract("month", Lead.updated_at).label("month"),
            func.coalesce(func.sum(Lead.estimated_value), 0).label("revenue"),
        )
        .group_by("year", "month")
        .all()
    )

    # Build merged map
    month_names = [
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
    ]

    buckets = {}
    # Pre-populate the last N months so the chart always shows all labels
    for i in range(months - 1, -1, -1):
        d = now - timedelta(days=i * 30)
        key = (d.year, d.month)
        buckets[key] = {"leads": 0, "revenue": 0.0}

    for r in lead_rows:
        key = (int(r.year), int(r.month))
        if key not in buckets:
            buckets[key] = {"leads": 0, "revenue": 0.0}
        buckets[key]["leads"] += int(r.count or 0)

    for r in revenue_rows:
        key = (int(r.year), int(r.month))
        if key not in buckets:
            buckets[key] = {"leads": 0, "revenue": 0.0}
        buckets[key]["revenue"] += float(r.revenue or 0)

    sorted_keys = sorted(buckets.keys())
    data = []
    total_leads = 0
    total_revenue = 0.0
    for (yr, mo) in sorted_keys:
        label = f"{month_names[mo - 1]}"
        data.append(RevenueTrendPoint(
            label=label,
            year=yr,
            month=mo,
            leads=buckets[(yr, mo)]["leads"],
            revenue=round(buckets[(yr, mo)]["revenue"], 2),
        ))
        total_leads += buckets[(yr, mo)]["leads"]
        total_revenue += buckets[(yr, mo)]["revenue"]

    return RevenueTrendReport(
        data=data,
        months=months,
        total_leads=total_leads,
        total_revenue=round(total_revenue, 2),
    )


# ============================================================
# 3. LEAD SOURCES (pie chart)
# ============================================================

@router.get("/lead-sources", response_model=LeadSourcesReport)
def get_lead_sources(
    tenant_id: Optional[int] = Query(None),
    user: User = Depends(require_role(*ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    """Pie chart of lead counts by source."""
    leads_q = _scope(db.query(Lead), Lead, user, tenant_id)

    rows = (
        leads_q
        .with_entities(
            Lead.source,
            func.count(Lead.id).label("count"),
        )
        .group_by(Lead.source)
        .order_by(desc("count"))
        .all()
    )

    total = sum(int(r.count or 0) for r in rows)

    data = []
    for r in rows:
        count = int(r.count or 0)
        data.append(LeadSourcePoint(
            source=r.source or "unknown",
            count=count,
            percentage=round((count / total * 100) if total > 0 else 0, 2),
        ))

    return LeadSourcesReport(data=data, total=total)


# ============================================================
# 4. PRIORITY DISTRIBUTION (horizontal bar)
# ============================================================

@router.get("/priority-distribution", response_model=PriorityDistributionReport)
def get_priority_distribution(
    tenant_id: Optional[int] = Query(None),
    user: User = Depends(require_role(*ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    """Lead counts by priority (low, medium, high, urgent)."""
    leads_q = _scope(db.query(Lead), Lead, user, tenant_id)

    rows = (
        leads_q
        .with_entities(
            Lead.priority,
            func.count(Lead.id).label("count"),
        )
        .group_by(Lead.priority)
        .all()
    )

    counts = {"low": 0, "medium": 0, "high": 0, "urgent": 0}
    for r in rows:
        key = (r.priority or "medium").lower()
        if key in counts:
            counts[key] = int(r.count or 0)

    data = [PriorityPoint(priority=k, count=v) for k, v in counts.items()]
    return PriorityDistributionReport(data=data, total=sum(counts.values()))


# ============================================================
# 5. TOP INDUSTRIES (pie chart)
# ============================================================

@router.get("/top-industries", response_model=TopIndustriesReport)
def get_top_industries(
    limit: int = Query(5, ge=1, le=20),
    tenant_id: Optional[int] = Query(None),
    user: User = Depends(require_role(*ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    """Top N industries by lead count."""
    leads_q = _scope(db.query(Lead), Lead, user, tenant_id)

    rows = (
        leads_q
        .filter(Lead.industry.isnot(None))
        .with_entities(
            Lead.industry,
            func.count(Lead.id).label("count"),
        )
        .group_by(Lead.industry)
        .order_by(desc("count"))
        .limit(limit)
        .all()
    )

    data = [
        IndustryPoint(industry=r.industry or "Unknown", count=int(r.count or 0))
        for r in rows
    ]
    total = sum(p.count for p in data)
    return TopIndustriesReport(data=data, total=total)


# ============================================================
# 6. SALES PERFORMANCE (secondary — for managers/admins)
# ============================================================

@router.get("/sales-performance", response_model=SalesPerformanceReport)
def get_sales_performance(
    tenant_id: Optional[int] = Query(None),
    user: User = Depends(require_role(*ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    """Per-user won/lost/revenue."""
    leads_q = _scope(db.query(Lead), Lead, user, tenant_id)

    rows = (
        leads_q
        .with_entities(
            Lead.assigned_to,
            func.count(Lead.id).label("total"),
            func.sum(case((Lead.status == "won", 1), else_=0)).label("won"),
            func.sum(case((Lead.status == "lost", 1), else_=0)).label("lost"),
            func.sum(
                case(
                    ((Lead.status == "won"), func.coalesce(Lead.estimated_value, 0)),
                    else_=0,
                )
            ).label("revenue"),
        )
        .group_by(Lead.assigned_to)
        .all()
    )

    user_ids = [r.assigned_to for r in rows if r.assigned_to]
    users_map = {}
    if user_ids:
        for u in db.query(User).filter(User.id.in_(user_ids)).all():
            users_map[u.id] = u.full_name or u.email

    performers = []
    total_rev = 0.0
    total_won = 0

    for r in rows:
        uid = r.assigned_to
        won = int(r.won or 0)
        lost = int(r.lost or 0)
        revenue = float(r.revenue or 0)
        total = int(r.total or 0)

        performers.append(SalesPerformerRow(
            user_id=uid or 0,
            user_name=users_map.get(uid, "Unassigned") if uid else "Unassigned",
            won_deals=won,
            lost_deals=lost,
            open_deals=max(total - won - lost, 0),
            total_revenue=revenue,
            conversion_rate=round((won / total * 100) if total > 0 else 0, 2),
        ))
        total_rev += revenue
        total_won += won

    performers.sort(key=lambda p: p.total_revenue, reverse=True)

    return SalesPerformanceReport(
        data=performers,
        total_revenue=total_rev,
        total_won=total_won,
    )


# ============================================================
# 7. ACTIVITY (secondary)
# ============================================================

@router.get("/activity", response_model=ActivityReport)
def get_activity_report(
    tenant_id: Optional[int] = Query(None),
    user: User = Depends(require_role(*ALLOWED_ROLES)),
    db: Session = Depends(get_db),
):
    """Per-user activity: tasks, meetings, tickets."""
    tasks_q = _scope(db.query(Task), Task, user, tenant_id)
    task_rows = (
        tasks_q
        .with_entities(
            Task.assigned_to,
            func.count(Task.id).label("total"),
            func.sum(case((Task.status == "completed", 1), else_=0)).label("completed"),
        )
        .group_by(Task.assigned_to)
        .all()
    )

    meetings_q = _scope(db.query(Meeting), Meeting, user, tenant_id)
    meeting_rows = (
        meetings_q
        .with_entities(
            Meeting.created_by.label("user_id"),
            func.count(Meeting.id).label("total"),
        )
        .group_by(Meeting.created_by)
        .all()
    )

    tickets_q = _scope(db.query(Ticket), Ticket, user, tenant_id)
    ticket_rows = (
        tickets_q
        .with_entities(
            Ticket.assigned_to.label("user_id"),
            func.count(Ticket.id).label("total"),
        )
        .group_by(Ticket.assigned_to)
        .all()
    )

    user_ids = set()
    for r in task_rows:
        if r.assigned_to:
            user_ids.add(r.assigned_to)
    for r in meeting_rows:
        if r.user_id:
            user_ids.add(r.user_id)
    for r in ticket_rows:
        if r.user_id:
            user_ids.add(r.user_id)

    users_map = {}
    if user_ids:
        for u in db.query(User).filter(User.id.in_(list(user_ids))).all():
            users_map[u.id] = u.full_name or u.email

    activity = {}

    def ensure(uid):
        activity.setdefault(uid, {
            "tasks_created": 0, "tasks_completed": 0,
            "meetings_held": 0, "tickets_handled": 0,
        })

    for r in task_rows:
        if not r.assigned_to:
            continue
        ensure(r.assigned_to)
        activity[r.assigned_to]["tasks_created"] += int(r.total or 0)
        activity[r.assigned_to]["tasks_completed"] += int(r.completed or 0)

    for r in meeting_rows:
        if not r.user_id:
            continue
        ensure(r.user_id)
        activity[r.user_id]["meetings_held"] += int(r.total or 0)

    for r in ticket_rows:
        if not r.user_id:
            continue
        ensure(r.user_id)
        activity[r.user_id]["tickets_handled"] += int(r.total or 0)

    data = []
    grand_total = 0
    for uid, c in activity.items():
        total = c["tasks_created"] + c["meetings_held"] + c["tickets_handled"]
        data.append(ActivityRow(
            user_id=uid,
            user_name=users_map.get(uid, f"User {uid}"),
            tasks_created=c["tasks_created"],
            tasks_completed=c["tasks_completed"],
            meetings_held=c["meetings_held"],
            tickets_handled=c["tickets_handled"],
            total_activities=total,
        ))
        grand_total += total

    data.sort(key=lambda x: x.total_activities, reverse=True)
    return ActivityReport(data=data, total_activities=grand_total)