from sqlalchemy import (
    Column, Integer, String, Text, DateTime,
    Numeric, Boolean, ForeignKey, JSON
)
from sqlalchemy.sql import func

from app.db.database import Base


class ProposalTemplate(Base):
    __tablename__ = "proposal_templates"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    category = Column(String(100), index=True)
    owner_label = Column(String(200))
    amount = Column(Numeric(12, 2), default=0)
    currency = Column(String(10), default="INR")
    terms = Column(Text)
    content = Column(JSON, default={})
    shared_with_team = Column(Boolean, default=True)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())