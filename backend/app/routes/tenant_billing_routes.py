"""
Tenant Billing analytics.

Returns revenue, conversions, and partner payouts for the
current tenant's workspace ONLY.

No new DB tables — all aggregates come from the existing `leads` table.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from typing import Optional

from app.db.database import get_db
from app.core.permissions import require_role
from app.core.constants import (
    SUPER_ADMIN_ROLE as SA_CONST,
    ADMIN_ROLE,
    MANAGER_ROLE,
)
from app.models.user import User
from app.models.lead import Lead
from app.schemas.tenant_billing import (
    TenantBillingResponse,
    BillingKPI,
    PackRevenueRow,
    PaymentsSummary,
    PackBreakdownRow,
)

router = APIRouter(prefix="/tenant-billing", tags=["Tenant Billing"])

SUPER_ADMIN_ROLE = "super_admin"

# Partner share percentage (e.g., 20%)
PARTNER_SHARE_PCT = 20.0


# ============================================================
# HELPERS
# ============================================================

def _tenant_scope(db: Session, user: User, tenant_id: Optional[int]):
    """
    Returns the effective tenant_id for the query.
    - SuperAdmin: uses provided tenant_id (or their own if not given).
    - Others: their own tenant_id.
    """
    if user.role == SA_CONST and tenant_id:
        return tenant_id
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")
    return user.tenant_id


# ============================================================
# FULL BILLING PAGE
# ============================================================

@router.get("", response_model=TenantBillingResponse)
def get_tenant_billing(
    tenant_id: Optional[int] = Query(None, description="SuperAdmin only"),
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE, MANAGER_ROLE)),
    db: Session = Depends(get_db),
):
    """
    Return billing analytics for the current tenant:
        - 4 KPI cards
        - Revenue by pack (bar chart)
        - Payments summary
        - Pack breakdown table
    """
    tid = _tenant_scope(db, user, tenant_id)

    # ── Base leads query (scoped to tenant) ──
    leads_q = db.query(Lead).filter(Lead.tenant_id == tid)

    # ── KPI: total leads / won / revenue ──
    total_leads = leads_q.count()

    won_q = leads_q.filter(Lead.status == "won")
    won_count = won_q.count()

    pack_revenue = (
        won_q
        .with_entities(func.coalesce(func.sum(Lead.estimated_value), 0))
        .scalar()
        or 0
    )
    pack_revenue = float(pack_revenue)

    conversion_rate = (
        round((won_count / total_leads * 100), 2) if total_leads > 0 else 0.0
    )

    partner_payout = round(pack_revenue * PARTNER_SHARE_PCT / 100, 2)

    kpi = BillingKPI(
        pack_revenue=pack_revenue,
        won_count=won_count,
        lead_revenue=pack_revenue,
        total_leads=total_leads,
        conversion_rate=conversion_rate,
        partner_share_pct=PARTNER_SHARE_PCT,
        partner_payout=partner_payout,
    )

    # ── Revenue by pack (group by industry_group, only won) ──
    pack_rows = (
        won_q
        .with_entities(
            Lead.industry_group.label("pack"),
            func.coalesce(func.sum(Lead.estimated_value), 0).label("revenue"),
        )
        .group_by(Lead.industry_group)
        .order_by(func.sum(Lead.estimated_value).desc())
        .all()
    )

    revenue_by_pack = [
        PackRevenueRow(
            pack=(r.pack or "uncategorized"),
            revenue=float(r.revenue or 0),
        )
        for r in pack_rows
    ]

    # ── Payments (placeholder — no payments table yet) ──
    payments = PaymentsSummary(
        collected=0.0,
        outstanding=0.0,
        payments=[],
    )

    # ── Pack breakdown table ──
    # Group by industry_group across all statuses
    all_rows = (
        leads_q
        .with_entities(
            Lead.industry_group.label("pack"),
            func.count(Lead.id).label("total"),
            func.sum(case((Lead.status == "won", 1), else_=0)).label("won"),
            func.sum(case((Lead.status == "open", 1), else_=0)).label("open"),
            func.sum(
                case(
                    (
                        (Lead.status == "won"),
                        func.coalesce(Lead.estimated_value, 0),
                    ),
                    else_=0,
                )
            ).label("revenue"),
        )
        .group_by(Lead.industry_group)
        .all()
    )

    pack_breakdown = []
    for r in all_rows:
        rev = float(r.revenue or 0)
        pack_breakdown.append(PackBreakdownRow(
            pack=(r.pack or "uncategorized"),
            won=int(r.won or 0),
            open=int(r.open or 0),
            revenue=rev,
            payout=round(rev * PARTNER_SHARE_PCT / 100, 2),
        ))

    pack_breakdown.sort(key=lambda x: x.revenue, reverse=True)

    return TenantBillingResponse(
        kpi=kpi,
        revenue_by_pack=revenue_by_pack,
        payments=payments,
        pack_breakdown=pack_breakdown,
    )