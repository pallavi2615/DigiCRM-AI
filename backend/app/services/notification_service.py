"""
Notification service — used by other modules to create notifications.

Usage:
    from app.services.notification_service import NotificationService

    svc = NotificationService(db)
    svc.notify_lead_assigned(
        user_id=5,
        tenant_id=1,
        lead_id=42,
        lead_name="Jane Doe",
    )
"""

import logging
from typing import Optional, Dict, Any
from sqlalchemy.orm import Session

from app.models.notification import Notification

logger = logging.getLogger(__name__)


class NotificationService:
    def __init__(self, db: Session):
        self.db = db

    # ── Core writer ────────────────────────────────────
    def create(
        self,
        *,
        user_id: int,
        type: str,
        title: str,
        message: Optional[str] = None,
        tenant_id: Optional[int] = None,
        entity_type: Optional[str] = None,
        entity_id: Optional[int] = None,
        action_url: Optional[str] = None,
        extra_data: Optional[Dict[str, Any]] = None,
    ) -> Optional[Notification]:
        """Create a notification. Swallows exceptions."""
        try:
            notif = Notification(
                user_id=user_id,
                tenant_id=tenant_id,
                type=type,
                title=title,
                message=message,
                entity_type=entity_type,
                entity_id=entity_id,
                action_url=action_url,
                extra_data=extra_data or {},
            )
            self.db.add(notif)
            self.db.flush()
            return notif
        except Exception as e:
            logger.exception("Notification create failed (non-fatal): %s", e)
            return None

    # ── Convenience wrappers ───────────────────────────
    def notify_lead_assigned(self, *, user_id, tenant_id, lead_id, lead_name):
        return self.create(
            user_id=user_id,
            tenant_id=tenant_id,
            type="lead_assigned",
            title=f"New lead assigned: {lead_name}",
            message="You've been assigned a new lead.",
            entity_type="lead",
            entity_id=lead_id,
            action_url=f"/leads/{lead_id}",
        )

    def notify_followup_overdue(self, *, user_id, tenant_id, lead_id, lead_name, due_date):
        return self.create(
            user_id=user_id,
            tenant_id=tenant_id,
            type="followup_overdue",
            title=f"Follow-up overdue: {lead_name}",
            message=f"Follow-up was due {due_date}",
            entity_type="lead",
            entity_id=lead_id,
            action_url=f"/leads/{lead_id}",
        )

    def notify_invoice_overdue(self, *, user_id, tenant_id, invoice_id, invoice_number, amount, due_date):
        return self.create(
            user_id=user_id,
            tenant_id=tenant_id,
            type="invoice_overdue",
            title=f"Invoice overdue: {invoice_number}",
            message=f"Amount ₹{amount} — due {due_date}",
            entity_type="invoice",
            entity_id=invoice_id,
            action_url=f"/invoices/{invoice_id}",
        )

    def notify_task_due(self, *, user_id, tenant_id, task_id, task_title, due_date):
        return self.create(
            user_id=user_id,
            tenant_id=tenant_id,
            type="task_due",
            title=f"Task due: {task_title}",
            message=f"Due {due_date}",
            entity_type="task",
            entity_id=task_id,
            action_url=f"/tasks/{task_id}",
        )

    def notify_proposal_accepted(self, *, user_id, tenant_id, proposal_id, proposal_title):
        return self.create(
            user_id=user_id,
            tenant_id=tenant_id,
            type="proposal_accepted",
            title=f"Proposal accepted: {proposal_title}",
            message="Great news — the client accepted!",
            entity_type="proposal",
            entity_id=proposal_id,
            action_url=f"/proposals/{proposal_id}",
        )

    def notify_proposal_declined(self, *, user_id, tenant_id, proposal_id, proposal_title):
        return self.create(
            user_id=user_id,
            tenant_id=tenant_id,
            type="proposal_declined",
            title=f"Proposal declined: {proposal_title}",
            message="The client declined this proposal.",
            entity_type="proposal",
            entity_id=proposal_id,
            action_url=f"/proposals/{proposal_id}",
        )

    def notify_sla_breach(self, *, user_id, tenant_id, ticket_id, ticket_number):
        return self.create(
            user_id=user_id,
            tenant_id=tenant_id,
            type="sla_breach",
            title=f"SLA breached: {ticket_number}",
            message="This ticket has breached its SLA.",
            entity_type="ticket",
            entity_id=ticket_id,
            action_url=f"/tickets/{ticket_id}",
        )