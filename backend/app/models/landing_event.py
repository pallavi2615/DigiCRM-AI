"""
Landing page event model.

Tracks views, submissions, and bounces on tenant landing pages.

Written by a PUBLIC tracking endpoint (no auth).
Read by an AUTHENTICATED analytics endpoint.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    JSON,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.db.database import Base


class LandingEvent(Base):
    __tablename__ = "landing_events"

    id = Column(Integer, primary_key=True, index=True)

    uuid = Column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid.uuid4,
        index=True,
    )

    # ── Scoping ──
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    landing_slug = Column(String(100), nullable=False, index=True)

    # ── Event ──
    event_type = Column(String(30), nullable=False, index=True)
    # view | submit | bounce
    session_id = Column(String(100), nullable=False, index=True)

    # ── Context ──
    source = Column(String(200), nullable=True, index=True)
    page_url = Column(String(1000), nullable=True)
    user_agent = Column(String(500), nullable=True)
    ip_address = Column(String(45), nullable=True)
    country = Column(String(100), nullable=True)
    city = Column(String(100), nullable=True)

    # ── Extras ──
    form_data = Column(JSON, default=dict)
    extra_data = Column(JSON, default=dict)

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    tenant = relationship("Tenant", foreign_keys=[tenant_id])

    __table_args__ = (
        Index("ix_landing_tenant_type", "tenant_id", "event_type"),
        Index("ix_landing_tenant_created", "tenant_id", "created_at"),
        Index("ix_landing_slug_created", "landing_slug", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<LandingEvent {self.event_type} slug={self.landing_slug}>"