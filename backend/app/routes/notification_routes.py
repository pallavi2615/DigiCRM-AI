"""
Notifications API — personal inbox per user.

Every endpoint only operates on notifications belonging to the
logged-in user. No cross-user or cross-tenant visibility.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional
from datetime import datetime

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.notification import Notification
from app.schemas.notification import (
    NotificationResponse,
    NotificationListResponse,
    UnreadCountResponse,
    MarkReadResponse,
)

router = APIRouter(prefix="/notifications", tags=["Notifications"])


# ============================================================
# LIST
# ============================================================

@router.get("", response_model=NotificationListResponse)
def list_notifications(
    is_read: Optional[bool] = Query(None, description="Filter by read state"),
    type: Optional[str] = Query(None, description="Filter by notification type"),
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List notifications for the logged-in user."""
    base_q = db.query(Notification).filter(Notification.user_id == user.id)

    query = base_q
    if is_read is not None:
        query = query.filter(Notification.is_read == is_read)
    if type:
        query = query.filter(Notification.type == type)

    total = query.count()
    unread = base_q.filter(Notification.is_read == False).count()

    rows = (
        query.order_by(desc(Notification.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )

    return NotificationListResponse(
        data=[NotificationResponse.model_validate(r) for r in rows],
        total=total,
        unread=unread,
        skip=skip,
        limit=limit,
    )


# ============================================================
# UNREAD COUNT
# ============================================================

@router.get("/unread-count", response_model=UnreadCountResponse)
def get_unread_count(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the unread notification count for the badge."""
    count = (
        db.query(func.count(Notification.id))
        .filter(
            Notification.user_id == user.id,
            Notification.is_read == False,
        )
        .scalar()
        or 0
    )
    return UnreadCountResponse(unread=count)


# ============================================================
# MARK SINGLE AS READ
# ============================================================

@router.patch("/{notification_id}/read", response_model=MarkReadResponse)
def mark_notification_read(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark one notification as read."""
    notif = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
        .first()
    )
    if not notif:
        raise HTTPException(404, "Notification not found")

    if not notif.is_read:
        notif.is_read = True
        notif.read_at = datetime.utcnow()
        db.commit()

    return MarkReadResponse(
        success=True,
        notification_id=notif.id,
        message="Marked as read",
    )


# ============================================================
# MARK ALL AS READ
# ============================================================

@router.post("/read-all", response_model=MarkReadResponse)
def mark_all_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark all notifications of the current user as read."""
    now = datetime.utcnow()
    count = (
        db.query(Notification)
        .filter(
            Notification.user_id == user.id,
            Notification.is_read == False,
        )
        .update(
            {"is_read": True, "read_at": now},
            synchronize_session=False,
        )
    )
    db.commit()

    return MarkReadResponse(
        success=True,
        marked=count,
        message=f"Marked {count} notification(s) as read",
    )


# ============================================================
# MARK SINGLE AS UNREAD
# ============================================================

@router.patch("/{notification_id}/unread", response_model=MarkReadResponse)
def mark_notification_unread(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark one notification as unread."""
    notif = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
        .first()
    )
    if not notif:
        raise HTTPException(404, "Notification not found")

    notif.is_read = False
    notif.read_at = None
    db.commit()

    return MarkReadResponse(
        success=True,
        notification_id=notif.id,
        message="Marked as unread",
    )


# ============================================================
# DELETE
# ============================================================

@router.delete("/{notification_id}", status_code=204)
def delete_notification(
    notification_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a notification (owned by current user)."""
    notif = (
        db.query(Notification)
        .filter(
            Notification.id == notification_id,
            Notification.user_id == user.id,
        )
        .first()
    )
    if not notif:
        raise HTTPException(404, "Notification not found")

    db.delete(notif)
    db.commit()
    return None


# ============================================================
# DELETE ALL READ
# ============================================================

@router.delete("/read/all", status_code=204)
def delete_all_read(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete all read notifications for the current user."""
    db.query(Notification).filter(
        Notification.user_id == user.id,
        Notification.is_read == True,
    ).delete(synchronize_session=False)
    db.commit()
    return None