from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date,
    Numeric, ForeignKey
)
from sqlalchemy.sql import func

from app.db.database import Base


class Proposal(Base):
    __tablename__ = "proposals"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), index=True)

    title = Column(String(255), nullable=False)
    description = Column(Text)
    amount = Column(Numeric(12, 2), default=0)
    currency = Column(String(10), default="INR")
    status = Column(String(50), default="draft", index=True)
    valid_until = Column(Date)
    terms = Column(Text)
    public_token = Column(String(255), unique=True, index=True)

    # New fields
    probability = Column(Integer, default=0)
    close_date = Column(Date)
    owner = Column(String(200))
    version = Column(String(20), default="v1")
    approval_status = Column(String(50), default="pending", index=True)
    pipeline_stage = Column(String(50), default="in_pipeline", index=True)
    lead_name = Column(String(200))
    template_id = Column(Integer)

    sent_at = Column(DateTime)
    viewed_at = Column(DateTime)
    accepted_at = Column(DateTime)
    declined_at = Column(DateTime)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, server_default=func.now(), index=True)
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    contact_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"))
    contact_name = Column(String(200))
    contact_email = Column(String(255))
    company_name = Column(String(200))
    notes = Column(Text)
    document_content = Column(Text)