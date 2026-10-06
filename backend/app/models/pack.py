"""Industry pack configurations — global and tenant-specific overrides."""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Boolean, DateTime,
    ForeignKey, JSON, Index, Text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.database import Base


class PackConfig(Base):
    """
    Industry pack configuration.
    - Global row: tenant_id = NULL
    - Tenant override: tenant_id = <tenant>
    """
    __tablename__ = "pack_configs"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), nullable=True, index=True)

    # Pack identity
    group_slug = Column(String(100), nullable=False, index=True)
    pack_slug = Column(String(100), nullable=False, index=True)

    # Labels
    name = Column(String(255), nullable=True)
    tagline = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    gradient = Column(String(255), nullable=True)

    # Record terminology
    record_label = Column(String(100), nullable=True)
    record_label_plural = Column(String(100), nullable=True)
    party_label = Column(String(100), nullable=True)
    value_label = Column(String(100), nullable=True)

    # Stages (JSON arrays)
    stages = Column(JSON, nullable=True)
    won_stages = Column(JSON, nullable=True)
    lost_stages = Column(JSON, nullable=True)

    # Custom fields (JSON)
    fields = Column(JSON, nullable=True)
    kpi_labels = Column(JSON, nullable=True)
    verifications = Column(JSON, nullable=True)

    # AI agents (JSON array of prompts)
    agents = Column(JSON, nullable=True)

    # Meta
    is_custom = Column(Boolean, default=False, index=True)
    archived_at = Column(DateTime, nullable=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pack_configs_key", "group_slug", "pack_slug"),
    )