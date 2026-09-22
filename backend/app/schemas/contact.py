from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List, Any
from datetime import datetime


class ContactCreate(BaseModel):
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company_id: Optional[int] = None
    notes: Optional[str] = None
    linkedin_url: Optional[str] = None
    avatar_url: Optional[str] = None
    owner_id: Optional[int] = None
    tags: Optional[List[str]] = []
    status: Optional[str] = "active"


class ContactUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    company_id: Optional[int] = None
    notes: Optional[str] = None
    linkedin_url: Optional[str] = None
    avatar_url: Optional[str] = None
    owner_id: Optional[int] = None
    tags: Optional[List[str]] = None
    status: Optional[str] = None


class ContactResponse(BaseModel):
    id: int
    tenant_id: Optional[int] = None
    first_name: str
    last_name: Optional[str] = None
    designation: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    company_id: Optional[int] = None
    notes: Optional[str] = None
    linkedin_url: Optional[str] = None
    avatar_url: Optional[str] = None
    owner_id: Optional[int] = None
    tags: Optional[List[Any]] = []
    status: str = "active"
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ContactImportResult(BaseModel):
    total_rows: int
    imported: int
    failed: int
    errors: List[str] = []