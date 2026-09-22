from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Date,
    ForeignKey, JSON
)
from sqlalchemy.sql import func
from app.db.database import Base


class Task(Base):
    __tablename__ = "tasks"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="pending", index=True)
    priority = Column(String(20), default="medium")
    due_date = Column(Date, index=True)
    completed_at = Column(DateTime)
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"), index=True)
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"))
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"))
    deal_id = Column(Integer)
    
    tags = Column(JSON, default=[])
    attachments = Column(JSON, default=[])
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())

class TaskAttachment(Base):
    __tablename__ = "task_attachments"

    id = Column(Integer, primary_key=True, index=True)
    task_id = Column(Integer, ForeignKey("tasks.id", ondelete="CASCADE"), index=True)
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_size = Column(Integer)
    file_type = Column(String(100))
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, server_default=func.now())