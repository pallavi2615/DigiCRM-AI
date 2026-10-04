from sqlalchemy import (
    Column, Integer, String, Text, DateTime,
    Numeric, ForeignKey, JSON
)
from sqlalchemy.dialects.postgresql import UUID   
from sqlalchemy.sql import func
import uuid                                        

from app.db.database import Base


class Company(Base):
    """
    B2B company record.

    Represents an organization that may be associated with
    one or more contacts or leads within a tenant.
    """
    __tablename__ = "companies"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(
        Integer,
        ForeignKey("tenants.id", ondelete="CASCADE"),
        index=True,
    )

    # ⭐ NEW — external unique identifier
    uuid = Column(
        UUID(as_uuid=True),
        unique=True,
        nullable=False,
        default=uuid.uuid4,
        index=True,
    )

    name = Column(String(255), nullable=False, index=True)
    industry = Column(String(100), index=True)
    location = Column(String(200))
    employees = Column(Integer, default=0)
    revenue = Column(Numeric(14, 2), default=0)
    website = Column(String(500))
    phone = Column(String(20))
    email = Column(String(255))       # ← note: no unique=True (multi-tenant)
    notes = Column(Text)
    logo_url = Column(String(500))
    owner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    tags = Column(JSON, default=[])
    status = Column(String(20), default="active")
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
    )