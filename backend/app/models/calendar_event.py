from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, ForeignKey, JSON
from sqlalchemy.sql import func
from app.db.database import Base


class CalendarEvent(Base):
    __tablename__ = "calendar_events"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    event_type = Column(String(50), default="meeting")
    start_time = Column(DateTime, nullable=False, index=True)
    end_time = Column(DateTime)
    all_day = Column(Boolean, default=False)
    location = Column(String(255))
    meeting_link = Column(String(500))
    attendees = Column(JSON, default=[])
    created_by = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    lead_id = Column(Integer, ForeignKey("leads.id", ondelete="SET NULL"))
    contact_id = Column(Integer, ForeignKey("contacts.id", ondelete="SET NULL"))
    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())