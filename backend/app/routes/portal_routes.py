"""
DigiPortal API — replaces the dead Supabase tables.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from typing import List, Optional
from datetime import datetime
from uuid import uuid4
import logging
import os

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.permissions import require_feature_permission
from app.core.constants import SUPER_ADMIN_ROLE as SA_CONST
from app.models.user import User
from app.models.portal import PackRecord, PackDocument, PackPayment, Verification
from app.schemas.portal import (
    PackRecordCreate,
    PackRecordResponse,
    PackDocumentResponse,
    PackPaymentCreate, 
    PackPaymentUpdate,
    PackPaymentResponse,
    VerificationResponse,
    PaymentMarkPaid,
    DocumentUploadResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/portal", tags=["Portal"])

UPLOAD_DIR = "uploads/pack_documents"
os.makedirs(UPLOAD_DIR, exist_ok=True)


def _records_query_for_user(db: Session, user: User):
    """
    Return records visible to the user:
    - SuperAdmin: all
    - Admin/Manager: own tenant
    - Executive: assigned to self OR with matching contact_email
    """
    query = db.query(PackRecord).filter(PackRecord.deleted_at.is_(None))

    if user.role != SA_CONST:
        query = query.filter(PackRecord.tenant_id == user.tenant_id)

    if user.role in ("sales_executive", "executive"):
        query = query.filter(
            or_(
                PackRecord.owner_id == user.id,
                PackRecord.contact_email == user.email,
            )
        )

    return query


# ═══════════════════════════════════════════════════════
# RECORDS
# ═══════════════════════════════════════════════════════

@router.get("/records", response_model=List[PackRecordResponse])
def list_records(
    group_slug: Optional[str] = None,
    pack_slug: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(200, ge=1, le=500),
    user: User = Depends(require_feature_permission("dashboard", "view")),
    db: Session = Depends(get_db),
):
    """List deals visible to the current user."""
    query = _records_query_for_user(db, user)

    if group_slug:
        query = query.filter(PackRecord.group_slug == group_slug)
    if pack_slug:
        query = query.filter(PackRecord.pack_slug == pack_slug)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (PackRecord.title.ilike(pattern)) |
            (PackRecord.contact_name.ilike(pattern)) |
            (PackRecord.city.ilike(pattern))
        )

    rows = query.order_by(desc(PackRecord.created_at)).limit(limit).all()
    return [PackRecordResponse.model_validate(r) for r in rows]


@router.post("/records", response_model=PackRecordResponse, status_code=201)
def create_record(
    payload: PackRecordCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new application/deal in the portal."""
    if user.role != SA_CONST and not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    record = PackRecord(
        tenant_id=user.tenant_id,
        group_slug=payload.group_slug,
        pack_slug=payload.pack_slug,
        title=payload.title,
        stage=payload.stage or "New",
        value=payload.value or 0,
        contact_name=payload.contact_name,
        contact_email=payload.contact_email,
        city=payload.city,
        owner_id=user.id,
        won=False,
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    return PackRecordResponse.model_validate(record)

@router.get("/records/{record_id}", response_model=PackRecordResponse)
def get_record(
    record_id: str,
    user: User = Depends(require_feature_permission("dashboard", "view")),
    db: Session = Depends(get_db),
):
    """Get a single record."""
    record = (
        _records_query_for_user(db, user)
        .filter(PackRecord.id == record_id)
        .first()
    )
    if not record:
        raise HTTPException(404, "Record not found")
    return PackRecordResponse.model_validate(record)


# ═══════════════════════════════════════════════════════
# DOCUMENTS
# ═══════════════════════════════════════════════════════

@router.get("/records/{record_id}/documents", response_model=List[PackDocumentResponse])
def list_documents(
    record_id: str,
    user: User = Depends(require_feature_permission("dashboard", "view")),
    db: Session = Depends(get_db),
):
    # Verify record access
    record = _records_query_for_user(db, user).filter(PackRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Record not found")

    docs = (
        db.query(PackDocument)
        .filter(PackDocument.record_id == record_id)
        .order_by(PackDocument.created_at)
        .all()
    )
    return [PackDocumentResponse.model_validate(d) for d in docs]


@router.post("/records/{record_id}/documents", response_model=DocumentUploadResponse, status_code=201)
async def upload_document(
    record_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Upload a document for a record."""
    record = _records_query_for_user(db, user).filter(PackRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Record not found")

    # Save file
    safe_name = file.filename.replace("/", "_").replace("\\", "_")
    stored_name = f"{uuid4().hex}_{safe_name}"
    path = os.path.join(UPLOAD_DIR, stored_name)

    contents = await file.read()
    with open(path, "wb") as f:
        f.write(contents)

    doc = PackDocument(
        record_id=record.id,
        name=file.filename,
        doc_type="other",
        status="uploaded",
        storage_path=path,
        uploaded_by=user.id,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)

    return DocumentUploadResponse(
        id=str(doc.id),
        name=doc.name,
        status=doc.status,
        storage_path=doc.storage_path,
    )


# ═══════════════════════════════════════════════════════
# PAYMENTS
# ═══════════════════════════════════════════════════════

@router.get("/records/{record_id}/payments", response_model=List[PackPaymentResponse])
def list_payments(
    record_id: str,
    user: User = Depends(require_feature_permission("dashboard", "view")),
    db: Session = Depends(get_db),
):
    record = _records_query_for_user(db, user).filter(PackRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Record not found")

    payments = (
        db.query(PackPayment)
        .filter(PackPayment.record_id == record_id)
        .order_by(PackPayment.due_date)
        .all()
    )
    return [PackPaymentResponse.model_validate(p) for p in payments]


@router.post("/payments/{payment_id}/mark-paid", response_model=PackPaymentResponse)
def mark_payment_paid(
    payment_id: str,
    payload: PaymentMarkPaid,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a payment as 'pending_confirmation' (client says they paid)."""
    payment = db.query(PackPayment).filter(PackPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(404, "Payment not found")

    # Verify access via record
    record = _records_query_for_user(db, user).filter(PackRecord.id == payment.record_id).first()
    if not record:
        raise HTTPException(403, "Not allowed")

    payment.status = "pending_confirmation"
    payment.reference = payload.reference or payment.reference
    payment.method = payload.method or payment.method

    db.commit()
    db.refresh(payment)
    return PackPaymentResponse.model_validate(payment)


# ═══════════════════════════════════════════════════════
# VERIFICATIONS
# ═══════════════════════════════════════════════════════

@router.get("/records/{record_id}/verifications", response_model=List[VerificationResponse])
def list_verifications(
    record_id: str,
    user: User = Depends(require_feature_permission("dashboard", "view")),
    db: Session = Depends(get_db),
):
    record = _records_query_for_user(db, user).filter(PackRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Record not found")

    rows = (
        db.query(Verification)
        .filter(Verification.record_id == record_id)
        .order_by(desc(Verification.created_at))
        .all()
    )
    return [VerificationResponse.model_validate(v) for v in rows]

@router.post(
    "/records/{record_id}/payments",
    response_model=PackPaymentResponse,
    status_code=201,
)
def create_payment(
    record_id: str,
    payload: PackPaymentCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Client records a payment they made for this record."""
    record = _records_query_for_user(db, user).filter(PackRecord.id == record_id).first()
    if not record:
        raise HTTPException(404, "Record not found")

    payment = PackPayment(
        record_id=record.id,
        kind=payload.kind,
        label=payload.label,
        amount=payload.amount,
        currency=payload.currency or "INR",
        method=payload.method,
        reference=payload.reference,
        payer_note=payload.payer_note,
        status="pending_confirmation",
        submitted_at=payload.submitted_at or datetime.utcnow(),
        submitted_by=user.id,
        created_by=user.id,
    )
    db.add(payment)
    db.commit()
    db.refresh(payment)
    return PackPaymentResponse.model_validate(payment)


@router.put("/payments/{payment_id}", response_model=PackPaymentResponse)
def update_payment(
    payment_id: str,
    payload: PackPaymentUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a payment (client marking as paid, admin confirming, etc.)."""
    payment = db.query(PackPayment).filter(PackPayment.id == payment_id).first()
    if not payment:
        raise HTTPException(404, "Payment not found")

    # Verify access via record
    record = _records_query_for_user(db, user).filter(PackRecord.id == payment.record_id).first()
    if not record:
        raise HTTPException(403, "Not allowed")

    data = payload.model_dump(exclude_unset=True)

    # Auto-set paid_at when status = paid
    if data.get("status") == "paid" and not payment.paid_at:
        data["paid_at"] = datetime.utcnow()

    for k, v in data.items():
        setattr(payment, k, v)

    db.commit()
    db.refresh(payment)
    return PackPaymentResponse.model_validate(payment)


# ═══════════════════════════════════════════════════════
# BULK LISTS — for industry module
# ⚠️ MUST be before dynamic routes
# ═══════════════════════════════════════════════════════

@router.get("/documents", response_model=List[PackDocumentResponse])
def list_all_documents(
    group_slug: Optional[str] = None,
    pack_slug: Optional[str] = None,
    limit: int = Query(300, ge=1, le=1000),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all documents across the user's accessible records."""
    record_query = _records_query_for_user(db, user)
    if group_slug:
        record_query = record_query.filter(PackRecord.group_slug == group_slug)
    if pack_slug:
        record_query = record_query.filter(PackRecord.pack_slug == pack_slug)

    record_ids = [r.id for r in record_query.limit(500).all()]
    if not record_ids:
        return []

    docs = (
        db.query(PackDocument)
        .filter(PackDocument.record_id.in_(record_ids))
        .order_by(desc(PackDocument.created_at))
        .limit(limit)
        .all()
    )
    return [PackDocumentResponse.model_validate(d) for d in docs]


@router.get("/payments-all", response_model=List[PackPaymentResponse])
def list_all_payments(
    group_slug: Optional[str] = None,
    pack_slug: Optional[str] = None,
    limit: int = Query(300, ge=1, le=1000),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all payments across the user's accessible records."""
    record_query = _records_query_for_user(db, user)
    if group_slug:
        record_query = record_query.filter(PackRecord.group_slug == group_slug)
    if pack_slug:
        record_query = record_query.filter(PackRecord.pack_slug == pack_slug)

    record_ids = [r.id for r in record_query.limit(500).all()]
    if not record_ids:
        return []

    payments = (
        db.query(PackPayment)
        .filter(PackPayment.record_id.in_(record_ids))
        .order_by(desc(PackPayment.due_date))
        .limit(limit)
        .all()
    )
    return [PackPaymentResponse.model_validate(p) for p in payments]