from sqlalchemy import Column, Integer, String, JSON, DateTime, ForeignKey, Text
from sqlalchemy.sql import func

from app.db.database import Base


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"))
    action = Column(String(100), nullable=False)
    entity = Column(String(100))
    entity_id = Column(Integer)
    changes = Column(JSON)
    ip_address = Column(String(50))
    user_agent = Column(Text)
    tenant_id = Column(Integer)
    created_at = Column(DateTime, server_default=func.now(), index=True)