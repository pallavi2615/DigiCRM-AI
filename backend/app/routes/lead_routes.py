from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from fastapi import UploadFile, File
from fastapi.responses import StreamingResponse
import csv
import io
import json
from datetime import datetime

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.lead import Lead
from app.models.company import Company
from app.models.contact import Contact
from app.schemas.lead import (
    LeadCreate,
    LeadUpdate,
    LeadResponse,
    LeadStatusUpdate,
    LeadImportResult,
)

router = APIRouter(prefix="/leads", tags=["Leads"])


# ============================================================
# STATIC ROUTES (must come first)
# ============================================================

# ============ LIST ============
@router.get("", response_model=List[LeadResponse])
def list_leads(
    status_filter: Optional[str] = Query(None, alias="status"),
    source: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve leads for the current tenant with optional filters."""
    query = db.query(Lead)

    if user.role != "super_admin":
        query = query.filter(Lead.tenant_id == user.tenant_id)

    if status_filter:
        query = query.filter(Lead.status == status_filter)
    if source:
        query = query.filter(Lead.source == source)
    if search:
        query = query.filter(
            (Lead.name.ilike(f"%{search}%")) |
            (Lead.email.ilike(f"%{search}%")) |
            (Lead.phone.ilike(f"%{search}%"))
        )

    return query.order_by(desc(Lead.created_at)).offset(skip).limit(limit).all()


# ============ STATS ============
@router.get("/stats")
def lead_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return aggregated lead statistics."""
    query = db.query(Lead)
    if user.role != "super_admin":
        query = query.filter(Lead.tenant_id == user.tenant_id)

    return {
        "total": query.count(),
        "new": query.filter(Lead.status == "new").count(),
        "contacted": query.filter(Lead.status == "contacted").count(),
        "qualified": query.filter(Lead.status == "qualified").count(),
        "won": query.filter(Lead.status == "won").count(),
        "lost": query.filter(Lead.status == "lost").count(),
    }


# ============ EXPORT (STATIC) ============
@router.get("/export")
def export_leads(
    format: str = "csv",
    status: Optional[str] = None,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export leads in CSV or JSON format."""
    if format not in ("csv", "json"):
        raise HTTPException(400, "format must be 'csv' or 'json'")

    query = db.query(Lead)

    if user.role != "super_admin":
        query = query.filter(Lead.tenant_id == user.tenant_id)

    if status:
        query = query.filter(Lead.status == status)

    leads = query.order_by(desc(Lead.created_at)).all()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    # CSV EXPORT
    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "name", "email", "phone", "company",
            "status", "priority", "value", "source",
            "message", "created_at",
        ])
        for lead in leads:
            writer.writerow([
                lead.id, lead.name or "", lead.email or "",
                lead.phone or "", lead.company or "", lead.status or "",
                lead.priority or "",
                float(lead.value) if lead.value else 0,
                lead.source or "", lead.message or "",
                lead.created_at.isoformat() if lead.created_at else "",
            ])
        output.seek(0)
        filename = f"leads_export_{timestamp}.csv"
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename={filename}"},
        )

    # JSON EXPORT
    data = [
        {
            "id": lead.id, "name": lead.name, "email": lead.email,
            "phone": lead.phone, "company": lead.company,
            "status": lead.status, "priority": lead.priority,
            "value": float(lead.value) if lead.value else 0,
            "source": lead.source, "message": lead.message,
            "custom_fields": lead.custom_fields,
            "created_at": lead.created_at.isoformat() if lead.created_at else None,
        }
        for lead in leads
    ]
    filename = f"leads_export_{timestamp}.json"
    return StreamingResponse(
        iter([json.dumps(data, indent=2)]),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )


# ============ IMPORT (STATIC) ============
@router.post("/import", response_model=LeadImportResult)
async def import_leads(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Import leads from a CSV file."""
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    if not file.filename.endswith(".csv"):
        raise HTTPException(400, "Only CSV files are supported")

    content = await file.read()
    try:
        text = content.decode("utf-8")
    except UnicodeDecodeError:
        raise HTTPException(400, "File must be UTF-8 encoded")

    reader = csv.DictReader(io.StringIO(text))
    total_rows = 0
    imported = 0
    failed = 0
    errors: List[str] = []

    for row_num, row in enumerate(reader, start=2):
        total_rows += 1
        row = {k.strip().lower(): (v.strip() if v else None) for k, v in row.items()}

        name, email, phone = row.get("name"), row.get("email"), row.get("phone")

        if not any([name, email, phone]):
            failed += 1
            errors.append(f"Row {row_num}: Missing name, email, and phone")
            continue

        try:
            value = float(row.get("value") or 0)
        except (ValueError, TypeError):
            value = 0

        try:
            db.add(Lead(
                tenant_id=user.tenant_id, name=name, email=email, phone=phone,
                company=row.get("company"), message=row.get("message"),
                source=row.get("source") or "import",
                priority=row.get("priority") or "medium",
                value=value, status="new", custom_fields={},
            ))
            imported += 1
        except Exception as e:
            failed += 1
            errors.append(f"Row {row_num}: {str(e)}")

    db.commit()

    return LeadImportResult(
        total_rows=total_rows, imported=imported,
        failed=failed, errors=errors[:20],
    )


# ============ CREATE (STATIC) ============
@router.post("", response_model=LeadResponse, status_code=201)
def create_lead(
    payload: LeadCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a lead manually."""
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    lead = Lead(
        tenant_id=user.tenant_id, name=payload.name, email=payload.email,
        phone=payload.phone, company_name=payload.company, message=payload.message,
        source=payload.source or "manual", status="new",
        priority=payload.priority or "medium", estimated_value=payload.value or 0,
        assigned_to=payload.assigned_to, custom_fields=payload.custom_fields or {},
    )
    db.add(lead)
    db.commit()
    db.refresh(lead)
    return lead


# ============================================================
# DYNAMIC ROUTES (must come last)
# ============================================================

# ============ GET SINGLE ============
@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a single lead by ID with enriched company/contact info."""
    query = db.query(Lead).filter(Lead.id == lead_id)
    if user.role != "super_admin":
        query = query.filter(Lead.tenant_id == user.tenant_id)

    lead = query.first()
    if not lead:
        raise HTTPException(404, "Lead not found")

    # ⭐ Enrich with company/contact names
    response = LeadResponse.model_validate(lead)

    if lead.company_id:
        company = db.query(Company).filter(Company.id == lead.company_id).first()
        if company:
            response.company_name = company.name

    if lead.contact_id:
        contact = db.query(Contact).filter(Contact.id == lead.contact_id).first()
        if contact:
            full_name = f"{contact.first_name or ''} {contact.last_name or ''}".strip()
            response.contact_name = full_name or None

    return response

# ============ UPDATE ============
@router.put("/{lead_id}", response_model=LeadResponse)
def update_lead(
    lead_id: int,
    payload: LeadUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a lead."""
    query = db.query(Lead).filter(Lead.id == lead_id)
    if user.role != "super_admin":
        query = query.filter(Lead.tenant_id == user.tenant_id)

    lead = query.first()
    if not lead:
        raise HTTPException(404, "Lead not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lead, key, value)

    db.commit()
    db.refresh(lead)
    return lead


# ============ PATCH STATUS ============
@router.patch("/{lead_id}/status", response_model=LeadResponse)
def update_lead_status(
    lead_id: int,
    payload: LeadStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update only the status field of a lead."""
    query = db.query(Lead).filter(Lead.id == lead_id)
    if user.role != "super_admin":
        query = query.filter(Lead.tenant_id == user.tenant_id)

    lead = query.first()
    if not lead:
        raise HTTPException(404, "Lead not found")

    lead.status = payload.status
    db.commit()
    db.refresh(lead)
    return lead


# ============ DELETE ============
@router.delete("/{lead_id}", status_code=204)
def delete_lead(
    lead_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a lead."""
    query = db.query(Lead).filter(Lead.id == lead_id)
    if user.role != "super_admin":
        query = query.filter(Lead.tenant_id == user.tenant_id)

    lead = query.first()
    if not lead:
        raise HTTPException(404, "Lead not found")

    db.delete(lead)
    db.commit()
    return None

