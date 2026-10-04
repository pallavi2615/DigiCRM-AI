"""Payment & Ledger models."""

from sqlalchemy import (
    Column, Integer, String, Numeric, DateTime, Date,
    ForeignKey, Text, CheckConstraint, Index,
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from app.db.database import Base


class BankAccount(Base):
    __tablename__ = "bank_accounts"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    account_number = Column(String(100))
    ifsc = Column(String(20))
    opening_balance = Column(Numeric(14, 2), default=0)
    is_active = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    entries = relationship("PaymentEntry", back_populates="bank_account")


class PaymentEntry(Base):
    __tablename__ = "payment_entries"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=False, index=True)
    bank_account_id = Column(Integer, ForeignKey("bank_accounts.id"), nullable=True)

    direction = Column(String(3), nullable=False)          # 'in' | 'out'
    category = Column(String(50), nullable=False)          # service, retainer, royalty, salary, gym, salon
    party = Column(String(255), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False, default=0)

    utr = Column(String(100))
    memo = Column(Text)
    entry_date = Column(Date, nullable=False, server_default=func.current_date())

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    bank_account = relationship("BankAccount", back_populates="entries")

    __table_args__ = (
        CheckConstraint("direction IN ('in', 'out')", name="ck_payment_direction"),
        Index("ix_payment_entries_tenant_date", "tenant_id", "entry_date"),
    )