"""
Pydantic schemas for the Audit Log API.
"""

from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional, Dict, Any, List
from uuid import UUID


class AuditLogResponse(BaseModel):
    id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None

    table_name: str
    row_id: UUID
    action: str
    description: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None

    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class AuditLogListResponse(BaseModel):
    data: List[AuditLogResponse]
    total: int
    skip: int
    limit: int


class AuditLogStats(BaseModel):
    total: int
    today: int
    created: int
    updated: int
    deleted: int


class AuditLogCreate(BaseModel):
    """Internal — used by AuditService, not exposed as an API."""
    tenant_id: int
    user_id: Optional[int] = None
    user_name: Optional[str] = None

    table_name: str
    row_id: UUID
    action: str = Field(..., pattern="^(created|updated|deleted)$")

    description: Optional[str] = None
    changes: Optional[Dict[str, Any]] = None

    ip_address: Optional[str] = None
    user_agent: Optional[str] = None