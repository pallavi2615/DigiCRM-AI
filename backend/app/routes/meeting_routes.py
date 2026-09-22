from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime, date

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.meeting import Meeting
from app.schemas.meeting import MeetingCreate, MeetingUpdate, MeetingResponse

router = APIRouter(prefix="/meetings", tags=["Meetings"])

SUPER_ADMIN_ROLE = "super_admin"


def _apply_tenant_filter(query, user: User):
    if user.role != SUPER_ADMIN_ROLE:
        query = query.filter(Meeting.tenant_id == user.tenant_id)
    return query


@router.get("", response_model=List[MeetingResponse])
def list_meetings(
    status: Optional[str] = None,
    lead_id: Optional[int] = None,
    today: Optional[bool] = False,
    upcoming: Optional[bool] = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(Meeting), user)
    if status:
        query = query.filter(Meeting.status == status)
    if lead_id:
        query = query.filter(Meeting.lead_id == lead_id)
    if today:
        today_start = datetime.combine(date.today(), datetime.min.time())
        today_end = datetime.combine(date.today(), datetime.max.time())
        query = query.filter(Meeting.scheduled_at.between(today_start, today_end))
    if upcoming:
        query = query.filter(Meeting.scheduled_at >= datetime.utcnow(), Meeting.status == "scheduled")

    return query.order_by(Meeting.scheduled_at).offset(skip).limit(limit).all()


@router.get("/stats")
def meeting_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = _apply_tenant_filter(db.query(Meeting), user)
    return {
        "total": query.count(),
        "scheduled": query.filter(Meeting.status == "scheduled").count(),
        "completed": query.filter(Meeting.status == "completed").count(),
        "cancelled": query.filter(Meeting.status == "cancelled").count(),
    }


@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(meeting_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meeting = _apply_tenant_filter(db.query(Meeting), user).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return meeting


@router.post("", response_model=MeetingResponse, status_code=201)
def create_meeting(payload: MeetingCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    meeting = Meeting(
        tenant_id=user.tenant_id,
        title=payload.title,
        description=payload.description,
        agenda=payload.agenda,
        scheduled_at=payload.scheduled_at,
        duration_minutes=payload.duration_minutes or 30,
        meeting_type=payload.meeting_type or "video",
        location=payload.location,
        meeting_link=payload.meeting_link,
        attendees=payload.attendees or [],
        created_by=user.id,
        lead_id=payload.lead_id,
        contact_id=payload.contact_id,
        company_id=payload.company_id,
    )
    db.add(meeting)
    db.commit()
    db.refresh(meeting)
    return meeting


@router.put("/{meeting_id}", response_model=MeetingResponse)
def update_meeting(meeting_id: int, payload: MeetingUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meeting = _apply_tenant_filter(db.query(Meeting), user).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(meeting, key, value)

    db.commit()
    db.refresh(meeting)
    return meeting


@router.delete("/{meeting_id}", status_code=204)
def delete_meeting(meeting_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    meeting = _apply_tenant_filter(db.query(Meeting), user).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    db.delete(meeting)
    db.commit()
    return None