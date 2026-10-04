"""
Role Change History — audit trail for role changes.

Whenever an admin changes another user's role, we log it here.
Frontend shows this in Settings → Role Change History section.
"""

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, ForeignKey, Index,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.database import Base


class RoleChangeHistory(Base):
    __tablename__ = "role_change_history"

    id = Column(Integer, primary_key=True, index=True)

    # ⭐ External identifier
    uuid = Column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid.uuid4,
        index=True,
    )

    # ── Tenant scoping ──
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    # ── Who was changed ──
    user_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    user_name = Column(String(255), nullable=True)
    user_email = Column(String(255), nullable=True)

    # ── Who did it ──
    actor_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    actor_name = Column(String(255), nullable=True)
    actor_email = Column(String(255), nullable=True)

    # ── What changed ──
    old_role = Column(String(50), nullable=False)
    new_role = Column(String(50), nullable=False)

    notes = Column(Text, nullable=True)

    created_at = Column(
        DateTime,
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    __table_args__ = (
        Index("ix_role_change_tenant_created", "tenant_id", "created_at"),
        Index("ix_role_change_user", "user_id", "created_at"),
    )

    def __repr__(self) -> str:
        return f"<RoleChange {self.user_name}: {self.old_role} → {self.new_role}>"