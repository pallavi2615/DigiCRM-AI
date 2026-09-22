from sqlalchemy import (
    Column, Integer, String, Text, DateTime,
    ForeignKey, JSON
)
from sqlalchemy.sql import func

from app.db.database import Base


class Contact(Base):
    """
    Individual contact record.

    Represents a person associated with a company — typically
    a decision maker, executive, or stakeholder within a
    tenant's B2B network.
    """
    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
    )
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100))
    designation = Column(String(150))
    email = Column(String(255), index=True)
    phone = Column(String(30))
    company_id = Column(
        Integer,
        ForeignKey("companies.id", ondelete="SET NULL"),
        index=True,
    )
    notes = Column(Text)
    linkedin_url = Column(String(500))
    avatar_url = Column(String(500))
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    tags = Column(JSON, default=[])
    status = Column(String(20), default="active")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )