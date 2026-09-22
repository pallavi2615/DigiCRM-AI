from pydantic import BaseModel
from typing import Optional, Dict, Any
from datetime import datetime


class WebhookEventResponse(BaseModel):
    id: int
    tenant_id: int
    event_id: Optional[str] = None
    webhook_id: Optional[str] = None
    payload: Optional[Dict[str, Any]] = None
    status: str
    attempts: int
    max_attempts: int
    next_retry_at: Optional[datetime] = None
    last_error: Optional[str] = None
    response_status: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class WebhookEventStats(BaseModel):
    retrying: int
    dead_letter: int
    success: int
    failed: int