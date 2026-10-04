"""
Pydantic schemas for Industries.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID


class IndustryBase(BaseModel):
    key: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    icon: Optional[str] = None
    price: Optional[float] = 0
    currency: Optional[str] = "INR"
    is_active: Optional[bool] = True
    is_public: Optional[bool] = True
    order_index: Optional[int] = 0

    status: Optional[str] = "available"
    category: Optional[str] = None


class IndustryCreate(IndustryBase):
    pass


class IndustryUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    price: Optional[float] = None
    currency: Optional[str] = None
    is_active: Optional[bool] = None
    is_public: Optional[bool] = None
    order_index: Optional[int] = None


class IndustryResponse(IndustryBase):
    id: int
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TenantIndustryResponse(BaseModel):
    id: int
    uuid: UUID
    tenant_id: int
    industry_id: int
    industry_key: Optional[str] = None
    industry_name: Optional[str] = None
    status: str
    granted_at: Optional[datetime] = None
    expires_at: Optional[datetime] = None

    class Config:
        from_attributes = True