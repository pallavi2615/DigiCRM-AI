import os
import uuid
import logging                                                     # ⭐
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func
from typing import Optional, List
from datetime import datetime, timedelta

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.permissions import require_feature_permission
from app.core.constants import SUPER_ADMIN_ROLE as SA_CONST
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService   # ⭐
from app.models.user import User
from app.models.ticket import Ticket, TicketMessage, TicketAttachment
from app.schemas.ticket import (
    TicketCreate, TicketUpdate, TicketStatusUpdate,
    TicketResponse, TicketDetailResponse, TicketStats,
    TicketMessageCreate, TicketMessageResponse,
    TicketAttachmentResponse,
)

logger = logging.getLogger(__name__)                                # ⭐

router = APIRouter(prefix="/tickets", tags=["Tickets"])

SUPER_ADMIN_ROLE = "super_admin"

UPLOAD_DIR = "uploads/tickets"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain", "text/csv",
]
MAX_FILE_SIZE = 10 * 1024 * 1024

SLA_HOURS = {
    "urgent": 4,
    "high": 8,
    "medium": 24,
    "low": 72,
}


# ============================================================
# HELPERS
# ============================================================

def _apply_tenant_filter(query, user: User):
    if user.role != SA_CONST:
        query = query.filter(Ticket.tenant_id == user.tenant_id)
    return query


def _get_ticket_or_404(db: Session, ticket_id: int, user: User) -> Ticket:
    ticket = _apply_tenant_filter(db.query(Ticket), user).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    return ticket


def _generate_ticket_number(db: Session, tenant_id: int) -> str:
    count = db.query(func.count(Ticket.id)).filter(Ticket.tenant_id == tenant_id).scalar() or 0
    return f"TKT-{count + 1:04d}"


def _calculate_sla(priority: str) -> datetime:
    hours = SLA_HOURS.get(priority.lower(), 24)
    return datetime.utcnow() + timedelta(hours=hours)


# ⭐ NEW — SLA breach checker
def _check_and_flag_sla_breach(db: Session, ticket: Ticket) -> None:
    """
    If SLA due time has passed and ticket isn't already flagged/resolved,
    mark breached and notify the assignee (or created_by).
    """
    if not ticket.sla_due_at:
        return
    if ticket.sla_breached:
        return
    if ticket.status in ("resolved", "closed"):
        return

    now = datetime.utcnow()
    due = ticket.sla_due_at
    # Normalize naive vs tz-aware
    if due.tzinfo is not None:
        due = due.replace(tzinfo=None)

    if now <= due:
        return  # not breached yet

    ticket.sla_breached = True

    target_user_id = ticket.assigned_to or ticket.created_by
    if target_user_id:
        try:
            NotificationService(db).notify_sla_breach(
                user_id=target_user_id,
                tenant_id=ticket.tenant_id,
                ticket_id=ticket.id,
                ticket_number=ticket.ticket_number or f"Ticket #{ticket.id}",
            )
        except Exception as e:
            logger.exception("Failed to notify SLA breach: %s", e)


def _run_sla_check_on_list(db: Session, tickets: List[Ticket]) -> None:
    """Run SLA check on a batch, commit once if anything changed."""
    changed = False
    for t in tickets:
        before = t.sla_breached
        _check_and_flag_sla_breach(db, t)
        if t.sla_breached != before:
            changed = True
    if changed:
        try:
            db.commit()
        except Exception as e:
            logger.exception("SLA check commit failed: %s", e)
            db.rollback()


# ============================================================
# LIST
# ============================================================

@router.get("", response_model=List[TicketResponse])
def list_tickets(
    status: Optional[str] = None,
    industry_group: Optional[str] = None,
    priority: Optional[str] = None,
    urgency: Optional[str] = None,
    assigned_to: Optional[int] = None,
    sla_breached: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(require_feature_permission("tasks", "view")),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(Ticket), user)

    if status:
        query = query.filter(Ticket.status == status)
    if industry_group:
        query = query.filter(Ticket.industry_group == industry_group)
    if priority:
        query = query.filter(Ticket.priority == priority)
    if urgency:
        query = query.filter(Ticket.urgency == urgency)
    if assigned_to:
        query = query.filter(Ticket.assigned_to == assigned_to)
    if sla_breached is not None:
        query = query.filter(Ticket.sla_breached == sla_breached)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(
                Ticket.subject.ilike(pattern),
                Ticket.requester_email.ilike(pattern),
                Ticket.ticket_number.ilike(pattern),
            )
        )

    tickets = (
        query.order_by(desc(Ticket.created_at))
        .offset(skip).limit(limit).all()
    )

    # ⭐ Check SLA on the batch
    _run_sla_check_on_list(db, tickets)

    return tickets


# ============================================================
# STATS
# ============================================================

@router.get("/stats", response_model=TicketStats)
def ticket_stats(
    user: User = Depends(require_feature_permission("tasks", "view")),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(Ticket), user)
    return TicketStats(
        all=query.count(),
        open=query.filter(Ticket.status == "open").count(),
        pending=query.filter(Ticket.status == "pending").count(),
        resolved=query.filter(Ticket.status == "resolved").count(),
        closed=query.filter(Ticket.status == "closed").count(),
        sla_breached=query.filter(Ticket.sla_breached == True).count(),
    )


# ============================================================
# GET SINGLE
# ============================================================

@router.get("/{ticket_id}", response_model=TicketDetailResponse)
def get_ticket(
    ticket_id: int,
    user: User = Depends(require_feature_permission("tasks", "view")),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(db, ticket_id, user)

    # ⭐ Check SLA on this specific ticket
    before = ticket.sla_breached
    _check_and_flag_sla_breach(db, ticket)
    if ticket.sla_breached != before:
        db.commit()
        db.refresh(ticket)

    messages = (
        db.query(TicketMessage)
        .filter(TicketMessage.ticket_id == ticket.id)
        .order_by(TicketMessage.created_at)
        .all()
    )

    attachments = (
        db.query(TicketAttachment)
        .filter(TicketAttachment.ticket_id == ticket.id)
        .all()
    )

    data = TicketDetailResponse.model_validate(ticket).model_dump()
    data["messages"] = [TicketMessageResponse.model_validate(m) for m in messages]
    data["attachments"] = [TicketAttachmentResponse.model_validate(a) for a in attachments]
    return data


# ============================================================
# CREATE
# ============================================================

@router.post("", response_model=TicketResponse, status_code=201)
def create_ticket(
    payload: TicketCreate,
    request: Request,
    user: User = Depends(require_feature_permission("tasks", "create")),
    db: Session = Depends(get_db),
):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    ticket = Ticket(
        tenant_id=user.tenant_id,
        subject=payload.subject,
        description=payload.description,
        ticket_number=_generate_ticket_number(db, user.tenant_id),
        requester_name=payload.requester_name,
        requester_email=payload.requester_email,
        requester_phone=payload.requester_phone,
        requester_id=payload.requester_id,
        status="open",
        priority=payload.priority or "medium",
        urgency=payload.urgency or "medium",
        category=payload.category,
        assigned_to=payload.assigned_to,
        created_by=user.id,
        sla_due_at=_calculate_sla(payload.priority or "medium"),
        tags=payload.tags or [],
        custom_fields=payload.custom_fields or {},
    )
    db.add(ticket)
    db.flush()

    AuditService(db).log_created_obj(
        entity_obj=ticket,
        tenant_id=user.tenant_id,
        user=user,
        request=request,
    )

    db.commit()
    db.refresh(ticket)
    return ticket


# ============================================================
# UPDATE
# ============================================================

@router.put("/{ticket_id}", response_model=TicketResponse)
def update_ticket(
    ticket_id: int,
    payload: TicketUpdate,
    request: Request,
    user: User = Depends(require_feature_permission("tasks", "edit")),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(db, ticket_id, user)

    before = {c.name: getattr(ticket, c.name) for c in ticket.__table__.columns}

    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("status") == "resolved" and ticket.status != "resolved":
        ticket.resolved_at = datetime.utcnow()
    if update_data.get("status") == "closed" and ticket.status != "closed":
        ticket.closed_at = datetime.utcnow()

    for key, value in update_data.items():
        setattr(ticket, key, value)
    db.flush()

    after = {c.name: getattr(ticket, c.name) for c in ticket.__table__.columns}

    svc = AuditService(db)
    changes = svc.diff(before, after, ignore_fields=["updated_at"])
    if changes:
        svc.log_updated_obj(
            entity_obj=ticket,
            tenant_id=ticket.tenant_id,
            user=user,
            changes=changes,
            request=request,
        )

    db.commit()
    db.refresh(ticket)
    return ticket


# ============================================================
# STATUS UPDATE
# ============================================================

@router.patch("/{ticket_id}/status", response_model=TicketResponse)
def update_ticket_status(
    ticket_id: int,
    payload: TicketStatusUpdate,
    request: Request,
    user: User = Depends(require_feature_permission("tasks", "edit")),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(db, ticket_id, user)

    old_status = ticket.status

    if payload.status == "resolved" and ticket.status != "resolved":
        ticket.resolved_at = datetime.utcnow()
    if payload.status == "closed" and ticket.status != "closed":
        ticket.closed_at = datetime.utcnow()

    ticket.status = payload.status

    if old_status != payload.status:
        AuditService(db).log_updated_obj(
            entity_obj=ticket,
            tenant_id=ticket.tenant_id,
            user=user,
            changes={"status": {"before": old_status, "after": payload.status}},
            request=request,
        )

    db.commit()
    db.refresh(ticket)
    return ticket


# ============================================================
# DELETE
# ============================================================

@router.delete("/{ticket_id}", status_code=204)
def delete_ticket(
    ticket_id: int,
    request: Request,
    user: User = Depends(require_feature_permission("tasks", "delete")),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(db, ticket_id, user)

    AuditService(db).log_deleted_obj(
        entity_obj=ticket,
        tenant_id=ticket.tenant_id,
        user=user,
        request=request,
    )

    db.delete(ticket)
    db.commit()
    return None


# ============================================================
# ADD MESSAGE
# ============================================================

@router.post("/{ticket_id}/messages", response_model=TicketMessageResponse, status_code=201)
def add_message(
    ticket_id: int,
    payload: TicketMessageCreate,
    user: User = Depends(require_feature_permission("tasks", "edit")),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(db, ticket_id, user)

    message = TicketMessage(
        ticket_id=ticket.id,
        sender_id=user.id,
        sender_type="agent",
        sender_name=user.full_name,
        sender_email=user.email,
        message=payload.message,
        is_internal=payload.is_internal or False,
    )
    db.add(message)

    if not ticket.first_response_at:
        ticket.first_response_at = datetime.utcnow()

    db.commit()
    db.refresh(message)
    return message


# ============================================================
# UPLOAD ATTACHMENT
# ============================================================

@router.post("/{ticket_id}/attachments", response_model=TicketAttachmentResponse)
async def upload_attachment(
    ticket_id: int,
    file: UploadFile = File(...),
    user: User = Depends(require_feature_permission("tasks", "edit")),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(db, ticket_id, user)

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type '{file.content_type}' not allowed")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "File size exceeds 10 MB")

    ext = os.path.splitext(file.filename or "")[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    attachment = TicketAttachment(
        ticket_id=ticket.id,
        file_name=file.filename,
        file_url=f"/uploads/tickets/{unique_name}",
        file_size=len(content),
        file_type=file.content_type,
        uploaded_by=user.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


# ============================================================
# DELETE ATTACHMENT
# ============================================================

@router.delete("/{ticket_id}/attachments/{attachment_id}", status_code=204)
def delete_attachment(
    ticket_id: int,
    attachment_id: int,
    user: User = Depends(require_feature_permission("tasks", "edit")),
    db: Session = Depends(get_db),
):
    _get_ticket_or_404(db, ticket_id, user)

    attachment = (
        db.query(TicketAttachment)
        .filter(
            TicketAttachment.id == attachment_id,
            TicketAttachment.ticket_id == ticket_id,
        )
        .first()
    )
    if not attachment:
        raise HTTPException(404, "Attachment not found")

    file_path = os.path.join(UPLOAD_DIR, os.path.basename(attachment.file_url))
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(attachment)
    db.commit()
    return None