"""
Landing Analytics API.

Two endpoints:
    POST /landing/track       — PUBLIC. Records an event (no auth).
    GET  /landing/analytics   — AUTH. Returns KPIs + panels.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, func, distinct
from typing import Optional
from datetime import datetime, timedelta

from app.db.database import get_db
from app.core.permissions import require_role
from app.core.constants import (
    SUPER_ADMIN_ROLE as SA_CONST,
    ADMIN_ROLE,
    MANAGER_ROLE,
)
from app.models.user import User
from app.models.tenant import Tenant
from app.models.landing_event import LandingEvent
from app.schemas.landing_analytics import (
    LandingEventTrack,
    LandingEventTrackResponse,
    LandingAnalyticsResponse,
    LandingKPI,
    SourceRow,
    RecentEventRow,
)

router = APIRouter(prefix="/landing", tags=["Landing Analytics"])

SUPER_ADMIN_ROLE = "super_admin"


# ============================================================
# PUBLIC — TRACKING BEACON
# ============================================================

@router.post("/track", response_model=LandingEventTrackResponse)
def track_landing_event(
    payload: LandingEventTrack,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    PUBLIC endpoint — record a landing page event.

    Called by the tenant's landing page JS:
        fetch('/api/v1/landing/track', {
          method: 'POST',
          body: JSON.stringify({
            slug: 'acme',
            event_type: 'view',
            session_id: sessionStorage.getItem('sid'),
          })
        })
    """
    # Find tenant by slug (subdomain OR name, case-insensitive)
    tenant = (
        db.query(Tenant)
        .filter(
            (Tenant.subdomain == payload.slug) |
            (func.lower(Tenant.name) == payload.slug.lower())
        )
        .first()
    )
    if not tenant:
        raise HTTPException(404, f"Landing page '{payload.slug}' not found")
    if tenant.status != "active":
        raise HTTPException(403, "Tenant inactive")

    ip = request.client.host if request.client else None
    ua = request.headers.get("user-agent")

    event = LandingEvent(
        tenant_id=tenant.id,
        landing_slug=payload.slug,
        event_type=payload.event_type,
        session_id=payload.session_id,
        source=payload.source or request.headers.get("referer"),
        page_url=payload.page_url,
        user_agent=ua,
        ip_address=ip,
        country=payload.country,
        city=payload.city,
        form_data=payload.form_data or {},
        extra_data=payload.extra_data or {},
    )
    db.add(event)
    db.commit()
    db.refresh(event)

    return LandingEventTrackResponse(
        success=True,
        event_id=event.id,
        message="Event recorded",
    )


# ============================================================
# AUTH — ANALYTICS
# ============================================================

@router.get("/analytics", response_model=LandingAnalyticsResponse)
def get_landing_analytics(
    tenant_id: Optional[int] = Query(None, description="SuperAdmin only"),
    days: int = Query(7, ge=1, le=365, description="Range in days"),
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE, MANAGER_ROLE)),
    db: Session = Depends(get_db),
):
    """
    Return landing page KPIs and panels.

    Scope:
        - SuperAdmin: all tenants, or specific tenant_id.
        - Admin/Manager: own tenant only.
    """
    # ── Tenant scoping ──
    if user.role != SA_CONST:
        if not user.tenant_id:
            raise HTTPException(400, "User has no tenant")
        tenant_filter = user.tenant_id
    else:
        tenant_filter = tenant_id  # may be None → all tenants

    # ── Date range ──
    since = datetime.utcnow() - timedelta(days=days)

    # ── Base query ──
    base_q = db.query(LandingEvent).filter(LandingEvent.created_at >= since)
    if tenant_filter:
        base_q = base_q.filter(LandingEvent.tenant_id == tenant_filter)

    # ── KPI: unique sessions ──
    sessions = (
        base_q
        .with_entities(func.count(distinct(LandingEvent.session_id)))
        .scalar()
        or 0
    )

    views = base_q.filter(LandingEvent.event_type == "view").count()
    submits = base_q.filter(LandingEvent.event_type == "submit").count()

    conversion_rate = (
        round((submits / sessions * 100), 2) if sessions > 0 else 0.0
    )

    # ── Bounce rate: sessions with only 1 event ──
    session_event_counts = (
        base_q
        .with_entities(
            LandingEvent.session_id,
            func.count(LandingEvent.id).label("event_count"),
        )
        .group_by(LandingEvent.session_id)
        .all()
    )

    total_sessions = len(session_event_counts)
    bounced_sessions = sum(1 for r in session_event_counts if r.event_count == 1)
    bounce_rate = (
        round((bounced_sessions / total_sessions * 100), 2)
        if total_sessions > 0
        else 0.0
    )

    # ── Top sources ──
    source_rows = (
        base_q
        .with_entities(
            LandingEvent.source,
            func.count(distinct(LandingEvent.session_id)).label("sessions"),
        )
        .group_by(LandingEvent.source)
        .order_by(desc("sessions"))
        .limit(5)
        .all()
    )
    total_source_sessions = sum(int(r.sessions or 0) for r in source_rows)

    top_sources = [
        SourceRow(
            source=(r.source or "Direct"),
            sessions=int(r.sessions or 0),
            percentage=(
                round((int(r.sessions or 0) / total_source_sessions * 100), 2)
                if total_source_sessions > 0
                else 0.0
            ),
        )
        for r in source_rows
    ]

    # ── Recent events ──
    recent = (
        base_q
        .order_by(desc(LandingEvent.created_at))
        .limit(10)
        .all()
    )
    recent_events = [RecentEventRow.model_validate(r) for r in recent]

    return LandingAnalyticsResponse(
        kpi=LandingKPI(
            sessions=int(sessions),
            views=views,
            submits=submits,
            conversion_rate=conversion_rate,
            bounce_rate=bounce_rate,
        ),
        top_sources=top_sources,
        recent_events=recent_events,
        range_days=days,
    )