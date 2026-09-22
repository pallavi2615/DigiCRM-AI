from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    agenda: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: Optional[int] = 30
    meeting_type: Optional[str] = "video"
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    attendees: Optional[List[Any]] = []
    lead_id: Optional[int] = None
    contact_id: Optional[int] = None
    company_id: Optional[int] = None


class MeetingUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    agenda: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    duration_minutes: Optional[int] = None
    status: Optional[str] = None
    meeting_type: Optional[str] = None
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    attendees: Optional[List[Any]] = None
    notes: Optional[str] = None
    outcome: Optional[str] = None


class MeetingResponse(BaseModel):
    id: int
    tenant_id: int
    title: str
    description: Optional[str] = None
    agenda: Optional[str] = None
    scheduled_at: datetime
    duration_minutes: int
    status: str
    meeting_type: str
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    attendees: Optional[List[Any]] = []
    notes: Optional[str] = None
    outcome: Optional[str] = None
    lead_id: Optional[int] = None
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True