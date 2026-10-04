"""
Pydantic schemas for IT Projects.
"""

from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID


# ============================================================
# BASE
# ============================================================

class ITProjectBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    client_name: str = Field(..., min_length=1, max_length=255)
    client_email: Optional[EmailStr] = None
    stack: Optional[str] = None
    description: Optional[str] = None
    stage: Optional[str] = Field(None, pattern="^(discovery|proposal|negotiation|contract|kickoff|in_progress|uat|delivered|closed)$")
    value: Optional[float] = 0
    currency: Optional[str] = "INR"
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    owner_id: Optional[int] = None
    lead_id: Optional[int] = None
    tags: Optional[str] = None
    notes: Optional[str] = None


# ============================================================
# CREATE
# ============================================================

class ITProjectCreate(ITProjectBase):
    pass


# ============================================================
# UPDATE (all optional)
# ============================================================

class ITProjectUpdate(BaseModel):
    name: Optional[str] = None
    client_name: Optional[str] = None
    client_email: Optional[EmailStr] = None
    stack: Optional[str] = None
    description: Optional[str] = None
    stage: Optional[str] = Field(None, pattern="^(discovery|proposal|negotiation|contract|kickoff|in_progress|uat|delivered|closed)$")
    value: Optional[float] = None
    currency: Optional[str] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    owner_id: Optional[int] = None
    lead_id: Optional[int] = None
    tags: Optional[str] = None
    notes: Optional[str] = None


# ============================================================
# RESPONSE
# ============================================================

class ITProjectResponse(BaseModel):
    id: int
    uuid: UUID
    tenant_id: int
    name: str
    client_name: str
    client_email: Optional[str] = None
    stack: Optional[str] = None
    description: Optional[str] = None
    stage: str
    value: float
    currency: str
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    owner_id: Optional[int] = None
    lead_id: Optional[int] = None
    created_by: Optional[int] = None
    tags: Optional[str] = None
    notes: Optional[str] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# STAGE MOVE (for pipeline drag-and-drop)
# ============================================================

class ITProjectStageUpdate(BaseModel):
    stage: str = Field(..., pattern="^(discovery|proposal|negotiation|contract|kickoff|in_progress|uat|delivered|closed)$")


# ============================================================
# STATS
# ============================================================

class ITProjectStats(BaseModel):
    total: int
    by_stage: dict
    total_value: float
    won_value: float


# ============================================================
# LIST RESPONSE (with pagination)
# ============================================================

class ITProjectListResponse(BaseModel):
    data: List[ITProjectResponse]
    total: int
    skip: int
    limit: int