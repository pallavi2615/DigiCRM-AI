from sqlalchemy import (
    Column, Integer, String, Text, DateTime, Boolean,
    ForeignKey, JSON
)
from sqlalchemy.sql import func
from app.db.database import Base


class Ticket(Base):
    __tablename__ = "tickets"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    
    subject = Column(String(500), nullable=False)
    description = Column(Text)
    ticket_number = Column(String(50), unique=True, index=True)
    
    requester_name = Column(String(255))
    requester_email = Column(String(255))
    requester_phone = Column(String(20))
    requester_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"))
    
    status = Column(String(50), default="open", index=True)
    priority = Column(String(20), default="medium", index=True)
    urgency = Column(String(20), default="medium")
    category = Column(String(100))
    
    assigned_to = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    
    sla_due_at = Column(DateTime)
    sla_breached = Column(Boolean, default=False, index=True)
    first_response_at = Column(DateTime)
    resolved_at = Column(DateTime)
    closed_at = Column(DateTime)
    
    tags = Column(JSON, default=[])
    custom_fields = Column(JSON, default={})
    
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())


class TicketMessage(Base):
    __tablename__ = "ticket_messages"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    sender_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    sender_type = Column(String(20), default="agent")
    sender_name = Column(String(255))
    sender_email = Column(String(255))
    message = Column(Text, nullable=False)
    is_internal = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())


class TicketAttachment(Base):
    __tablename__ = "ticket_attachments"

    id = Column(Integer, primary_key=True, index=True)
    ticket_id = Column(Integer, ForeignKey("tickets.id", ondelete="CASCADE"), index=True)
    message_id = Column(Integer, ForeignKey("ticket_messages.id", ondelete="CASCADE"))
    file_name = Column(String(255), nullable=False)
    file_url = Column(String(500), nullable=False)
    file_size = Column(Integer)
    file_type = Column(String(100))
    uploaded_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime, server_default=func.now())