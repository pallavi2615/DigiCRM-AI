"""
Audit log model — immutable full change history across the workspace.

Design notes:
    - Rows are never updated or deleted.
    - `row_id` is a UUID string (matches UI "Row ID (uuid)").
    - `changes` stores JSON: { field: {"before": X, "after": Y} }.
    - `description` is a human-readable summary.
"""

from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    ForeignKey,
    Index,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.db.database import Base   # <-- Adjust path if your Base is elsewhere


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)

    # Tenant scoping
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # Who performed the action
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    user_name = Column(String(255), nullable=True)  # denormalized

    # What was changed
    table_name = Column(String(100), nullable=False, index=True)
    row_id = Column(UUID(as_uuid=True), nullable=False, index=True)
    action = Column(String(20), nullable=False, index=True)  # created | updated | deleted

    # Human summary + full diff
    description = Column(Text, nullable=True)
    changes = Column(JSONB, nullable=True)

    # Context
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)

    # When
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    # Relationship
    user = relationship("User", foreign_keys=[user_id], lazy="joined")

    __table_args__ = (
        Index("ix_audit_tenant_created", "tenant_id", "created_at"),
        Index("ix_audit_tenant_table", "tenant_id", "table_name"),
        Index("ix_audit_tenant_action", "tenant_id", "action"),
        Index("ix_audit_row", "table_name", "row_id"),
    )

    def __repr__(self) -> str:
        return f"<AuditLog {self.action} {self.table_name}#{self.row_id}>"