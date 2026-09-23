import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_, func
from typing import Optional, List
from datetime import datetime, timedelta

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.ticket import Ticket, TicketMessage, TicketAttachment
from app.schemas.ticket import (
    TicketCreate, TicketUpdate, TicketStatusUpdate,
    TicketResponse, TicketDetailResponse, TicketStats,
    TicketMessageCreate, TicketMessageResponse,
    TicketAttachmentResponse,
)

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

# SLA hours by priority
SLA_HOURS = {
    "urgent": 4,
    "high": 8,
    "medium": 24,
    "low": 72,
}


def _apply_tenant_filter(query, user: User):
    if user.role != SUPER_ADMIN_ROLE:
        query = query.filter(Ticket.tenant_id == user.tenant_id)
    return query


def _get_ticket_or_404(db: Session, ticket_id: int, user: User) -> Ticket:
    ticket = _apply_tenant_filter(db.query(Ticket), user).filter(Ticket.id == ticket_id).first()
    if not ticket:
        raise HTTPException(404, "Ticket not found")
    return ticket


def _generate_ticket_number(db: Session, tenant_id: int) -> str:
    """Generate TKT-XXXX number."""
    count = db.query(func.count(Ticket.id)).filter(Ticket.tenant_id == tenant_id).scalar() or 0
    return f"TKT-{count + 1:04d}"


def _calculate_sla(priority: str) -> datetime:
    """SLA due time from now."""
    hours = SLA_HOURS.get(priority.lower(), 24)
    return datetime.utcnow() + timedelta(hours=hours)


# ============================================================
# LIST
# ============================================================

@router.get("", response_model=List[TicketResponse])
def list_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    urgency: Optional[str] = None,
    assigned_to: Optional[int] = None,
    sla_breached: Optional[bool] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(Ticket), user)

    if status:
        query = query.filter(Ticket.status == status)
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

    return query.order_by(desc(Ticket.created_at)).offset(skip).limit(limit).all()


# ============================================================
# STATS
# ============================================================

@router.get("/stats", response_model=TicketStats)
def ticket_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
# GET SINGLE (with messages + attachments)
# ============================================================

@router.get("/{ticket_id}", response_model=TicketDetailResponse)
def get_ticket(ticket_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = _get_ticket_or_404(db, ticket_id, user)

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
    user: User = Depends(get_current_user),
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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(db, ticket_id, user)
    update_data = payload.model_dump(exclude_unset=True)

    # Auto set timestamps
    if update_data.get("status") == "resolved" and ticket.status != "resolved":
        ticket.resolved_at = datetime.utcnow()
    if update_data.get("status") == "closed" and ticket.status != "closed":
        ticket.closed_at = datetime.utcnow()

    for key, value in update_data.items():
        setattr(ticket, key, value)

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
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    ticket = _get_ticket_or_404(db, ticket_id, user)

    if payload.status == "resolved" and ticket.status != "resolved":
        ticket.resolved_at = datetime.utcnow()
    if payload.status == "closed" and ticket.status != "closed":
        ticket.closed_at = datetime.utcnow()

    ticket.status = payload.status
    db.commit()
    db.refresh(ticket)
    return ticket


# ============================================================
# DELETE
# ============================================================

@router.delete("/{ticket_id}", status_code=204)
def delete_ticket(ticket_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    ticket = _get_ticket_or_404(db, ticket_id, user)
    db.delete(ticket)
    db.commit()
    return None


# ============================================================
# ADD MESSAGE (Reply)
# ============================================================

@router.post("/{ticket_id}/messages", response_model=TicketMessageResponse, status_code=201)
def add_message(
    ticket_id: int,
    payload: TicketMessageCreate,
    user: User = Depends(get_current_user),
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

    # First response tracking
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
    user: User = Depends(get_current_user),
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
    user: User = Depends(get_current_user),
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