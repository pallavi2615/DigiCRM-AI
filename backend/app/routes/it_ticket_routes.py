"""
IT Services — Ticket routes.

All endpoints require 'it_company' subscription.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional
from datetime import datetime

from app.db.database import get_db
from app.core.industry_gate import require_industry
from app.models.user import User
from app.models.it_project import ITProject
from app.models.it_ticket import (
    ITTicket, IT_TICKET_TYPES, IT_TICKET_PRIORITIES, IT_TICKET_STATUSES,
)
from app.schemas.it_ticket import (
    ITTicketCreate,
    ITTicketUpdate,
    ITTicketResponse,
    ITTicketStatusUpdate,
    ITTicketStats,
    ITTicketListResponse,
)

router = APIRouter(prefix="/it/tickets", tags=["IT Tickets"])


# ============================================================
# HELPER — attach project_name
# ============================================================

def _to_response(ticket: ITTicket, project: Optional[ITProject] = None) -> ITTicketResponse:
    data = ITTicketResponse.model_validate(ticket)
    data.project_name = project.name if project else None
    return data


# ============================================================
# LIST
# ============================================================

@router.get("", response_model=ITTicketListResponse)
def list_it_tickets(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    type: Optional[str] = None,
    project_id: Optional[int] = None,
    assignee_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    """List IT tickets for the current tenant."""
    query = db.query(ITTicket)

    if user.role != "super_admin":
        query = query.filter(ITTicket.tenant_id == user.tenant_id)

    if status:
        query = query.filter(ITTicket.status == status)
    if priority:
        query = query.filter(ITTicket.priority == priority)
    if type:
        query = query.filter(ITTicket.type == type)
    if project_id:
        query = query.filter(ITTicket.project_id == project_id)
    if assignee_id:
        query = query.filter(ITTicket.assignee_id == assignee_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(ITTicket.title.ilike(pattern))

    total = query.count()
    rows = (
        query.order_by(desc(ITTicket.created_at))
        .offset(skip).limit(limit).all()
    )

    # Bulk-fetch projects to avoid N+1
    project_ids = list({r.project_id for r in rows if r.project_id})
    projects_map = {}
    if project_ids:
        for p in db.query(ITProject).filter(ITProject.id.in_(project_ids)).all():
            projects_map[p.id] = p

    return ITTicketListResponse(
        data=[_to_response(r, projects_map.get(r.project_id)) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


# ============================================================
# STATS
# ============================================================

@router.get("/stats", response_model=ITTicketStats)
def it_ticket_stats(
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    """Aggregate stats for IT tickets."""
    query = db.query(ITTicket)

    if user.role != "super_admin":
        query = query.filter(ITTicket.tenant_id == user.tenant_id)

    by_priority = {}
    for p in IT_TICKET_PRIORITIES:
        by_priority[p] = query.filter(ITTicket.priority == p).count()

    return ITTicketStats(
        total=query.count(),
        open=query.filter(ITTicket.status == "open").count(),
        in_progress=query.filter(ITTicket.status == "in_progress").count(),
        blocked=query.filter(ITTicket.status == "blocked").count(),
        resolved=query.filter(ITTicket.status == "resolved").count(),
        closed=query.filter(ITTicket.status == "closed").count(),
        by_priority=by_priority,
    )


# ============================================================
# GET SINGLE
# ============================================================

@router.get("/{ticket_id}", response_model=ITTicketResponse)
def get_it_ticket(
    ticket_id: int,
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    query = db.query(ITTicket).filter(ITTicket.id == ticket_id)
    if user.role != "super_admin":
        query = query.filter(ITTicket.tenant_id == user.tenant_id)

    ticket = query.first()
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    project = None
    if ticket.project_id:
        project = db.query(ITProject).filter(ITProject.id == ticket.project_id).first()

    return _to_response(ticket, project)


# ============================================================
# CREATE
# ============================================================

@router.post("", response_model=ITTicketResponse, status_code=201)
def create_it_ticket(
    payload: ITTicketCreate,
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    ticket = ITTicket(
        tenant_id=user.tenant_id,
        project_id=payload.project_id,
        title=payload.title,
        description=payload.description,
        type=payload.type or "task",
        priority=payload.priority or "medium",
        status=payload.status or "open",
        due_date=payload.due_date,
        assignee_id=payload.assignee_id,
        tags=payload.tags,
        created_by=user.id,
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)

    project = None
    if ticket.project_id:
        project = db.query(ITProject).filter(ITProject.id == ticket.project_id).first()

    return _to_response(ticket, project)


# ============================================================
# UPDATE
# ============================================================

@router.put("/{ticket_id}", response_model=ITTicketResponse)
def update_it_ticket(
    ticket_id: int,
    payload: ITTicketUpdate,
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    query = db.query(ITTicket).filter(ITTicket.id == ticket_id)
    if user.role != "super_admin":
        query = query.filter(ITTicket.tenant_id == user.tenant_id)

    ticket = query.first()
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    update_data = payload.model_dump(exclude_unset=True)

    # Timestamp updates on status change
    if "status" in update_data:
        new_status = update_data["status"]
        if new_status == "resolved" and ticket.status != "resolved":
            ticket.resolved_at = datetime.utcnow()
        if new_status == "closed" and ticket.status != "closed":
            ticket.closed_at = datetime.utcnow()

    for key, value in update_data.items():
        setattr(ticket, key, value)

    db.commit()
    db.refresh(ticket)

    project = None
    if ticket.project_id:
        project = db.query(ITProject).filter(ITProject.id == ticket.project_id).first()

    return _to_response(ticket, project)


# ============================================================
# STATUS UPDATE (quick)
# ============================================================

@router.patch("/{ticket_id}/status", response_model=ITTicketResponse)
def update_it_ticket_status(
    ticket_id: int,
    payload: ITTicketStatusUpdate,
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    query = db.query(ITTicket).filter(ITTicket.id == ticket_id)
    if user.role != "super_admin":
        query = query.filter(ITTicket.tenant_id == user.tenant_id)

    ticket = query.first()
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    if payload.status == "resolved" and ticket.status != "resolved":
        ticket.resolved_at = datetime.utcnow()
    if payload.status == "closed" and ticket.status != "closed":
        ticket.closed_at = datetime.utcnow()

    ticket.status = payload.status
    db.commit()
    db.refresh(ticket)

    project = None
    if ticket.project_id:
        project = db.query(ITProject).filter(ITProject.id == ticket.project_id).first()

    return _to_response(ticket, project)


# ============================================================
# DELETE
# ============================================================

@router.delete("/{ticket_id}", status_code=204)
def delete_it_ticket(
    ticket_id: int,
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    query = db.query(ITTicket).filter(ITTicket.id == ticket_id)
    if user.role != "super_admin":
        query = query.filter(ITTicket.tenant_id == user.tenant_id)

    ticket = query.first()
    if not ticket:
        raise HTTPException(404, "Ticket not found")

    db.delete(ticket)
    db.commit()
    return None