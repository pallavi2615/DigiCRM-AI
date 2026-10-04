"""
Pydantic schemas for Tenant Billing analytics.
"""

from pydantic import BaseModel
from typing import List, Optional


# ============================================================
# KPI CARDS
# ============================================================

class BillingKPI(BaseModel):
    pack_revenue: float          # total ₹ from won leads
    won_count: int               # number of won leads
    lead_revenue: float          # same as pack_revenue (per UI label)
    total_leads: int             # total leads in tenant
    conversion_rate: float       # won / total × 100
    partner_share_pct: float     # e.g., 20.0
    partner_payout: float        # pack_revenue × partner_share_pct / 100


# ============================================================
# REVENUE BY PACK
# ============================================================

class PackRevenueRow(BaseModel):
    pack: str
    revenue: float


class RevenueByPackResponse(BaseModel):
    data: List[PackRevenueRow]
    total_revenue: float


# ============================================================
# PAYMENTS
# ============================================================

class PaymentsSummary(BaseModel):
    collected: float
    outstanding: float
    payments: List[dict] = []


# ============================================================
# PACK BREAKDOWN TABLE
# ============================================================

class PackBreakdownRow(BaseModel):
    pack: str
    won: int
    open: int
    revenue: float
    payout: float                # revenue × partner_share_pct / 100


class PackBreakdownResponse(BaseModel):
    data: List[PackBreakdownRow]
    partner_share_pct: float


# ============================================================
# FULL PAGE RESPONSE
# ============================================================

class TenantBillingResponse(BaseModel):
    kpi: BillingKPI
    revenue_by_pack: List[PackRevenueRow]
    payments: PaymentsSummary
    pack_breakdown: List[PackBreakdownRow]