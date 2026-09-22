from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date,
    Boolean, ForeignKey
)
from sqlalchemy.sql import func
from app.db.database import Base


class FollowupSequence(Base):
    __tablename__ = "followup_sequences"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    total_steps = Column(Integer, default=0)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class FollowupSequenceStep(Base):
    __tablename__ = "followup_sequence_steps"

    id = Column(Integer, primary_key=True, index=True)
    sequence_id = Column(Integer, ForeignKey("followup_sequences.id", ondelete="CASCADE"), index=True)
    step_order = Column(Integer, nullable=False)
    delay_days = Column(Integer, default=0)
    action_type = Column(String(50), nullable=False)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    template = Column(Text)
    created_at = Column(DateTime, server_default=func.now())


class FollowupTask(Base):
    __tablename__ = "followup_tasks"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    sequence_id = Column(Integer, ForeignKey("followup_sequences.id", ondelete="SET NULL"))
    step_id = Column(Integer, ForeignKey("followup_sequence_steps.id", ondelete="SET NULL"))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    action_type = Column(String(50))
    status = Column(String(50), default="pending", index=True)
    priority = Column(String(20), default="medium")
    due_date = Column(Date, index=True)
    completed_at = Column(DateTime)
    completed_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    notes = Column(Text)
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class LeadResponse(Base):
    __tablename__ = "lead_responses"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"))
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="CASCADE"), index=True)
    response_type = Column(String(50))
    response_text = Column(Text)
    responded_at = Column(DateTime, server_default=func.now())
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))