"""Lead Sources models — channels, campaigns, conversions."""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Numeric, Boolean, DateTime,
    ForeignKey, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.database import Base


class LeadChannel(Base):
    __tablename__ = "lead_channels"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    slug = Column(String(255), nullable=False, index=True)
    kind = Column(String(50), nullable=False, default="manual")
    default_group_slug = Column(String(100), nullable=True)
    default_pack_slug = Column(String(100), nullable=True)
    monthly_cost = Column(Numeric(14, 2), default=0)
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class LeadCampaign(Base):
    __tablename__ = "lead_campaigns"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(255), nullable=False)
    channel_id = Column(UUID(as_uuid=True), ForeignKey("lead_channels.id", ondelete="SET NULL"), index=True)
    budget = Column(Numeric(14, 2), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class LeadConversion(Base):
    __tablename__ = "lead_conversions"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    channel_id = Column(UUID(as_uuid=True), ForeignKey("lead_channels.id", ondelete="SET NULL"), index=True)
    campaign_id = Column(UUID(as_uuid=True), ForeignKey("lead_campaigns.id", ondelete="SET NULL"), index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), nullable=True, index=True)
    industry_group = Column(String(100), nullable=True, index=True)
    stage = Column(String(50), default="new")
    status = Column(String(50), default="new", index=True)
    revenue = Column(Numeric(14, 2), default=0)
    occurred_at = Column(DateTime, server_default=func.now(), index=True)
    created_at = Column(DateTime, server_default=func.now())


class Affiliate(Base):
    __tablename__ = "affiliates"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    email = Column(String(255), nullable=False, index=True)
    company = Column(String(255), nullable=True)
    audience = Column(String(255), nullable=True)
    status = Column(String(50), default="pending", index=True)
    commission_pct = Column(Numeric(5, 2), default=10)
    referral_code = Column(String(50), nullable=True, index=True)
    notes = Column(String(1000), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)

class AffiliatePayoutRequest(Base):
    __tablename__ = "affiliate_payout_requests"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    affiliate_id = Column(UUID(as_uuid=True), ForeignKey("affiliates.id", ondelete="CASCADE"), index=True)
    referral_code = Column(String(50), nullable=True, index=True)
    amount = Column(Numeric(14, 2), nullable=False, default=0)
    status = Column(String(50), default="requested", index=True)
    method = Column(String(50), default="bank_transfer")
    reference = Column(String(255), nullable=True)
    notes = Column(String(1000), nullable=True)
    decision_reason = Column(String(1000), nullable=True)
    processed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    processed_at = Column(DateTime, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AffiliateSettings(Base):
    __tablename__ = "affiliate_settings"

    id = Column(String(50), primary_key=True, default="default")
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)
    default_commission_pct = Column(Numeric(5, 2), default=20)
    cookie_days = Column(Integer, default=60)
    payout_terms = Column(String(2000), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())