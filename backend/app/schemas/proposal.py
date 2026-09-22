from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, date
from decimal import Decimal


# ============ CREATE ============
class ProposalCreate(BaseModel):
    lead_id: Optional[int] = None
    contact_id: Optional[int] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    company_name: Optional[str] = None
    
    title: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    notes: Optional[str] = None
    document_content: Optional[str] = None
    
    amount: Optional[Decimal] = Decimal("0")
    currency: Optional[str] = "INR"
    valid_until: Optional[date] = None
    terms: Optional[str] = None
    probability: Optional[int] = 0
    close_date: Optional[date] = None
    owner: Optional[str] = None
    version: Optional[str] = "v1"
    approval_status: Optional[str] = "pending"
    pipeline_stage: Optional[str] = "in_pipeline"
    lead_name: Optional[str] = None
    template_id: Optional[int] = None
    
    save_as_template: Optional[bool] = False  


# ============ UPDATE ============
class ProposalUpdate(BaseModel):
    lead_id: Optional[int] = None
    title: Optional[str] = None
    description: Optional[str] = None
    amount: Optional[Decimal] = None
    currency: Optional[str] = None
    valid_until: Optional[date] = None
    terms: Optional[str] = None
    status: Optional[str] = None
    probability: Optional[int] = None
    close_date: Optional[date] = None
    owner: Optional[str] = None
    version: Optional[str] = None
    approval_status: Optional[str] = None
    pipeline_stage: Optional[str] = None
    lead_name: Optional[str] = None
    template_id: Optional[int] = None


# ============ STATUS UPDATE ============
class ProposalStatusUpdate(BaseModel):
    status: str = Field(..., min_length=1, max_length=50)


# ============ RESPONSE ============
class ProposalResponse(BaseModel):
    id: int
    tenant_id: Optional[int] = None
    lead_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    amount: Decimal
    currency: str
    status: str
    valid_until: Optional[date] = None
    terms: Optional[str] = None
    public_token: Optional[str] = None

    # New fields
    probability: int = 0
    close_date: Optional[date] = None
    owner: Optional[str] = None
    version: str = "v1"
    approval_status: str = "pending"
    pipeline_stage: str = "in_pipeline"
    lead_name: Optional[str] = None
    template_id: Optional[int] = None

    sent_at: Optional[datetime] = None
    viewed_at: Optional[datetime] = None
    accepted_at: Optional[datetime] = None
    declined_at: Optional[datetime] = None
    created_by: Optional[int] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============ PUBLIC VIEW ============
class ProposalPublic(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    amount: Decimal
    currency: str
    status: str
    valid_until: Optional[date] = None
    terms: Optional[str] = None
    probability: int = 0
    close_date: Optional[date] = None

    class Config:
        from_attributes = True


class MessageResponse(BaseModel):
    message: str
    success: bool = True