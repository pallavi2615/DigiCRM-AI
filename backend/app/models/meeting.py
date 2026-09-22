from sqlalchemy import Column, Integer, String, Text, DateTime, ForeignKey, JSON
from sqlalchemy.sql import func
from app.db.database import Base


class Meeting(Base):
    __tablename__ = "meetings"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    agenda = Column(Text)
    scheduled_at = Column(DateTime, nullable=False, index=True)
    duration_minutes = Column(Integer, default=30)
    status = Column(String(50), default="scheduled", index=True)
    meeting_type = Column(String(50), default="video")
    location = Column(String(255))
    meeting_link = Column(String(500))
    attendees = Column(JSON, default=[])
    notes = Column(Text)
    outcome = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"))
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"))
    company_id = Column(Integer, ForeignKey("companies.id", ondelete="SET NULL"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())