from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from typing import Optional, List
from fastapi.responses import StreamingResponse
import csv
import io
from datetime import datetime

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.contact import Contact
from app.schemas.contact import (
    ContactCreate,
    ContactUpdate,
    ContactResponse,
    ContactImportResult,
)

router = APIRouter(prefix="/contacts", tags=["Contacts"])

SUPER_ADMIN_ROLE = "super_admin"


def _apply_tenant_filter(query, user: User):
    if user.role != SUPER_ADMIN_ROLE:
        query = query.filter(Contact.tenant_id == user.tenant_id)
    return query


def _get_contact_or_404(db: Session, contact_id: int, user: User) -> Contact:
    contact = _apply_tenant_filter(
        db.query(Contact), user
    ).filter(Contact.id == contact_id).first()
    if not contact:
        raise HTTPException(404, "Contact not found")
    return contact


# ============ STATS ============
@router.get("/stats")
def contact_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = _apply_tenant_filter(db.query(Contact), user)
    return {
        "total": query.count(),
        "active": query.filter(Contact.status == "active").count(),
    }


# ============ LIST ============
@router.get("", response_model=List[ContactResponse])
def list_contacts(
    search: Optional[str] = None,
    company_id: Optional[int] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(Contact), user)
    if company_id:
        query = query.filter(Contact.company_id == company_id)
    if status:
        query = query.filter(Contact.status == status)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Contact.first_name.ilike(pattern),
                Contact.last_name.ilike(pattern),
                Contact.email.ilike(pattern),
                Contact.phone.ilike(pattern),
            )
        )
    return query.order_by(desc(Contact.created_at)).offset(skip).limit(limit).all()


# ============ EXPORT ============
@router.get("/export")
def export_contacts(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contacts = _apply_tenant_filter(db.query(Contact), user).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "first_name", "last_name", "designation", "email", "phone", "company_id"])
    for c in contacts:
        writer.writerow([c.id, c.first_name or "", c.last_name or "", c.designation or "", c.email or "", c.phone or "", c.company_id or ""])
    output.seek(0)
    filename = f"contacts_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})


# ============ IMPORT ============
@router.post("/import", response_model=ContactImportResult)
async def import_contacts(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")
    content = await file.read()
    reader = csv.DictReader(io.StringIO(content.decode("utf-8")))
    total_rows = imported = failed = 0
    errors: List[str] = []
    for row_num, row in enumerate(reader, start=2):
        total_rows += 1
        row = {k.strip().lower(): (v.strip() if v else None) for k, v in row.items()}
        first_name = row.get("first_name") or row.get("firstname") or row.get("name")
        if not first_name:
            failed += 1
            errors.append(f"Row {row_num}: Missing first_name")
            continue
        try:
            db.add(Contact(
                tenant_id=user.tenant_id,
                first_name=first_name,
                last_name=row.get("last_name") or row.get("lastname"),
                designation=row.get("designation"),
                email=row.get("email"),
                phone=row.get("phone"),
            ))
            imported += 1
        except Exception as e:
            failed += 1
            errors.append(f"Row {row_num}: {e}")
    db.commit()
    return ContactImportResult(total_rows=total_rows, imported=imported, failed=failed, errors=errors[:20])


# ============ GET SINGLE ============
@router.get("/{contact_id}", response_model=ContactResponse)
def get_contact(contact_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_contact_or_404(db, contact_id, user)


# ============ CREATE ============
@router.post("", response_model=ContactResponse, status_code=201)
def create_contact(
    payload: ContactCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")
    contact = Contact(
        tenant_id=user.tenant_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        designation=payload.designation,
        email=payload.email,
        phone=payload.phone,
        company_id=payload.company_id,
        notes=payload.notes,
        linkedin_url=payload.linkedin_url,
        avatar_url=payload.avatar_url,
        owner_id=payload.owner_id,
        tags=payload.tags or [],
        status=payload.status or "active",
    )
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact


# ============ UPDATE ============
@router.put("/{contact_id}", response_model=ContactResponse)
def update_contact(
    contact_id: int,
    payload: ContactUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    contact = _get_contact_or_404(db, contact_id, user)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(contact, key, value)
    db.commit()
    db.refresh(contact)
    return contact


# ============ DELETE ============
@router.delete("/{contact_id}", status_code=204)
def delete_contact(contact_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    contact = _get_contact_or_404(db, contact_id, user)
    db.delete(contact)
    db.commit()
    return None