"""
Pydantic schemas for Notifications API.
"""

from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List, Dict, Any
from uuid import UUID


class NotificationResponse(BaseModel):
    id: int
    uuid: UUID
    type: str
    title: str
    message: Optional[str] = None
    is_read: bool
    read_at: Optional[datetime] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    action_url: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None
    created_at: datetime

    class Config:
        from_attributes = True


class NotificationListResponse(BaseModel):
    data: List[NotificationResponse]
    total: int
    unread: int
    skip: int
    limit: int


class UnreadCountResponse(BaseModel):
    unread: int


class NotificationCreate(BaseModel):
    """Internal — used by NotificationService."""
    user_id: int
    tenant_id: Optional[int] = None
    type: str
    title: str
    message: Optional[str] = None
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    action_url: Optional[str] = None
    extra_data: Optional[Dict[str, Any]] = None


class MarkReadResponse(BaseModel):
    success: bool
    notification_id: Optional[int] = None
    marked: Optional[int] = None
    message: str