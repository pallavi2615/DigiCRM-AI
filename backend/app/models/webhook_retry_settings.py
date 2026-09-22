from sqlalchemy import Column, Integer, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func
from app.db.database import Base


class WebhookRetrySettings(Base):
    __tablename__ = "webhook_retry_settings"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), unique=True, index=True)
    max_attempts = Column(Integer, default=5)
    base_delay_minutes = Column(Integer, default=1)
    backoff_factor = Column(Integer, default=3)
    enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())