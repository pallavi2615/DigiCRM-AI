from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime


class EventCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    event_type: Optional[str] = "meeting"
    start_time: datetime
    end_time: Optional[datetime] = None
    all_day: Optional[bool] = False
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    attendees: Optional[List[Any]] = []
    lead_id: Optional[int] = None
    contact_id: Optional[int] = None


class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    event_type: Optional[str] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    all_day: Optional[bool] = None
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    attendees: Optional[List[Any]] = None


class EventResponse(BaseModel):
    id: int
    tenant_id: int
    title: str
    description: Optional[str] = None
    event_type: str
    start_time: datetime
    end_time: Optional[datetime] = None
    all_day: bool
    location: Optional[str] = None
    meeting_link: Optional[str] = None
    attendees: Optional[List[Any]] = []
    lead_id: Optional[int] = None
    contact_id: Optional[int] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True