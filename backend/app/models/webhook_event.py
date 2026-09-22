from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.db.database import Base


class WebhookEvent(Base):
    __tablename__ = "webhook_events"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    event_id = Column(String(255), unique=True, index=True)
    webhook_id = Column(String(255))
    payload = Column(JSON)
    status = Column(String(50), default="pending", index=True)
    attempts = Column(Integer, default=0)
    max_attempts = Column(Integer, default=5)
    next_retry_at = Column(DateTime, index=True)
    last_error = Column(Text)
    response_status = Column(Integer)
    response_body = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())