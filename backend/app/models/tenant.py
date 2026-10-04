from sqlalchemy import Column, Integer, String, JSON, DateTime,  Boolean, ForeignKey
from sqlalchemy.sql import func

from app.db.database import Base


class Tenant(Base):
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    subdomain = Column(String(100), unique=True, index=True)
    webhook_id = Column(String(100), unique=True, index=True)  # ← Naya
    api_key = Column(String(255))  
    branding = Column(JSON, default={})
    settings = Column(JSON, default={})
    status = Column(String(20), default="active")
    industry_template = Column(String(50))
    plan = Column(String(50), default="lite")
    tagline = Column(String(500))
    primary_color = Column(String(20), default="#4F46E5")
    accent_color = Column(String(20), default="#a855f7")
    logo_url = Column(String(500))
    custom_domain = Column(String(255), unique=True, nullable=True, index=True)
    # created_at = Column(DateTime, server_default=func.now())
    # updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

    # ⭐ Auto-followup
    auto_followup_enabled = Column(Boolean, default=False)
    default_followup_sequence_id = Column(
        Integer,
        ForeignKey("followup_sequences.id", ondelete="SET NULL"),
    )
    default_assignee_id = Column(
        Integer,
        ForeignKey("users.id", ondelete="SET NULL"),
    )
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())