"""Pydantic schemas for DigiPortal."""

from datetime import datetime
from typing import Optional
from pydantic import BaseModel, ConfigDict


class PackRecordResponse(BaseModel):
    id: str
    group_slug: str
    pack_slug: str
    title: str
    stage: str
    value: Optional[float] = 0
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    city: Optional[str] = None
    owner_id: Optional[int] = None
    won: Optional[bool] = False
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PackDocumentResponse(BaseModel):
    id: str
    record_id: str
    name: str
    doc_type: str
    status: str
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


class PackPaymentResponse(BaseModel):
    id: str
    record_id: str
    kind: str
    label: str
    amount: float
    currency: str
    status: str
    due_date: Optional[datetime] = None
    paid_at: Optional[datetime] = None
    reference: Optional[str] = None
    method: Optional[str] = None
    decision_note: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class VerificationResponse(BaseModel):
    id: str
    kind: str
    status: str
    provider: Optional[str] = None
    score: Optional[int] = None
    identifier_masked: Optional[str] = None
    subject_name: Optional[str] = None
    created_at: Optional[datetime] = None
    error: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class PaymentMarkPaid(BaseModel):
    reference: Optional[str] = None
    method: Optional[str] = None


class DocumentUploadResponse(BaseModel):
    id: str
    name: str
    status: str
    storage_path: Optional[str] = None