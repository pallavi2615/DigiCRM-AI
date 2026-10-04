from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date,
    ForeignKey, JSON, Numeric
)
from sqlalchemy.dialects.postgresql import UUID   # ← ⭐ ADD THIS LINE
from sqlalchemy.sql import func

from app.db.database import Base
import uuid


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)

    uuid = Column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid.uuid4,
        index=True,
    )

    # Basic
    name = Column(String(200))
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(20), index=True)
    company_name = Column(String(255))
    designation = Column(String(150))
    website = Column(String(500))
    industry = Column(String(100))
    country = Column(String(100))
    city = Column(String(100))
    message = Column(Text)
    contact_person = Column(String(255))

    # Classification
    source = Column(String(100), default="webhook")
    status = Column(String(50), default="new", index=True)
    priority = Column(String(20), default="medium", index=True)
    industry_group = Column(String(50))

    # Values
    estimated_value = Column(Numeric(14, 2), default=0)
    expected_close_date = Column(Date)

    # Linking
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"), index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"), index=True)
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))

    followup_sequence_id = Column(
        Integer,
        ForeignKey("followup_sequences.id", ondelete="SET NULL")
    )

    # Meta
    score = Column(Integer, default=0)
    custom_fields = Column(JSON, default={})
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())