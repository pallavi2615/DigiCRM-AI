"""Payment Pydantic schemas."""

from datetime import date, datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field


# ─────────────────────────────────────────────
# Bank Account
# ─────────────────────────────────────────────
class BankAccountBase(BaseModel):
    name: str
    account_number: Optional[str] = None
    ifsc: Optional[str] = None
    opening_balance: float = 0


class BankAccountCreate(BankAccountBase):
    pass


class BankAccountResponse(BankAccountBase):
    id: int
    is_active: int
    model_config = ConfigDict(from_attributes=True)


# ─────────────────────────────────────────────
# Payment Entry
# ─────────────────────────────────────────────
class PaymentEntryBase(BaseModel):
    direction: str = Field(..., pattern="^(in|out)$")
    category: str
    party: str
    amount: float
    utr: Optional[str] = None
    memo: Optional[str] = None
    bank_account_id: Optional[int] = None
    entry_date: Optional[date] = None


class PaymentEntryCreate(PaymentEntryBase):
    pass


class PaymentEntryUpdate(BaseModel):
    direction: Optional[str] = Field(None, pattern="^(in|out)$")
    category: Optional[str] = None
    party: Optional[str] = None
    amount: Optional[float] = None
    utr: Optional[str] = None
    memo: Optional[str] = None
    bank_account_id: Optional[int] = None
    entry_date: Optional[date] = None


class PaymentEntryResponse(PaymentEntryBase):
    id: int
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    model_config = ConfigDict(from_attributes=True)


class PaymentListResponse(BaseModel):
    data: List[PaymentEntryResponse]
    total: int
    skip: int
    limit: int


# ─────────────────────────────────────────────
# Stats — KPI cards
# ─────────────────────────────────────────────
class PaymentStats(BaseModel):
    money_in: float
    money_out: float
    net: float
    bank_balance: float
    entries_count: int