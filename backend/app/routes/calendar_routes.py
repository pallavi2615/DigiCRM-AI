from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.calendar_event import CalendarEvent
from app.schemas.calendar_event import EventCreate, EventUpdate, EventResponse

router = APIRouter(prefix="/calendar", tags=["Calendar"])

SUPER_ADMIN_ROLE = "super_admin"


def _apply_tenant_filter(query, user: User):
    if user.role != SUPER_ADMIN_ROLE:
        query = query.filter(CalendarEvent.tenant_id == user.tenant_id)
    return query


@router.get("", response_model=List[EventResponse])
def list_events(
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    event_type: Optional[str] = None,
    user: User = Depends(get_current_user),
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


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = _apply_tenant_filter(db.query(CalendarEvent), user).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    return event


@router.post("", response_model=EventResponse, status_code=201)
def create_event(payload: EventCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
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
    db.commit()
    db.refresh(event)
    return event


@router.put("/{event_id}", response_model=EventResponse)
def update_event(event_id: int, payload: EventUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = _apply_tenant_filter(db.query(CalendarEvent), user).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(event, key, value)

    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=204)
def delete_event(event_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    event = _apply_tenant_filter(db.query(CalendarEvent), user).filter(CalendarEvent.id == event_id).first()
    if not event:
        raise HTTPException(404, "Event not found")
    db.delete(event)
    db.commit()
    return None