"""
Pydantic schemas for Landing Analytics.
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime


# ============================================================
# PUBLIC — TRACKING PAYLOAD
# ============================================================

class LandingEventTrack(BaseModel):
    """Payload sent by the landing page JS beacon."""
    slug: str = Field(..., min_length=1, max_length=100)
    event_type: str = Field(..., pattern="^(view|submit|bounce)$")
    session_id: str = Field(..., min_length=1, max_length=100)
    source: Optional[str] = None
    page_url: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    form_data: Optional[Dict[str, Any]] = None
    extra_data: Optional[Dict[str, Any]] = None


class LandingEventTrackResponse(BaseModel):
    success: bool
    event_id: int
    message: str


# ============================================================
# AUTH — ANALYTICS RESPONSE
# ============================================================

class LandingKPI(BaseModel):
    sessions: int
    views: int
    submits: int
    conversion_rate: float
    bounce_rate: float


class SourceRow(BaseModel):
    source: str
    sessions: int
    percentage: float


class RecentEventRow(BaseModel):
    id: int
    event_type: str
    landing_slug: str
    source: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class LandingAnalyticsResponse(BaseModel):
    kpi: LandingKPI
    top_sources: List[SourceRow]
    recent_events: List[RecentEventRow]
    range_days: int