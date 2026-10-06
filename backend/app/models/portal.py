"""
DigiPortal models — client/partner portal for industry packs.
"""

import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Text, Boolean, Numeric,
    DateTime, ForeignKey, Index
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.sql import func

from app.db.database import Base


class PackRecord(Base):
    """A deal/application in a client's portal."""
    __tablename__ = "pack_records"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    group_slug = Column(String(100), nullable=False, index=True)
    pack_slug = Column(String(100), nullable=False, index=True)
    title = Column(String(255), nullable=False)
    stage = Column(String(50), default="new", index=True)
    value = Column(Numeric(14, 2), default=0)
    contact_name = Column(String(255))
    contact_email = Column(String(255), index=True)
    city = Column(String(100))
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), index=True)
    won = Column(Boolean, default=False, index=True)
    deleted_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    __table_args__ = (
        Index("ix_pack_records_owner_email", "owner_id", "contact_email"),
    )


class PackDocument(Base):
    """Document attached to a pack record."""
    __tablename__ = "pack_documents"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(UUID(as_uuid=True), ForeignKey("pack_records.id", ondelete="CASCADE"), index=True)
    name = Column(String(255), nullable=False)
    doc_type = Column(String(50), default="other")
    status = Column(String(50), default="uploaded", index=True)
    storage_path = Column(String(500))
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, server_default=func.now())


class PackPayment(Base):
    """Payment charge/transaction for a pack record."""
    __tablename__ = "pack_payments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(UUID(as_uuid=True), ForeignKey("pack_records.id", ondelete="CASCADE"), index=True)
    kind = Column(String(50), default="pack_fee")
    label = Column(String(255), nullable=False)
    amount = Column(Numeric(14, 2), nullable=False, default=0)
    currency = Column(String(10), default="INR")
    status = Column(String(50), default="pending", index=True)
    due_date = Column(DateTime, nullable=True)
    paid_at = Column(DateTime, nullable=True)
    reference = Column(String(255))
    method = Column(String(50))
    decision_note = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class Verification(Base):
    """DigiVerify check for a pack record."""
    __tablename__ = "verifications"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    record_id = Column(UUID(as_uuid=True), ForeignKey("pack_records.id", ondelete="CASCADE"), index=True)
    kind = Column(String(50), nullable=False)
    status = Column(String(50), default="pending", index=True)
    provider = Column(String(100))
    score = Column(Integer, nullable=True)
    identifier_masked = Column(String(255))
    subject_name = Column(String(255))
    error = Column(Text)
    created_at = Column(DateTime, server_default=func.now())