"""
Pydantic schemas for Role Change History.
"""

from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class RoleChangeResponse(BaseModel):
    id: int
    uuid: UUID
    tenant_id: int

    user_id: int
    user_name: Optional[str] = None
    user_email: Optional[str] = None

    actor_id: Optional[int] = None
    actor_name: Optional[str] = None
    actor_email: Optional[str] = None

    old_role: str
    new_role: str

    notes: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class RoleChangeListResponse(BaseModel):
    data: List[RoleChangeResponse]
    total: int
    skip: int
    limit: int


class RoleChangeFilters(BaseModel):
    """Helper schema for filter options (used by frontend dropdowns)."""
    users: List[dict] = []
    roles: List[str] = []