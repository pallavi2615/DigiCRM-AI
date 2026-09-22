from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func
from typing import Optional, List
from fastapi.responses import StreamingResponse
import csv
import io
from datetime import datetime

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.company import Company
from app.schemas.company import (
    CompanyCreate,
    CompanyUpdate,
    CompanyResponse,
    CompanyImportResult,
)

router = APIRouter(prefix="/companies", tags=["Companies"])

SUPER_ADMIN_ROLE = "super_admin"


def _apply_tenant_filter(query, user: User):
    if user.role != SUPER_ADMIN_ROLE:
        query = query.filter(Company.tenant_id == user.tenant_id)
    return query


def _get_company_or_404(db: Session, company_id: int, user: User) -> Company:
    company = _apply_tenant_filter(
        db.query(Company), user
    ).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(404, "Company not found")
    return company


# ============ STATS ============
@router.get("/stats")
def company_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(Company), user)
    total_revenue = query.with_entities(func.sum(Company.revenue)).scalar() or 0
    total_employees = query.with_entities(func.sum(Company.employees)).scalar() or 0

    return {
        "total": query.count(),
        "active": query.filter(Company.status == "active").count(),
        "total_revenue": float(total_revenue),
        "total_employees": int(total_employees),
    }


# ============ LIST ============
@router.get("", response_model=List[CompanyResponse])
def list_companies(
    search: Optional[str] = None,
    industry: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(Company), user)
    if industry:
        query = query.filter(Company.industry == industry)
    if status:
        query = query.filter(Company.status == status)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Company.name.ilike(pattern),
                Company.industry.ilike(pattern),
                Company.location.ilike(pattern),
            )
        )
    return query.order_by(desc(Company.created_at)).offset(skip).limit(limit).all()


# ============ EXPORT ============
@router.get("/export")
def export_companies(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    companies = _apply_tenant_filter(db.query(Company), user).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["id", "name", "industry", "location", "employees", "revenue", "website", "phone", "email"])
    for c in companies:
        writer.writerow([c.id, c.name or "", c.industry or "", c.location or "", c.employees or 0, float(c.revenue or 0), c.website or "", c.phone or "", c.email or ""])
    output.seek(0)
    filename = f"companies_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(iter([output.getvalue()]), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})


# ============ IMPORT ============
@router.post("/import", response_model=CompanyImportResult)
async def import_companies(
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
        name = row.get("name")
        if not name:
            failed += 1
            errors.append(f"Row {row_num}: Missing name")
            continue
        try:
            db.add(Company(tenant_id=user.tenant_id, name=name, industry=row.get("industry"), location=row.get("location"), website=row.get("website"), phone=row.get("phone"), email=row.get("email")))
            imported += 1
        except Exception as e:
            failed += 1
            errors.append(f"Row {row_num}: {e}")
    db.commit()
    return CompanyImportResult(total_rows=total_rows, imported=imported, failed=failed, errors=errors[:20])


# ============ GET SINGLE ============
@router.get("/{company_id}", response_model=CompanyResponse)
def get_company(company_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return _get_company_or_404(db, company_id, user)


# ============ CREATE ============
@router.post("", response_model=CompanyResponse, status_code=201)
def create_company(
    payload: CompanyCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")
    company = Company(
        tenant_id=user.tenant_id,
        name=payload.name,
        industry=payload.industry,
        location=payload.location,
        employees=payload.employees or 0,
        revenue=payload.revenue or 0,
        website=payload.website,
        phone=payload.phone,
        email=payload.email,
        notes=payload.notes,
        logo_url=payload.logo_url,
        owner_id=payload.owner_id,
        tags=payload.tags or [],
        status=payload.status or "active",
    )
    db.add(company)
    db.commit()
    db.refresh(company)
    return company


# ============ UPDATE ============
@router.put("/{company_id}", response_model=CompanyResponse)
def update_company(
    company_id: int,
    payload: CompanyUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    company = _get_company_or_404(db, company_id, user)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(company, key, value)
    db.commit()
    db.refresh(company)
    return company


# ============ DELETE ============
@router.delete("/{company_id}", status_code=204)
def delete_company(company_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    company = _get_company_or_404(db, company_id, user)
    db.delete(company)
    db.commit()
    return None