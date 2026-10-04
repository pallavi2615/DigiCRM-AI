"""
Payments & Ledger API.

Role-based access:
    - Super Admin, Admin: full access (CRUD)
    - Manager: view only
    - Sales Executive: no access
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional
from datetime import date

from app.db.database import get_db
from app.core.permissions import require_feature_permission
from app.models.user import User
from app.models.payment import PaymentEntry, BankAccount
from app.schemas.payment import (
    PaymentEntryCreate,
    PaymentEntryUpdate,
    PaymentEntryResponse,
    PaymentListResponse,
    PaymentStats,
    BankAccountCreate,
    BankAccountResponse,
)

router = APIRouter(prefix="/payments", tags=["Payments"])


def _apply_tenant_filter(query, user: User):
    if user.role != "super_admin":
        query = query.filter(PaymentEntry.tenant_id == user.tenant_id)
    return query


# ═══════════════════════════════════════════════════════
# LIST — Manager can view
# ═══════════════════════════════════════════════════════

@router.get("/entries", response_model=PaymentListResponse)
def list_entries(
    direction: Optional[str] = Query(None, pattern="^(in|out)$"),
    category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(require_feature_permission("payments", "view")),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(PaymentEntry), user)

    if direction:
        query = query.filter(PaymentEntry.direction == direction)
    if category:
        query = query.filter(PaymentEntry.category == category)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            PaymentEntry.party.ilike(pattern) | PaymentEntry.memo.ilike(pattern)
        )

    total = query.count()
    rows = (
        query.order_by(desc(PaymentEntry.entry_date), desc(PaymentEntry.id))
        .offset(skip).limit(limit).all()
    )

    return PaymentListResponse(
        data=[PaymentEntryResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


# ═══════════════════════════════════════════════════════
# STATS — KPI cards
# ═══════════════════════════════════════════════════════

@router.get("/stats", response_model=PaymentStats)
def payment_stats(
    user: User = Depends(require_feature_permission("payments", "view")),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(PaymentEntry), user)

    money_in = (
        query.filter(PaymentEntry.direction == "in")
        .with_entities(func.coalesce(func.sum(PaymentEntry.amount), 0))
        .scalar() or 0
    )
    money_out = (
        query.filter(PaymentEntry.direction == "out")
        .with_entities(func.coalesce(func.sum(PaymentEntry.amount), 0))
        .scalar() or 0
    )
    entries_count = query.count()

    # Bank balance = sum of opening balances + (money_in - money_out)
    opening_q = db.query(func.coalesce(func.sum(BankAccount.opening_balance), 0))
    if user.role != "super_admin":
        opening_q = opening_q.filter(BankAccount.tenant_id == user.tenant_id)
    opening_balance = float(opening_q.scalar() or 0)

    return PaymentStats(
        money_in=float(money_in),
        money_out=float(money_out),
        net=float(money_in) - float(money_out),
        bank_balance=opening_balance + float(money_in) - float(money_out),
        entries_count=entries_count,
    )


# ═══════════════════════════════════════════════════════
# GET SINGLE
# ═══════════════════════════════════════════════════════

@router.get("/entries/{entry_id}", response_model=PaymentEntryResponse)
def get_entry(
    entry_id: int,
    user: User = Depends(require_feature_permission("payments", "view")),
    db: Session = Depends(get_db),
):
    entry = (
        _apply_tenant_filter(db.query(PaymentEntry), user)
        .filter(PaymentEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(404, "Entry not found")
    return entry


# ═══════════════════════════════════════════════════════
# CREATE — Admin+ only
# ═══════════════════════════════════════════════════════

@router.post("/entries", response_model=PaymentEntryResponse, status_code=201)
def create_entry(
    payload: PaymentEntryCreate,
    user: User = Depends(require_feature_permission("payments", "create")),
    db: Session = Depends(get_db),
):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    entry = PaymentEntry(
        tenant_id=user.tenant_id,
        direction=payload.direction,
        category=payload.category,
        party=payload.party,
        amount=payload.amount,
        utr=payload.utr,
        memo=payload.memo,
        bank_account_id=payload.bank_account_id,
        entry_date=payload.entry_date or date.today(),
        created_by=user.id,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return entry


# ═══════════════════════════════════════════════════════
# UPDATE — Admin+
# ═══════════════════════════════════════════════════════

@router.put("/entries/{entry_id}", response_model=PaymentEntryResponse)
def update_entry(
    entry_id: int,
    payload: PaymentEntryUpdate,
    user: User = Depends(require_feature_permission("payments", "edit")),
    db: Session = Depends(get_db),
):
    entry = (
        _apply_tenant_filter(db.query(PaymentEntry), user)
        .filter(PaymentEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(404, "Entry not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(entry, key, value)

    db.commit()
    db.refresh(entry)
    return entry


# ═══════════════════════════════════════════════════════
# DELETE — Admin+
# ═══════════════════════════════════════════════════════

@router.delete("/entries/{entry_id}", status_code=204)
def delete_entry(
    entry_id: int,
    user: User = Depends(require_feature_permission("payments", "delete")),
    db: Session = Depends(get_db),
):
    entry = (
        _apply_tenant_filter(db.query(PaymentEntry), user)
        .filter(PaymentEntry.id == entry_id)
        .first()
    )
    if not entry:
        raise HTTPException(404, "Entry not found")

    db.delete(entry)
    db.commit()
    return None


# ═══════════════════════════════════════════════════════
# BANK ACCOUNTS
# ═══════════════════════════════════════════════════════

@router.get("/bank-accounts", response_model=list[BankAccountResponse])
def list_bank_accounts(
    user: User = Depends(require_feature_permission("payments", "view")),
    db: Session = Depends(get_db),
):
    q = db.query(BankAccount).filter(BankAccount.is_active == 1)
    if user.role != "super_admin":
        q = q.filter(BankAccount.tenant_id == user.tenant_id)
    return q.all()


@router.post("/bank-accounts", response_model=BankAccountResponse, status_code=201)
def create_bank_account(
    payload: BankAccountCreate,
    user: User = Depends(require_feature_permission("payments", "create")),
    db: Session = Depends(get_db),
):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    account = BankAccount(
        tenant_id=user.tenant_id,
        name=payload.name,
        account_number=payload.account_number,
        ifsc=payload.ifsc,
        opening_balance=payload.opening_balance or 0,
    )
    db.add(account)
    db.commit()
    db.refresh(account)
    return account