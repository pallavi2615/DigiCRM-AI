from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date,
    ForeignKey, JSON, Numeric
)
from sqlalchemy.sql import func

from app.db.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)

    # Basic
    name = Column(String(200))
    email = Column(String(255), unique=True, nullable=False)
    phone = Column(String(20), index=True)
    # company = Column(String(200))
    company_name = Column(String(255))                # ⭐ NEW
    designation = Column(String(150))                  # ⭐ NEW
    website = Column(String(500))                      # ⭐ NEW
    industry = Column(String(100))                     # ⭐ NEW
    country = Column(String(100))                      # ⭐ NEW
    city = Column(String(100))                         # ⭐ NEW
    message = Column(Text)
    contact_person = Column(String(255))

    # Classification
    source = Column(String(100), default="webhook")
    status = Column(String(50), default="new", index=True)
    priority = Column(String(20), default="medium", index=True)
    industry_group = Column(String(50))                # ⭐ NEW

    # Values
    # value = Column(Numeric(12, 2), default=0)
    estimated_value = Column(Numeric(14, 2), default=0)      # ⭐ NEW
    expected_close_date = Column(Date)                        # ⭐ NEW

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
    