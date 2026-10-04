"""
Cash Flow Tracker API.

Role-based access:
    - Super Admin, Admin: full access
    - Manager: view only
    - Sales Executive: no access
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional
from datetime import date, datetime, timedelta

from app.db.database import get_db
from app.core.permissions import require_feature_permission
from app.models.user import User
from app.models.cashflow import CashflowEntry
from app.schemas.cashflow import (
    CashflowCreate,
    CashflowUpdate,
    CashflowResponse,
    CashflowListResponse,
    CashflowStats,
    CashflowAlertsResponse,
    CashflowAlert,
    RecordPaymentRequest,
)

router = APIRouter(prefix="/cashflow", tags=["Cashflow"])


def _apply_tenant_filter(query, user: User):
    if user.role != "super_admin":
        query = query.filter(CashflowEntry.tenant_id == user.tenant_id)
    return query


# ═══════════════════════════════════════════════════════
# LIST — Manager can view
# ═══════════════════════════════════════════════════════

@router.get("", response_model=CashflowListResponse)
def list_cashflow(
    status: Optional[str] = None,
    type_filter: Optional[str] = Query(None, alias="type"),
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    # 🔒 FEATURE MATRIX: cashflow.view
    user: User = Depends(require_feature_permission("cashflow", "view")),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(CashflowEntry), user)

    if status:
        query = query.filter(CashflowEntry.status == status)
    if type_filter:
        query = query.filter(CashflowEntry.type == type_filter)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            CashflowEntry.party_name.ilike(pattern) |
            CashflowEntry.item.ilike(pattern)
        )

    total = query.count()
    rows = query.order_by(desc(CashflowEntry.due_date)).offset(skip).limit(limit).all()

    return CashflowListResponse(
        data=[CashflowResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


# ═══════════════════════════════════════════════════════
# STATS — KPI cards
# ═══════════════════════════════════════════════════════

@router.get("/stats", response_model=CashflowStats)
def cashflow_stats(
    user: User = Depends(require_feature_permission("cashflow", "view")),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(CashflowEntry), user)

    today = date.today()
    next_30 = today + timedelta(days=30)

    # Pending fees
    pending_q = query.filter(CashflowEntry.status == "pending")
    pending_fees = (
        pending_q.with_entities(func.coalesce(func.sum(CashflowEntry.amount), 0))
        .scalar() or 0
    )
    pending_count = pending_q.count()

    # Due in 30 days
    due_30_q = query.filter(
        CashflowEntry.status.in_(["pending", "partial"]),
        CashflowEntry.due_date.between(today, next_30),
    )
    due_30_days = (
        due_30_q.with_entities(func.coalesce(func.sum(CashflowEntry.amount), 0))
        .scalar() or 0
    )
    due_30_days_count = due_30_q.count()

    # Overdue royalties
    overdue_roy_q = query.filter(
        CashflowEntry.type == "franchise_royalty",
        CashflowEntry.status.in_(["pending", "partial"]),
        CashflowEntry.due_date < today,
    )
    overdue_royalties = (
        overdue_roy_q.with_entities(func.coalesce(func.sum(CashflowEntry.amount), 0))
        .scalar() or 0
    )
    overdue_royalties_count = overdue_roy_q.count()

    # All overdue
    all_overdue_q = query.filter(
        CashflowEntry.status.in_(["pending", "partial"]),
        CashflowEntry.due_date < today,
    )
    all_overdue = (
        all_overdue_q.with_entities(func.coalesce(func.sum(CashflowEntry.amount), 0))
        .scalar() or 0
    )
    all_overdue_count = all_overdue_q.count()

    return CashflowStats(
        pending_fees=float(pending_fees),
        pending_count=pending_count,
        due_30_days=float(due_30_days),
        due_30_days_count=due_30_days_count,
        overdue_royalties=float(overdue_royalties),
        overdue_royalties_count=overdue_royalties_count,
        all_overdue=float(all_overdue),
        all_overdue_count=all_overdue_count,
    )


# ═══════════════════════════════════════════════════════
# ALERTS — Top banners
# ═══════════════════════════════════════════════════════

@router.get("/alerts", response_model=CashflowAlertsResponse)
def cashflow_alerts(
    user: User = Depends(require_feature_permission("cashflow", "view")),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(CashflowEntry), user)
    today = date.today()
    next_3 = today + timedelta(days=3)

    alerts = []

    # Overdue royalties
    overdue_roy = query.filter(
        CashflowEntry.type == "franchise_royalty",
        CashflowEntry.status.in_(["pending", "partial"]),
        CashflowEntry.due_date < today,
    )
    count = overdue_roy.count()
    total = (
        overdue_roy.with_entities(func.coalesce(func.sum(CashflowEntry.amount), 0))
        .scalar() or 0
    )
    if count:
        alerts.append(CashflowAlert(
            level="danger",
            message=f"{count} franchise royalties overdue — ₹{float(total):,.0f}",
        ))

    # Overdue student fees
    overdue_fees = query.filter(
        CashflowEntry.type == "student_fee",
        CashflowEntry.status.in_(["pending", "partial"]),
        CashflowEntry.due_date < today,
    )
    count = overdue_fees.count()
    if count:
        alerts.append(CashflowAlert(
            level="danger",
            message=f"{count} student fees overdue",
        ))

    # Due in next 3 days
    upcoming = query.filter(
        CashflowEntry.status.in_(["pending", "partial"]),
        CashflowEntry.due_date.between(today, next_3),
    )
    count = upcoming.count()
    if count:
        alerts.append(CashflowAlert(
            level="info",
            message=f"{count} payments due in the next 3 days",
        ))

    return CashflowAlertsResponse(alerts=alerts)


# ═══════════════════════════════════════════════════════
# GET SINGLE
# ═══════════════════════════════════════════════════════

@router.get("/{entry_id}", response_model=CashflowResponse)
def get_entry(
    entry_id: int,
    user: User = Depends(require_feature_permission("cashflow", "view")),
    db: Session = Depends(get_db),
):
    entry = _apply_tenant_filter(
        db.query(CashflowEntry), user
    ).filter(CashflowEntry.id == entry_id).first()

    if not entry:
        raise HTTPException(404, "Entry not found")
    return entry


# ═══════════════════════════════════════════════════════
# CREATE — Only Admin+ (Manager can't create)
# ═══════════════════════════════════════════════════════

@router.post("", response_model=CashflowResponse, status_code=201)
def create_entry(
    payload: CashflowCreate,
    # 🔒 FEATURE MATRIX: cashflow.create (Admin+ only)
    user: User = Depends(require_feature_permission("cashflow", "create")),
    db: Session = Depends(get_db),
):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    entry = CashflowEntry(
        tenant_id=user.tenant_id,
        type=payload.type,
        item=payload.item,
        description=payload.description,
        party_name=payload.party_name,
        party_email=payload.party_email,
        party_phone=payload.party_phone,
        amount=payload.amount,
        paid_amount=payload.paid_amount or 0,
        currency=payload.currency or "INR",
        due_date=payload.due_date,
        status="pending",
        notes=payload.notes,
        assigned_to=payload.assigned_to,
        created_by=user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


# ═══════════════════════════════════════════════════════
# UPDATE — Only Admin+
# ═══════════════════════════════════════════════════════

@router.put("/{entry_id}", response_model=CashflowResponse)
def update_entry(
    entry_id: int,
    payload: CashflowUpdate,
    user: User = Depends(require_feature_permission("cashflow", "edit")),
    db: Session = Depends(get_db),
):
    entry = _apply_tenant_filter(
        db.query(CashflowEntry), user
    ).filter(CashflowEntry.id == entry_id).first()

    if not entry:
        raise HTTPException(404, "Entry not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(entry, key, value)

    db.commit()
    db.refresh(entry)
    return entry


# ═══════════════════════════════════════════════════════
# RECORD PAYMENT — Only Admin+
# ═══════════════════════════════════════════════════════

@router.post("/{entry_id}/record-payment", response_model=CashflowResponse)
def record_payment(
    entry_id: int,
    payload: RecordPaymentRequest,
    user: User = Depends(require_feature_permission("cashflow", "edit")),
    db: Session = Depends(get_db),
):
    entry = _apply_tenant_filter(
        db.query(CashflowEntry), user
    ).filter(CashflowEntry.id == entry_id).first()

    if not entry:
        raise HTTPException(404, "Entry not found")

    new_paid = float(entry.paid_amount or 0) + payload.amount
    if new_paid > float(entry.amount):
        raise HTTPException(400, "Payment exceeds amount due")

    entry.paid_amount = new_paid

    if new_paid >= float(entry.amount):
        entry.status = "paid"
        entry.paid_at = datetime.utcnow()
    elif new_paid > 0:
        entry.status = "partial"

    if payload.note:
        entry.notes = (entry.notes or "") + f"\n[{datetime.utcnow().isoformat()}] {payload.note}"

    db.commit()
    db.refresh(entry)
    return entry


# ═══════════════════════════════════════════════════════
# DELETE — Only Admin+
# ═══════════════════════════════════════════════════════

@router.delete("/{entry_id}", status_code=204)
def delete_entry(
    entry_id: int,
    user: User = Depends(require_feature_permission("cashflow", "delete")),
    db: Session = Depends(get_db),
):
    entry = _apply_tenant_filter(
        db.query(CashflowEntry), user
    ).filter(CashflowEntry.id == entry_id).first()

    if not entry:
        raise HTTPException(404, "Entry not found")

    db.delete(entry)
    db.commit()
    return None