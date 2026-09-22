from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime
from decimal import Decimal


class CompanyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    industry: Optional[str] = None
    location: Optional[str] = None
    employees: Optional[int] = 0
    revenue: Optional[Decimal] = Decimal("0")
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    notes: Optional[str] = None
    logo_url: Optional[str] = None
    owner_id: Optional[int] = None
    tags: Optional[List[str]] = []
    status: Optional[str] = "active"


class CompanyUpdate(BaseModel):
    name: Optional[str] = None
    industry: Optional[str] = None
    location: Optional[str] = None
    employees: Optional[int] = None
    revenue: Optional[Decimal] = None
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[EmailStr] = None
    notes: Optional[str] = None
    logo_url: Optional[str] = None
    owner_id: Optional[int] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None


class CompanyResponse(BaseModel):
    id: int
    tenant_id: Optional[int] = None
    name: str
    industry: Optional[str] = None
    location: Optional[str] = None
    employees: int = 0
    revenue: Decimal = Decimal("0")
    website: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    notes: Optional[str] = None
    logo_url: Optional[str] = None
    owner_id: Optional[int] = None
    tags: Optional[List[Any]] = []
    status: str = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CompanyImportResult(BaseModel):
    total_rows: int
    imported: int
    failed: int
    errors: List[str] = []