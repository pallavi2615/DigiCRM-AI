from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime
from decimal import Decimal


class TemplateCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    category: Optional[str] = None
    owner_label: Optional[str] = None
    amount: Optional[Decimal] = Decimal("0")
    currency: Optional[str] = "INR"
    terms: Optional[str] = None
    content: Optional[Dict[str, Any]] = {}
    shared_with_team: Optional[bool] = True


class TemplateUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    owner_label: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    terms: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    shared_with_team: Optional[bool] = None


class TemplateResponse(BaseModel):
    id: int
    tenant_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    category: Optional[str] = None
    owner_label: Optional[str] = None
    amount: Decimal
    currency: str
    terms: Optional[str] = None
    content: Optional[Dict[str, Any]] = None
    shared_with_team: bool
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True