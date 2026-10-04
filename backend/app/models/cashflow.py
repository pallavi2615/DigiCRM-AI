"""
Cashflow / Receivables model.

Tracks money owed to the tenant (student fees, franchise royalties,
rent, invoices, etc.)
"""

from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date, Numeric,
    ForeignKey, Index, Boolean,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func
import uuid

from app.db.database import Base


# Type of receivable
CASHFLOW_TYPES = [
    "student_fee",
    "franchise_royalty",
    "rent",
    "invoice",
    "subscription",
    "other",
]

# Status
CASHFLOW_STATUSES = [
    "pending",
    "partial",
    "paid",
    "overdue",
    "cancelled",
]


class CashflowEntry(Base):
    __tablename__ = "cashflow_entries"

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

    # ── What ──
    type = Column(String(50), nullable=False, default="other", index=True)
    item = Column(String(255), nullable=False)          # e.g. "WT4 Term 2"
    description = Column(Text, nullable=True)

    # ── Who ──
    party_name = Column(String(255), nullable=False)    # e.g. "WT2 Test Public School"
    party_email = Column(String(255), nullable=True)
    party_phone = Column(String(50), nullable=True)
    party_id = Column(Integer, nullable=True)           # optional FK to contact/company

    # ── Money ──
    amount = Column(Numeric(14, 2), nullable=False, default=0)      # Total
    paid_amount = Column(Numeric(14, 2), default=0)                 # Paid so far
    currency = Column(String(10), default="INR")

    # ── Timeline ──
    due_date = Column(Date, nullable=True, index=True)
    paid_at = Column(DateTime, nullable=True)

    # ── Status ──
    status = Column(String(50), default="pending", index=True)

    # ── Meta ──
    notes = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_cashflow_tenant_status", "tenant_id", "status"),
        Index("ix_cashflow_tenant_due", "tenant_id", "due_date"),
    )

    def __repr__(self) -> str:
        return f"<Cashflow {self.type} {self.party_name}: ₹{self.amount}>"