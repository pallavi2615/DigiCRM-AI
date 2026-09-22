from pydantic import BaseModel, Field
from typing import Optional, List, Any
from datetime import datetime, date


class AttachmentResponse(BaseModel):
    id: int
    file_name: str
    file_url: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

class TaskCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = "pending"
    priority: Optional[str] = "medium"
    due_date: Optional[date] = None
    assigned_to: Optional[int] = None
    lead_id: Optional[int] = None
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
    deal_id: Optional[int] = None
    tags: Optional[List[Any]] = []
    attachments: Optional[List[Any]] = []


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[date] = None
    assigned_to: Optional[int] = None
    tags: Optional[List[Any]] = None
    attachments: Optional[List[Any]] = None


class TaskResponse(BaseModel):
    id: int
    tenant_id: int
    title: str
    description: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    assigned_to: Optional[int] = None
    created_by: Optional[int] = None
    lead_id: Optional[int] = None
    contact_id: Optional[int] = None
    company_id: Optional[int] = None
    deal_id: Optional[int] = None
    tags: Optional[List[Any]] = []
    attachments: Optional[List[Any]] = []
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True