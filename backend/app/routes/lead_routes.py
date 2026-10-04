from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from fastapi import UploadFile, File
from fastapi.responses import StreamingResponse
import csv
import io
import json
import logging
from io import StringIO
from datetime import datetime
from decimal import Decimal 

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.permissions import require_feature_permission
from app.core.constants import SUPER_ADMIN_ROLE as SA_CONST
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService   # ⭐ NEW
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

logger = logging.getLogger(__name__)                                # ⭐ NEW

router = APIRouter(prefix="/leads", tags=["Leads"])


# ============================================================
# STATIC ROUTES
# ============================================================

# ============ LIST ============
@router.get("", response_model=List[LeadResponse])
def list_leads(
    status_filter: Optional[str] = Query(None, alias="status"),
    source: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(require_feature_permission("leads", "view")),
    db: Session = Depends(get_db),
):
    """Retrieve leads for the current tenant with optional filters."""
    query = db.query(Lead)

    if user.role != SA_CONST:
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
    user: User = Depends(require_feature_permission("leads", "view")),
    db: Session = Depends(get_db),
):
    """Return aggregated lead statistics."""
    query = db.query(Lead)
    if user.role != SA_CONST:
        query = query.filter(Lead.tenant_id == user.tenant_id)

    return {
        "total": query.count(),
        "new": query.filter(Lead.status == "new").count(),
        "contacted": query.filter(Lead.status == "contacted").count(),
        "qualified": query.filter(Lead.status == "qualified").count(),
        "won": query.filter(Lead.status == "won").count(),
        "lost": query.filter(Lead.status == "lost").count(),
    }


# ============ EXPORT ============
@router.get("/export")
def export_leads(
    format: str = "csv",
    status: Optional[str] = None,
    user: User = Depends(require_feature_permission("leads", "view")),
    db: Session = Depends(get_db),
):
    """Export leads in CSV or JSON format."""
    if format not in ("csv", "json"):
        raise HTTPException(400, "format must be 'csv' or 'json'")

    query = db.query(Lead)
    if user.role != SA_CONST:
        query = query.filter(Lead.tenant_id == user.tenant_id)
    if status:
        query = query.filter(Lead.status == status)

    leads = query.order_by(desc(Lead.created_at)).all()
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    if format == "csv":
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id", "name", "email", "phone", "company_name",
            "status", "priority", "estimated_value", "source",
            "message", "created_at",
        ])
        for lead in leads:
            writer.writerow([
                lead.id, lead.name or "", lead.email or "",
                lead.phone or "", lead.company_name or "", lead.status or "",
                lead.priority or "",
                float(lead.estimated_value) if lead.estimated_value else 0,
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

    data = [
        {
            "id": lead.id, "name": lead.name, "email": lead.email,
            "phone": lead.phone, "company_name": lead.company_name,
            "status": lead.status, "priority": lead.priority,
            "estimated_value": float(lead.estimated_value) if lead.estimated_value else 0,
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


# ============ IMPORT ============
# @router.post("/import", response_model=LeadImportResult)
# async def import_leads(
#     file: UploadFile = File(...),
#     user: User = Depends(require_feature_permission("leads", "create")),
#     db: Session = Depends(get_db),
# ):
#     """Import leads from a CSV file."""
#     if not user.tenant_id:
#         raise HTTPException(400, "User has no tenant")
#     if not file.filename.endswith(".csv"):
#         raise HTTPException(400, "Only CSV files are supported")

#     content = await file.read()
#     try:
#         text = content.decode("utf-8")
#     except UnicodeDecodeError:
#         raise HTTPException(400, "File must be UTF-8 encoded")

#     reader = csv.DictReader(io.StringIO(text))
#     total_rows = 0
#     imported = 0
#     failed = 0
#     errors: List[str] = []

#     for row_num, row in enumerate(reader, start=2):
#         total_rows += 1
#         row = {k.strip().lower(): (v.strip() if v else None) for k, v in row.items()}

#         name, email, phone = row.get("name"), row.get("email"), row.get("phone")
#         if not any([name, email, phone]):
#             failed += 1
#             errors.append(f"Row {row_num}: Missing name, email, and phone")
#             continue

#         try:
#             value = float(row.get("value") or 0)
#         except (ValueError, TypeError):
#             value = 0

#         try:
#             db.add(Lead(
#                 tenant_id=user.tenant_id,
#                 name=name, email=email, phone=phone,
#                 company_name=row.get("company") or row.get("company_name"),
#                 message=row.get("message"),
#                 source=row.get("source") or "import",
#                 priority=row.get("priority") or "medium",
#                 estimated_value=value,
#                 status="new",
#                 custom_fields={},
#             ))
#             imported += 1
#         except Exception as e:
#             failed += 1
#             errors.append(f"Row {row_num}: {str(e)}")

#     db.commit()

#     return LeadImportResult(
#         total_rows=total_rows,
#         imported=imported,
#         failed=failed,
#         errors=errors[:20],
#     )

@router.post("/import", response_model=LeadImportResult)
async def import_leads(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    tenant_id = current_user.tenant_id
    content = (await file.read()).decode("utf-8-sig")
    reader = csv.DictReader(StringIO(content))

    # Whitelist: only these keys go to LeadCreate / Lead
    LEAD_COLUMNS = {
        "name", "email", "phone", "company_name", "designation", "website",
        "industry", "country", "city", "message", "contact_person",
        "source", "status", "priority", "industry_group",
        "estimated_value", "expected_close_date",
        "company_id", "contact_id", "assigned_to",
        "score", "custom_fields",
    }

    total_rows = 0
    imported = 0
    failed = 0
    errors = []

    for idx, row in enumerate(reader, start=2):
        total_rows += 1
        try:
            # 1. Trim + empty → None
            cleaned = {
                k: (v.strip() if isinstance(v, str) and v.strip() != "" else None)
                for k, v in row.items()
            }

            # 2. Drop unknown keys
            cleaned = {k: v for k, v in cleaned.items() if k in LEAD_COLUMNS}

            # 3. custom_fields
            if cleaned.get("custom_fields"):
                try:
                    cleaned["custom_fields"] = json.loads(cleaned["custom_fields"])
                except (json.JSONDecodeError, TypeError):
                    cleaned["custom_fields"] = {}

            # 4. expected_close_date
            if cleaned.get("expected_close_date"):
                try:
                    cleaned["expected_close_date"] = datetime.strptime(
                        str(cleaned["expected_close_date"]), "%Y-%m-%d"
                    ).date()
                except (ValueError, TypeError):
                    cleaned["expected_close_date"] = None

            # 5. estimated_value
            if cleaned.get("estimated_value") is not None:
                try:
                    cleaned["estimated_value"] = Decimal(str(cleaned["estimated_value"]))
                except (ValueError, TypeError):
                    cleaned["estimated_value"] = Decimal("0")

            # 6. ints
            for f in ("assigned_to", "company_id", "contact_id", "score"):
                if cleaned.get(f) is not None:
                    try:
                        cleaned[f] = int(cleaned[f])
                    except (ValueError, TypeError):
                        cleaned[f] = None

            # 7. Pydantic validation
            lead_in = LeadCreate(**cleaned)

            # ✅ 8. SAVEPOINT — per-row transaction
            nested = db.begin_nested()
            try:
                lead = Lead(
                    **lead_in.model_dump(exclude_none=True),
                    tenant_id=tenant_id,
                    status="new",
                    score=0,
                )
                db.add(lead)
                db.flush()
                nested.commit()          # ✅ Release savepoint (row saved)
                imported += 1
            except Exception:
                nested.rollback()        # ✅ Sirf ye row undo, baaki safe
                raise

        except Exception as e:
            failed += 1
            errors.append(f"Row {idx}: {str(e)}")
            continue                      # ❌ db.rollback() NAHI karna

    # ✅ Final commit — saari successful rows DB mein
    try:
        db.commit()
    except Exception as e:
        db.rollback()
        return LeadImportResult(
            total_rows=total_rows,
            imported=0,
            failed=total_rows,
            errors=[f"Commit failed: {str(e)}"],
        )

    return LeadImportResult(
        total_rows=total_rows,
        imported=imported,
        failed=failed,
        errors=errors,
    )

# ============ CREATE ============
@router.post("", response_model=LeadResponse, status_code=201)
def create_lead(
    payload: LeadCreate,
    request: Request,
    user: User = Depends(require_feature_permission("leads", "create")),
    db: Session = Depends(get_db),
):
    """Create a lead manually."""
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    lead = Lead(
        tenant_id=user.tenant_id,
        name=payload.name,
        email=payload.email,
        phone=payload.phone,
        company_name=payload.company,
        message=payload.message,
        source=payload.source or "manual",
        status="new",
        priority=payload.priority or "medium",
        estimated_value=payload.estimated_value or 0,
        assigned_to=payload.assigned_to,
        custom_fields=payload.custom_fields or {},
    )
    db.add(lead)
    db.flush()

    # Audit log
    AuditService(db).log_created_obj(
        entity_obj=lead,
        tenant_id=user.tenant_id,
        user=user,
        request=request,
    )

    # ⭐ NOTIFICATION: notify assignee if assigned at creation
    if lead.assigned_to and lead.assigned_to != user.id:
        try:
            NotificationService(db).notify_lead_assigned(
                user_id=lead.assigned_to,
                tenant_id=user.tenant_id,
                lead_id=lead.id,
                lead_name=lead.name or lead.email or f"Lead #{lead.id}",
            )
        except Exception as e:
            logger.exception("Failed to create lead assignment notification: %s", e)

    db.commit()
    db.refresh(lead)
    return lead


# ============================================================
# DYNAMIC ROUTES
# ============================================================

# ============ GET SINGLE ============
@router.get("/{lead_id}", response_model=LeadResponse)
def get_lead(
    lead_id: int,
    user: User = Depends(require_feature_permission("leads", "view")),
    db: Session = Depends(get_db),
):
    """Retrieve a single lead by ID with enriched company/contact info."""
    query = db.query(Lead).filter(Lead.id == lead_id)
    if user.role != SA_CONST:
        query = query.filter(Lead.tenant_id == user.tenant_id)

    lead = query.first()
    if not lead:
        raise HTTPException(404, "Lead not found")

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
    request: Request,
    user: User = Depends(require_feature_permission("leads", "edit")),
    db: Session = Depends(get_db),
):
    """Update a lead. Sends notification if assigned_to changes."""
    query = db.query(Lead).filter(Lead.id == lead_id)
    if user.role != SA_CONST:
        query = query.filter(Lead.tenant_id == user.tenant_id)

    lead = query.first()
    if not lead:
        raise HTTPException(404, "Lead not found")

    # Snapshot before
    before = {c.name: getattr(lead, c.name) for c in lead.__table__.columns}
    old_assigned_to = lead.assigned_to                                  # ⭐

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(lead, key, value)
    db.flush()

    # Snapshot after
    after = {c.name: getattr(lead, c.name) for c in lead.__table__.columns}

    # Audit log
    svc = AuditService(db)
    changes = svc.diff(before, after, ignore_fields=["updated_at"])
    if changes:
        svc.log_updated_obj(
            entity_obj=lead,
            tenant_id=lead.tenant_id,
            user=user,
            changes=changes,
            request=request,
        )

    # ⭐ NOTIFICATION: notify new assignee if assignment changed
    new_assigned_to = lead.assigned_to                                  # ⭐
    if new_assigned_to and new_assigned_to != old_assigned_to:          # ⭐
        try:
            NotificationService(db).notify_lead_assigned(
                user_id=new_assigned_to,
                tenant_id=lead.tenant_id,
                lead_id=lead.id,
                lead_name=lead.name or lead.email or f"Lead #{lead.id}",
            )
        except Exception as e:
            logger.exception("Failed to create lead assignment notification: %s", e)

    db.commit()
    db.refresh(lead)
    return lead


# ============ PATCH STATUS ============
@router.patch("/{lead_id}/status", response_model=LeadResponse)
def update_lead_status(
    lead_id: int,
    payload: LeadStatusUpdate,
    request: Request,
    user: User = Depends(require_feature_permission("leads", "edit")),
    db: Session = Depends(get_db),
):
    """Update only the status field of a lead."""
    query = db.query(Lead).filter(Lead.id == lead_id)
    if user.role != SA_CONST:
        query = query.filter(Lead.tenant_id == user.tenant_id)

    lead = query.first()
    if not lead:
        raise HTTPException(404, "Lead not found")

    old_status = lead.status
    lead.status = payload.status

    if old_status != payload.status:
        AuditService(db).log_updated_obj(
            entity_obj=lead,
            tenant_id=lead.tenant_id,
            user=user,
            changes={"status": {"before": old_status, "after": payload.status}},
            request=request,
        )

    db.commit()
    db.refresh(lead)
    return lead


# ============ DELETE ============
@router.delete("/{lead_id}", status_code=204)
def delete_lead(
    lead_id: int,
    request: Request,
    user: User = Depends(require_feature_permission("leads", "delete")),
    db: Session = Depends(get_db),
):
    """Delete a lead."""
    query = db.query(Lead).filter(Lead.id == lead_id)
    if user.role != SA_CONST:
        query = query.filter(Lead.tenant_id == user.tenant_id)

    lead = query.first()
    if not lead:
        raise HTTPException(404, "Lead not found")

    AuditService(db).log_deleted_obj(
        entity_obj=lead,
        tenant_id=lead.tenant_id,
        user=user,
        request=request,
    )

    db.delete(lead)
    db.commit()
    return None