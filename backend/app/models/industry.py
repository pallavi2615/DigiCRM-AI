"""
Industry models.

Two entities:
    1. Industry         — Platform catalog
    2. TenantIndustry   — Active subscription (tenant has access)
"""

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean,
    ForeignKey, Numeric, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.database import Base


class Industry(Base):
    __tablename__ = "industries"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(50), unique=True, nullable=False, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text)
    icon = Column(String(100))
    price = Column(Numeric(10, 2), default=0)
    currency = Column(String(10), default="INR")
    is_active = Column(Boolean, default=True, index=True)
    is_public = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)

    status = Column(String(20), default="available", index=True)
    # values: available | coming_soon | deprecated
    category = Column(String(50), index=True)
    # values: financial_services | property | commerce | mobility | healthcare |
    #         education | industrial | professional_services | creators | distribution

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    tenant_industries = relationship(
        "TenantIndustry",
        back_populates="industry",
        cascade="all, delete-orphan",
    )


class TenantIndustry(Base):
    __tablename__ = "tenant_industries"

    id = Column(Integer, primary_key=True, index=True)
    uuid = Column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid.uuid4,
        index=True,
    )
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    industry_id = Column(
        Integer,
        ForeignKey("industries.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    granted_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    status = Column(String(30), default="active", index=True)
    granted_at = Column(DateTime, server_default=func.now())
    expires_at = Column(DateTime, nullable=True)
    revoked_at = Column(DateTime, nullable=True)
    notes = Column(Text)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    industry = relationship("Industry", back_populates="tenant_industries")

    __table_args__ = (
        Index("ix_tenant_industry_unique", "tenant_id", "industry_id", unique=True),
    )