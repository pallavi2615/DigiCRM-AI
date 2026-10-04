from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean,
    ForeignKey, JSON
)
from sqlalchemy.sql import func
from app.db.database import Base


class AutomationRuleSetting(Base):
    __tablename__ = "automation_rule_settings"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    rule_key = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    trigger_text = Column(String(255))
    action_text = Column(String(255))
    rule_type = Column(String(50))
    trigger_event = Column(String(100))
    trigger_condition = Column(JSON, default={})
    action_type = Column(String(50))
    action_config = Column(JSON, default={})
    is_active = Column(Boolean, default=True, index=True)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AutomationLog(Base):
    __tablename__ = "automation_logs"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    rule_id = Column(Integer, ForeignKey("automation_rule_settings.id", ondelete="CASCADE"), index=True)
    entity_type = Column(String(50))
    entity_id = Column(Integer)
    action_taken = Column(String(100))
    result = Column(String(50))
    error_message = Column(Text)
    executed_at = Column(DateTime, server_default=func.now())