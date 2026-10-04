"""
Pydantic schemas for the Reports API.
Matches the Reports & Analytics UI.
"""

from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime


# ============================================================
# 1. SUMMARY — top KPI cards
# ============================================================

class ReportSummary(BaseModel):
    total_leads: int
    won_deals: int
    total_revenue: float
    avg_deal_size: float
    conversion_rate: float


# ============================================================
# 2. REVENUE TREND — dual line chart (leads + revenue per month)
# ============================================================

class RevenueTrendPoint(BaseModel):
    label: str          # "Oct", "Nov", ...
    year: int
    month: int
    leads: int          # count of leads created that month
    revenue: float      # sum of estimated_value of WON leads that month


class RevenueTrendReport(BaseModel):
    data: List[RevenueTrendPoint]
    months: int
    total_leads: int
    total_revenue: float


# ============================================================
# 3. LEAD SOURCES — pie chart
# ============================================================

class LeadSourcePoint(BaseModel):
    source: str
    count: int
    percentage: float


class LeadSourcesReport(BaseModel):
    data: List[LeadSourcePoint]
    total: int


# ============================================================
# 4. PRIORITY DISTRIBUTION — horizontal bar chart
# ============================================================

class PriorityPoint(BaseModel):
    priority: str       # low | medium | high | urgent
    count: int


class PriorityDistributionReport(BaseModel):
    data: List[PriorityPoint]
    total: int


# ============================================================
# 5. TOP INDUSTRIES — pie chart
# ============================================================

class IndustryPoint(BaseModel):
    industry: str
    count: int


class TopIndustriesReport(BaseModel):
    data: List[IndustryPoint]
    total: int


# ============================================================
# 6. SALES PERFORMANCE (kept for future use)
# ============================================================

class SalesPerformerRow(BaseModel):
    user_id: int
    user_name: str
    won_deals: int
    lost_deals: int
    open_deals: int
    total_revenue: float
    conversion_rate: float


class SalesPerformanceReport(BaseModel):
    data: List[SalesPerformerRow]
    total_revenue: float
    total_won: int


# ============================================================
# 7. ACTIVITY (kept for future use)
# ============================================================

class ActivityRow(BaseModel):
    user_id: int
    user_name: str
    tasks_created: int
    tasks_completed: int
    meetings_held: int
    tickets_handled: int
    total_activities: int


class ActivityReport(BaseModel):
    data: List[ActivityRow]
    total_activities: int