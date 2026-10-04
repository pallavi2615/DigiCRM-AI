from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime, date

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.permissions import require_feature_permission
from app.core.constants import SUPER_ADMIN_ROLE as SA_CONST        # ⭐
from app.services.audit_service import AuditService                # ⭐
from app.models.user import User
from app.models.meeting import Meeting
from app.schemas.meeting import MeetingCreate, MeetingUpdate, MeetingResponse

router = APIRouter(prefix="/meetings", tags=["Meetings"])

SUPER_ADMIN_ROLE = "super_admin"


def _apply_tenant_filter(query, user: User):
    if user.role != SA_CONST:
        query = query.filter(Meeting.tenant_id == user.tenant_id)
    return query


# ============ LIST ============
@router.get("", response_model=List[MeetingResponse])
def list_meetings(
    status: Optional[str] = None,
    lead_id: Optional[int] = None,
    today: Optional[bool] = False,
    upcoming: Optional[bool] = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(require_feature_permission("meetings", "view")),
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


# ============ STATS ============
@router.get("/stats")
def meeting_stats(
    user: User = Depends(require_feature_permission("meetings", "view")),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(Meeting), user)
    return {
        "total": query.count(),
        "scheduled": query.filter(Meeting.status == "scheduled").count(),
        "completed": query.filter(Meeting.status == "completed").count(),
        "cancelled": query.filter(Meeting.status == "cancelled").count(),
    }


# ============ GET SINGLE ============
@router.get("/{meeting_id}", response_model=MeetingResponse)
def get_meeting(
    meeting_id: int,
    user: User = Depends(require_feature_permission("meetings", "view")),
    db: Session = Depends(get_db),
):
    meeting = _apply_tenant_filter(
        db.query(Meeting), user
    ).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")
    return meeting


# ============ CREATE ============
@router.post("", response_model=MeetingResponse, status_code=201)
def create_meeting(
    payload: MeetingCreate,
    request: Request,                                              # ⭐
    user: User = Depends(require_feature_permission("meetings", "create")),
    db: Session = Depends(get_db),
):
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
    db.flush()                                                     # ⭐

    AuditService(db).log_created_obj(                              # ⭐
        entity_obj=meeting,
        tenant_id=user.tenant_id,
        user=user,
        request=request,
    )

    db.commit()
    db.refresh(meeting)
    return meeting


# ============ UPDATE ============
@router.put("/{meeting_id}", response_model=MeetingResponse)
def update_meeting(
    meeting_id: int,
    payload: MeetingUpdate,
    request: Request,                                              # ⭐
    user: User = Depends(require_feature_permission("meetings", "edit")),
    db: Session = Depends(get_db),
):
    meeting = _apply_tenant_filter(
        db.query(Meeting), user
    ).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    # Snapshot before
    before = {c.name: getattr(meeting, c.name) for c in meeting.__table__.columns}  # ⭐

    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(meeting, key, value)
    db.flush()                                                     # ⭐

    # Snapshot after
    after = {c.name: getattr(meeting, c.name) for c in meeting.__table__.columns}   # ⭐

    svc = AuditService(db)                                         # ⭐
    changes = svc.diff(before, after, ignore_fields=["updated_at"])  # ⭐
    if changes:                                                    # ⭐
        svc.log_updated_obj(                                       # ⭐
            entity_obj=meeting,
            tenant_id=meeting.tenant_id,
            user=user,
            changes=changes,
            request=request,
        )

    db.commit()
    db.refresh(meeting)
    return meeting


# ============ DELETE ============
@router.delete("/{meeting_id}", status_code=204)
def delete_meeting(
    meeting_id: int,
    request: Request,                                              # ⭐
    user: User = Depends(require_feature_permission("meetings", "delete")),
    db: Session = Depends(get_db),
):
    meeting = _apply_tenant_filter(
        db.query(Meeting), user
    ).filter(Meeting.id == meeting_id).first()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    AuditService(db).log_deleted_obj(                              # ⭐
        entity_obj=meeting,
        tenant_id=meeting.tenant_id,
        user=user,
        request=request,
    )

    db.delete(meeting)
    db.commit()
    return None