from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List, Any
from datetime import datetime


# ============ ATTACHMENT ============
class TicketAttachmentResponse(BaseModel):
    id: int
    file_name: str
    file_url: str
    file_size: Optional[int] = None
    file_type: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ MESSAGE ============
class TicketMessageCreate(BaseModel):
    message: str = Field(..., min_length=1)
    is_internal: Optional[bool] = False


class TicketMessageResponse(BaseModel):
    id: int
    ticket_id: int
    sender_id: Optional[int] = None
    sender_type: str
    sender_name: Optional[str] = None
    sender_email: Optional[str] = None
    message: str
    is_internal: bool
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ TICKET ============
class TicketCreate(BaseModel):
    subject: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    requester_name: Optional[str] = None
    requester_email: Optional[EmailStr] = None
    requester_phone: Optional[str] = None
    requester_id: Optional[int] = None
    priority: Optional[str] = "medium"
    urgency: Optional[str] = "medium"
    category: Optional[str] = None
    assigned_to: Optional[int] = None
    tags: Optional[List[Any]] = []
    custom_fields: Optional[dict] = {}


class TicketUpdate(BaseModel):
    subject: Optional[str] = None
    description: Optional[str] = None
    requester_name: Optional[str] = None
    requester_email: Optional[EmailStr] = None
    requester_phone: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    urgency: Optional[str] = None
    category: Optional[str] = None
    assigned_to: Optional[int] = None
    tags: Optional[List[Any]] = None
    custom_fields: Optional[dict] = None


class TicketStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1)


class TicketResponse(BaseModel):
    id: int
    tenant_id: int
    subject: str
    description: Optional[str] = None
    ticket_number: Optional[str] = None
    requester_name: Optional[str] = None
    requester_email: Optional[str] = None
    requester_phone: Optional[str] = None
    requester_id: Optional[int] = None
    status: str
    priority: str
    urgency: str
    category: Optional[str] = None
    assigned_to: Optional[int] = None
    created_by: Optional[int] = None
    sla_due_at: Optional[datetime] = None
    sla_breached: bool = False
    first_response_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    tags: Optional[List[Any]] = []
    custom_fields: Optional[dict] = {}
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TicketDetailResponse(TicketResponse):
    messages: Optional[List[TicketMessageResponse]] = []
    attachments: Optional[List[TicketAttachmentResponse]] = []


class TicketStats(BaseModel):
    all: int
    open: int
    pending: int
    resolved: int
    closed: int
    sla_breached: int