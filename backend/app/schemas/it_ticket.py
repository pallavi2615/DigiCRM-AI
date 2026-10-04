"""
Pydantic schemas for IT Tickets.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID


# ============================================================
# BASE
# ============================================================

class ITTicketBase(BaseModel):
    title: str = Field(..., min_length=1, max_length=500)
    description: Optional[str] = None
    project_id: Optional[int] = None
    type: Optional[str] = Field(None, pattern="^(bug|feature|task)$")
    priority: Optional[str] = Field(None, pattern="^(urgent|high|medium|low)$")
    status: Optional[str] = Field(None, pattern="^(open|in_progress|blocked|resolved|closed)$")
    due_date: Optional[date] = None
    assignee_id: Optional[int] = None
    tags: Optional[str] = None


# ============================================================
# CREATE
# ============================================================

class ITTicketCreate(ITTicketBase):
    pass


# ============================================================
# UPDATE (all optional)
# ============================================================

class ITTicketUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    project_id: Optional[int] = None
    type: Optional[str] = Field(None, pattern="^(bug|feature|task)$")
    priority: Optional[str] = Field(None, pattern="^(urgent|high|medium|low)$")
    status: Optional[str] = Field(None, pattern="^(open|in_progress|blocked|resolved|closed)$")
    due_date: Optional[date] = None
    assignee_id: Optional[int] = None
    tags: Optional[str] = None


# ============================================================
# STATUS UPDATE (for quick status change)
# ============================================================

class ITTicketStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(open|in_progress|blocked|resolved|closed)$")


# ============================================================
# RESPONSE
# ============================================================

class ITTicketResponse(BaseModel):
    id: int
    uuid: UUID
    tenant_id: int
    project_id: Optional[int] = None
    project_name: Optional[str] = None     # injected from relationship
    title: str
    description: Optional[str] = None
    type: str
    priority: str
    status: str
    due_date: Optional[date] = None
    resolved_at: Optional[datetime] = None
    closed_at: Optional[datetime] = None
    assignee_id: Optional[int] = None
    created_by: Optional[int] = None
    tags: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# STATS
# ============================================================

class ITTicketStats(BaseModel):
    total: int
    open: int
    in_progress: int
    blocked: int
    resolved: int
    closed: int
    by_priority: dict


# ============================================================
# LIST RESPONSE
# ============================================================

class ITTicketListResponse(BaseModel):
    data: List[ITTicketResponse]
    total: int
    skip: int
    limit: int