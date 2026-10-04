"""
Pydantic schemas for Cashflow.
"""

from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import date, datetime
from uuid import UUID


class CashflowBase(BaseModel):
    type: str = Field(..., pattern="^(student_fee|franchise_royalty|rent|invoice|subscription|other)$")
    item: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    party_name: str = Field(..., min_length=1, max_length=255)
    party_email: Optional[str] = None
    party_phone: Optional[str] = None
    amount: float = Field(..., ge=0)
    paid_amount: Optional[float] = 0
    currency: Optional[str] = "INR"
    due_date: Optional[date] = None
    notes: Optional[str] = None
    assigned_to: Optional[int] = None


class CashflowCreate(CashflowBase):
    pass


class CashflowUpdate(BaseModel):
    type: Optional[str] = None
    item: Optional[str] = None
    description: Optional[str] = None
    party_name: Optional[str] = None
    party_email: Optional[str] = None
    party_phone: Optional[str] = None
    amount: Optional[float] = None
    paid_amount: Optional[float] = None
    due_date: Optional[date] = None
    status: Optional[str] = None
    notes: Optional[str] = None
    assigned_to: Optional[int] = None


class CashflowResponse(CashflowBase):
    id: int
    uuid: UUID
    tenant_id: int
    status: str
    paid_at: Optional[datetime] = None
    created_at: datetime
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class CashflowListResponse(BaseModel):
    data: List[CashflowResponse]
    total: int
    skip: int
    limit: int


class CashflowStats(BaseModel):
    # KPI cards
    pending_fees: float
    pending_count: int
    due_30_days: float
    due_30_days_count: int
    overdue_royalties: float
    overdue_royalties_count: int
    all_overdue: float
    all_overdue_count: int


class CashflowAlert(BaseModel):
    level: str          # "danger" | "warning" | "info"
    message: str


class CashflowAlertsResponse(BaseModel):
    alerts: List[CashflowAlert]


class RecordPaymentRequest(BaseModel):
    amount: float = Field(..., gt=0)
    note: Optional[str] = None