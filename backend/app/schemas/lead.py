from pydantic import BaseModel, EmailStr, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, date
from decimal import Decimal


# ============ CREATE ============
class LeadCreate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    company_name: Optional[str] = None
    designation: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    message: Optional[str] = None
    source: Optional[str] = "manual"
    priority: Optional[str] = "medium"
    value: Optional[Decimal] = Decimal("0")
    estimated_value: Optional[Decimal] = Decimal("0")
    expected_close_date: Optional[date] = None
    assigned_to: Optional[int] = None
    company_id: Optional[int] = None
    contact_id: Optional[int] = None
    industry_group: Optional[str] = None
    custom_fields: Optional[Dict[str, Any]] = None


# ============ UPDATE ============
class LeadUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    company_name: Optional[str] = None
    designation: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    message: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    value: Optional[Decimal] = None
    estimated_value: Optional[Decimal] = None
    expected_close_date: Optional[date] = None
    assigned_to: Optional[int] = None
    company_id: Optional[int] = None
    contact_id: Optional[int] = None
    industry_group: Optional[str] = None
    score: Optional[int] = None
    custom_fields: Optional[Dict[str, Any]] = None


# ============ STATUS ============
class LeadStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1, max_length=50)


# ============ RESPONSE ============
class LeadResponse(BaseModel):
    id: int
    tenant_id: Optional[int] = None
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    company_name: Optional[str] = None
    designation: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    message: Optional[str] = None
    source: Optional[str] = None
    status: str
    priority: str = "medium"
    value: Decimal = Decimal("0")
    estimated_value: Decimal = Decimal("0")
    expected_close_date: Optional[date] = None
    assigned_to: Optional[int] = None
    company_id: Optional[int] = None
    contact_id: Optional[int] = None
    industry_group: Optional[str] = None
    score: int = 0
    custom_fields: Optional[Dict[str, Any]] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ WEBHOOK ============
class WebhookPayload(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company: Optional[str] = None
    designation: Optional[str] = None
    website: Optional[str] = None
    industry: Optional[str] = None
    country: Optional[str] = None
    city: Optional[str] = None
    message: Optional[str] = None
    source: Optional[str] = "webhook"
    priority: Optional[str] = "medium"
    value: Optional[Decimal] = Decimal("0")
    custom_fields: Optional[Dict[str, Any]] = None


class WebhookResponse(BaseModel):
    success: bool
    lead_id: int
    message: str


# ============ IMPORT ============
class LeadImportResult(BaseModel):
    total_rows: int
    imported: int
    failed: int
    errors: List[str] = []