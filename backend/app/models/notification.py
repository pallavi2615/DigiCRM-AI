"""
Notification model — personal inbox per user.

Notes:
    - Notifications are ALWAYS scoped to a single user.
    - They are NOT scoped by tenant in the API (they're private to the user).
    - `tenant_id` is stored for reporting/cleanup but is not exposed in list.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    Text,
    DateTime,
    Boolean,
    ForeignKey,
    JSON,
    Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import uuid

from app.db.database import Base


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)

    # ⭐ External identifier (matches UI, useful for deep-linking)
    uuid = Column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid.uuid4,
        index=True,
    )

    # ── Recipient ──
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=True,
        index=True,
    )

    # ── Content ──
    type = Column(String(50), nullable=False, index=True)
    # followup_overdue | invoice_overdue | task_due | lead_assigned
    # proposal_accepted | proposal_declined | sla_breach | system

    title = Column(String(255), nullable=False)
    message = Column(Text, nullable=True)

    # ── State ──
    is_read = Column(Boolean, default=False, nullable=False, index=True)
    read_at = Column(DateTime, nullable=True)

    # ── Deep-link data ──
    entity_type = Column(String(50), nullable=True)     # "lead", "invoice", "ticket"
    entity_id = Column(Integer, nullable=True)
    action_url = Column(String(500), nullable=True)     # e.g., "/leads/42"
    extra_data = Column(JSON, default=dict)

    # ── Timestamps ──
    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    user = relationship("User", foreign_keys=[user_id], lazy="joined")

    __table_args__ = (
        Index("ix_notif_user_read", "user_id", "is_read"),
        Index("ix_notif_user_created", "user_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<Notification {self.type} user={self.user_id} read={self.is_read}>"