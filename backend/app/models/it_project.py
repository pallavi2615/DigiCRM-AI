"""
IT Services — Project model.

Represents a client engagement/project in the IT Services vertical.

Distinct from generic `leads` — these are concrete projects that
have moved past the sales stage and are being delivered.
"""

from sqlalchemy import (
    Column, Integer, String, Text, Date, DateTime, Numeric,
    ForeignKey, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.database import Base


# Project stages (order matters for pipeline)
IT_PROJECT_STAGES = [
    "discovery",
    "proposal",
    "negotiation",
    "contract",
    "kickoff",
    "in_progress",
    "uat",
    "delivered",
    "closed",
]


class ITProject(Base):
    __tablename__ = "it_projects"

    id = Column(Integer, primary_key=True, index=True)

    # ⭐ External identifier
    uuid = Column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid.uuid4,
        index=True,
    )

    # ── Tenant isolation ──
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Core fields ──
    name = Column(String(255), nullable=False, index=True)
    client_name = Column(String(255), nullable=False)
    client_email = Column(String(255), nullable=True, index=True)
    stack = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)

    # ── Pipeline ──
    stage = Column(String(50), nullable=False, default="discovery", index=True)
    value = Column(Numeric(14, 2), default=0)
    currency = Column(String(10), default="INR")

    # ── Timeline ──
    start_date = Column(Date, nullable=True)
    end_date = Column(Date, nullable=True)

    # ── People ──
    owner_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    created_by = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    # ── Optional link to a lead (if project came from a won deal) ──
    lead_id = Column(
        Integer,
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    # ── Meta ──
    tags = Column(String(500), nullable=True)          # comma-separated
    notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )

    # ── Relationships ──
    tickets = relationship(
        "ITTicket",
        back_populates="project",
        cascade="all, delete-orphan",
    )

    __table_args__ = (
        Index("ix_it_project_tenant_stage", "tenant_id", "stage"),
        Index("ix_it_project_tenant_created", "tenant_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<ITProject {self.name} stage={self.stage}>"