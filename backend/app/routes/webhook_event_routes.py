from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.permissions import require_super_admin
from app.models.user import User
from app.models.webhook_event import WebhookEvent
from app.schemas.webhook_events import (
    WebhookEventResponse,
    WebhookEventStats,
)

router = APIRouter(prefix="/webhook-events", tags=["Webhook Events"])

SUPER_ADMIN_ROLE = "super_admin"


def _apply_tenant_filter(query, user: User):
    if user.role != SUPER_ADMIN_ROLE:
        query = query.filter(WebhookEvent.tenant_id == user.tenant_id)
    return query


# ============ STATS ============
@router.get("/stats", response_model=WebhookEventStats)
def get_webhook_event_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get webhook event statistics."""
    query = _apply_tenant_filter(db.query(WebhookEvent), user)

    return WebhookEventStats(
        retrying=query.filter(WebhookEvent.status == "retrying").count(),
        dead_letter=query.filter(WebhookEvent.status == "dead_letter").count(),
        success=query.filter(WebhookEvent.status == "success").count(),
        failed=query.filter(WebhookEvent.status == "failed").count(),
    )


# ============ LIST ============
@router.get("", response_model=List[WebhookEventResponse])
def list_webhook_events(
    status: Optional[str] = None,
    tenant_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List webhook events with filters."""
    query = _apply_tenant_filter(db.query(WebhookEvent), user)

    if status:
        query = query.filter(WebhookEvent.status == status)
    if tenant_id and user.role == SUPER_ADMIN_ROLE:
        query = query.filter(WebhookEvent.tenant_id == tenant_id)

    return query.order_by(desc(WebhookEvent.created_at)).offset(skip).limit(limit).all()


# ============ RETRYING ============
@router.get("/retrying", response_model=List[WebhookEventResponse])
def list_retrying_events(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List currently retrying webhook events."""
    query = _apply_tenant_filter(db.query(WebhookEvent), user)
    return (
        query
        .filter(WebhookEvent.status == "retrying")
        .order_by(WebhookEvent.next_retry_at)
        .all()
    )


# ============ DEAD LETTER ============
@router.get("/dead-letter", response_model=List[WebhookEventResponse])
def list_dead_letter_events(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List dead-letter webhook events."""
    query = _apply_tenant_filter(db.query(WebhookEvent), user)
    return (
        query
        .filter(WebhookEvent.status == "dead_letter")
        .order_by(desc(WebhookEvent.created_at))
        .all()
    )


# ============ GET SINGLE ============
@router.get("/{event_id}", response_model=WebhookEventResponse)
def get_webhook_event(
    event_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get a single webhook event."""
    query = _apply_tenant_filter(
        db.query(WebhookEvent), user
    ).filter(WebhookEvent.id == event_id)

    event = query.first()
    if not event:
        raise HTTPException(404, "Event not found")
    return event


# ============ MANUAL RETRY ============
@router.post("/{event_id}/retry", response_model=WebhookEventResponse)
def retry_webhook_event(
    event_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Manually retry a webhook event."""
    query = _apply_tenant_filter(
        db.query(WebhookEvent), user
    ).filter(WebhookEvent.id == event_id)

    event = query.first()
    if not event:
        raise HTTPException(404, "Event not found")

    # Reset for retry
    event.status = "pending"
    event.next_retry_at = datetime.utcnow()
    event.last_error = None

    db.commit()
    db.refresh(event)
    return event


# ============ DELETE ============
@router.delete("/{event_id}", status_code=204)
def delete_webhook_event(
    event_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a webhook event."""
    query = _apply_tenant_filter(
        db.query(WebhookEvent), user
    ).filter(WebhookEvent.id == event_id)

    event = query.first()
    if not event:
        raise HTTPException(404, "Event not found")

    db.delete(event)
    db.commit()
    return None