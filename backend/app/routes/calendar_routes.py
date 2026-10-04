from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.permissions import require_feature_permission
from app.core.constants import SUPER_ADMIN_ROLE as SA_CONST        # ⭐
from app.services.audit_service import AuditService                # ⭐
from app.models.user import User
from app.models.calendar_event import CalendarEvent
from app.schemas.calendar_event import EventCreate, EventUpdate, EventResponse

router = APIRouter(prefix="/calendar", tags=["Calendar"])

SUPER_ADMIN_ROLE = "super_admin"


def _apply_tenant_filter(query, user: User):
    if user.role != SA_CONST:
        query = query.filter(CalendarEvent.tenant_id == user.tenant_id)
    return query


# ============ LIST ============
@router.get("", response_model=List[EventResponse])
def list_events(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    event_type: Optional[str] = None,
    user: User = Depends(require_feature_permission("calendar", "view")),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(CalendarEvent), user)
    if start_date:
        query = query.filter(CalendarEvent.start_time >= start_date)
    if end_date:
        query = query.filter(CalendarEvent.start_time <= end_date)
    if event_type:
        query = query.filter(CalendarEvent.event_type == event_type)
    return query.order_by(CalendarEvent.start_time).all()


# ============ GET SINGLE ============
@router.get("/{event_id}", response_model=EventResponse)
def get_event(
    event_id: int,
    user: User = Depends(require_feature_permission("calendar", "view")),
    db: Session = Depends(get_db),
):
    event = _apply_tenant_filter(
        db.query(CalendarEvent), user
    ).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    return event


# ============ CREATE ============
@router.post("", response_model=EventResponse, status_code=201)
def create_event(
    payload: EventCreate,
    request: Request,                                              # ⭐
    user: User = Depends(require_feature_permission("calendar", "create")),
    db: Session = Depends(get_db),
):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    event = CalendarEvent(
        tenant_id=user.tenant_id,
        title=payload.title,
        description=payload.description,
        event_type=payload.event_type or "meeting",
        start_time=payload.start_time,
        end_time=payload.end_time,
        all_day=payload.all_day or False,
        location=payload.location,
        meeting_link=payload.meeting_link,
        attendees=payload.attendees or [],
        created_by=user.id,
        lead_id=payload.lead_id,
        contact_id=payload.contact_id,
    )
    db.add(event)
    db.flush()                                                     # ⭐

    AuditService(db).log_created_obj(                              # ⭐
        entity_obj=event,
        tenant_id=user.tenant_id,
        user=user,
        request=request,
    )

    db.commit()
    db.refresh(event)
    return event


# ============ UPDATE ============
@router.put("/{event_id}", response_model=EventResponse)
def update_event(
    event_id: int,
    payload: EventUpdate,
    request: Request,                                              # ⭐
    user: User = Depends(require_feature_permission("calendar", "edit")),
    db: Session = Depends(get_db),
):
    event = _apply_tenant_filter(
        db.query(CalendarEvent), user
    ).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")

    # Snapshot before
    before = {c.name: getattr(event, c.name) for c in event.__table__.columns}  # ⭐

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, key, value)
    db.flush()                                                     # ⭐

    # Snapshot after
    after = {c.name: getattr(event, c.name) for c in event.__table__.columns}   # ⭐

    svc = AuditService(db)                                         # ⭐
    changes = svc.diff(before, after, ignore_fields=["updated_at"])  # ⭐
    if changes:                                                    # ⭐
        svc.log_updated_obj(                                       # ⭐
            entity_obj=event,
            tenant_id=event.tenant_id,
            user=user,
            changes=changes,
            request=request,
        )

    db.commit()
    db.refresh(event)
    return event


# ============ DELETE ============
@router.delete("/{event_id}", status_code=204)
def delete_event(
    event_id: int,
    request: Request,                                              # ⭐
    user: User = Depends(require_feature_permission("calendar", "delete")),
    db: Session = Depends(get_db),
):
    event = _apply_tenant_filter(
        db.query(CalendarEvent), user
    ).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")

    AuditService(db).log_deleted_obj(                              # ⭐
        entity_obj=event,
        tenant_id=event.tenant_id,
        user=user,
        request=request,
    )

    db.delete(event)
    db.commit()
    return None