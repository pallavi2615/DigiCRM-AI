"""
IT Services — Ticket model.

Represents IT-specific tickets (bugs, features, tasks) that belong
to a project. Distinct from the generic `tickets` table (which is
for customer support).
"""

from sqlalchemy import (
    Column, Integer, String, Text, Date, DateTime,
    ForeignKey, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.database import Base


# Enums (kept as strings for simplicity)
IT_TICKET_TYPES = ["bug", "feature", "task"]
IT_TICKET_PRIORITIES = ["urgent", "high", "medium", "low"]
IT_TICKET_STATUSES = ["open", "in_progress", "blocked", "resolved", "closed"]


class ITTicket(Base):
    __tablename__ = "it_tickets"

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

    # ── Link to project ──
    project_id = Column(
        Integer,
        ForeignKey("it_projects.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # ── Core fields ──
    title = Column(String(500), nullable=False, index=True)
    description = Column(Text, nullable=True)

    type = Column(String(30), nullable=False, default="task", index=True)
    priority = Column(String(20), nullable=False, default="medium", index=True)
    status = Column(String(30), nullable=False, default="open", index=True)

    # ── Timeline ──
    due_date = Column(Date, nullable=True, index=True)
    resolved_at = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)

    # ── People ──
    assignee_id = Column(
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

    # ── Meta ──
    tags = Column(String(500), nullable=True)          # comma-separated

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
    project = relationship("ITProject", back_populates="tickets")

    __table_args__ = (
        Index("ix_it_ticket_tenant_status", "tenant_id", "status"),
        Index("ix_it_ticket_project", "project_id", "status"),
        Index("ix_it_ticket_tenant_created", "tenant_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<ITTicket {self.title} status={self.status}>"