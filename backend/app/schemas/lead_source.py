"""Pydantic schemas for Lead Sources + Affiliates."""
from uuid import UUID
from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


# ═══════════ CHANNELS ═══════════
class LeadChannelCreate(BaseModel):
    name: str
    slug: Optional[str] = None
    kind: str = "manual"
    default_group_slug: Optional[str] = None
    default_pack_slug: Optional[str] = None
    monthly_cost: float = 0
    is_active: bool = True


class LeadChannelResponse(BaseModel):
    id: UUID                          # 👈 str → UUID
    name: str
    slug: str
    kind: str
    default_group_slug: Optional[str] = None
    default_pack_slug: Optional[str] = None
    monthly_cost: Optional[float] = 0
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ═══════════ CAMPAIGNS ═══════════
class LeadCampaignCreate(BaseModel):
    name: str
    code: Optional[str] = None
    channel_id: Optional[UUID] = None     # 👈 UUID
    budget: float = 0
    is_active: bool = True


class LeadCampaignResponse(BaseModel):
    id: UUID                              # 👈 UUID
    name: str
    code: str
    channel_id: Optional[UUID] = None     # 👈 UUID
    budget: Optional[float] = 0
    is_active: bool
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ═══════════ CONVERSIONS ═══════════
class LeadConversionResponse(BaseModel):
    id: UUID                              # 👈 UUID
    channel_id: Optional[UUID] = None     # 👈 UUID
    campaign_id: Optional[UUID] = None    # 👈 UUID
    industry_group: Optional[str] = None
    stage: str
    status: str
    revenue: float
    occurred_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ═══════════ AFFILIATES ═══════════
class AffiliateResponse(BaseModel):
    id: UUID                              # 👈 UUID
    name: str
    email: str
    company: Optional[str] = None
    audience: Optional[str] = None
    status: str
    commission_pct: float
    referral_code: Optional[str] = None
    notes: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class AffiliateUpdate(BaseModel):
    status: Optional[str] = None
    commission_pct: Optional[float] = None
    referral_code: Optional[str] = None
    notes: Optional[str] = None


class AffiliatePayoutResponse(BaseModel):
    id: UUID
    affiliate_id: UUID
    referral_code: Optional[str] = None
    amount: float
    status: str
    method: Optional[str] = None
    reference: Optional[str] = None
    notes: Optional[str] = None
    decision_reason: Optional[str] = None
    processed_by: Optional[int] = None
    processed_at: Optional[datetime] = None
    approved_at: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
    # Nested display data
    affiliate_name: Optional[str] = None
    affiliate_email: Optional[str] = None
    tenant_name: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AffiliatePayoutUpdate(BaseModel):
    status: Optional[str] = None
    reference: Optional[str] = None
    decision_reason: Optional[str] = None


# ═══════════ AFFILIATE SETTINGS ═══════════
class AffiliateSettingsResponse(BaseModel):
    default_commission_pct: float = 20
    cookie_days: int = 60
    payout_terms: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class AffiliateSettingsUpdate(BaseModel):
    default_commission_pct: Optional[float] = None
    cookie_days: Optional[int] = None
    payout_terms: Optional[str] = None
