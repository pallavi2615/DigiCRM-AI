from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, update as sql_update
from datetime import datetime, timedelta, date
import secrets
import logging

from app.db.database import get_db
from app.models.tenant import Tenant
from app.models.lead import Lead
from app.models.webhook_event import WebhookEvent
from app.models.webhook_retry_settings import WebhookRetrySettings
from app.schemas.lead import WebhookPayload, WebhookResponse
from app.models.company import Company
from app.models.contact import Contact
from app.models.Followup import (
    FollowupSequence,
    FollowupSequenceStep,
    FollowupTask,
)
from app.services.automation_service import AutomationEngine

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["Webhook"])


@router.post("/{webhook_id}", response_model=WebhookResponse)
def receive_lead(
    webhook_id: str,
    payload: WebhookPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    """
    Receive a lead from an external webhook.

    PUBLIC ENDPOINT — no JWT auth.
    Security is enforced via the secret `webhook_id` in the URL path.
    """

    # ============================================================
    # 1. IDENTIFY TENANT
    # ============================================================
    tenant = db.query(Tenant).filter(Tenant.webhook_id == webhook_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Invalid webhook")
    if tenant.status != "active":
        raise HTTPException(status_code=403, detail="Tenant inactive")

    # ============================================================
    # 2. VALIDATE PAYLOAD
    # ============================================================
    if not any([payload.name, payload.email, payload.phone]):
        raise HTTPException(
            status_code=400,
            detail="At least one of name, email, or phone is required",
        )

    # ============================================================
    # 3. DEDUPLICATION
    # ============================================================
    event_id = (
        request.headers.get("X-Event-ID")
        or request.headers.get("X-Request-ID")
        or f"evt_{secrets.token_urlsafe(16)}"
    )

    existing_event = (
        db.query(WebhookEvent)
        .filter(WebhookEvent.event_id == event_id)
        .first()
    )
    if existing_event and existing_event.status == "success":
        return WebhookResponse(
            success=True,
            lead_id=0,
            message="Duplicate event — already processed",
        )

    # ============================================================
    # 4. CREATE WEBHOOK EVENT (PENDING) — commit immediately
    # ============================================================
    webhook_event = WebhookEvent(
        tenant_id=tenant.id,
        event_id=event_id,
        webhook_id=webhook_id,
        payload=payload.model_dump(mode="json"),
        status="pending",
        attempts=0,
    )
    db.add(webhook_event)
    db.commit()                       # <-- Persist BEFORE attempting lead
    db.refresh(webhook_event)
    event_pk = webhook_event.id       # Save the PK so we can re-fetch after rollback

    # ============================================================
    # 5. ATTEMPT LEAD CREATION
    # ============================================================
    try:
        # ---------- 5a. AUTO-CREATE / FIND COMPANY ----------
        company = None
        if payload.company:
            company_name_clean = payload.company.strip()
            company = (
                db.query(Company)
                .filter(
                    Company.tenant_id == tenant.id,
                    func.lower(Company.name) == company_name_clean.lower(),
                )
                .first()
            )

            if not company:
                location = ", ".join(
                    filter(None, [payload.city, payload.country])
                ) or None

                company = Company(
                    tenant_id=tenant.id,
                    name=company_name_clean,
                    industry=payload.industry,
                    location=location,
                    website=payload.website,
                    status="active",
                )
                db.add(company)
                db.flush()

        # ---------- 5b. AUTO-CREATE / FIND CONTACT ----------
        contact = None
        if payload.email:
            contact = (
                db.query(Contact)
                .filter(
                    Contact.tenant_id == tenant.id,
                    Contact.email == payload.email,
                )
                .first()
            )

            if not contact:
                full_name = (payload.name or "").strip()
                parts = full_name.split(" ", 1) if full_name else ["Unknown"]
                first_name = parts[0] if parts[0] else "Unknown"
                last_name = parts[1] if len(parts) > 1 else None

                contact = Contact(
                    tenant_id=tenant.id,
                    first_name=first_name,
                    last_name=last_name,
                    email=payload.email,
                    phone=payload.phone,
                    designation=payload.designation,
                    company_id=company.id if company else None,
                    status="active",
                )
                db.add(contact)
                db.flush()

        # ---------- 5c. CREATE LEAD ----------
        lead = Lead(
            tenant_id=tenant.id,
            company_id=company.id if company else None,
            contact_id=contact.id if contact else None,
            name=payload.name,
            contact_person=payload.name,
            email=payload.email,
            phone=payload.phone,
            company_name=payload.company,
            designation=payload.designation,
            website=payload.website,
            industry=payload.industry,
            country=payload.country,
            city=payload.city,
            message=payload.message,
            source=payload.source or "webhook",
            status="new",
            priority=payload.priority or "medium",
            estimated_value=payload.value or 0,
            custom_fields=payload.custom_fields or {},
            created_at=datetime.utcnow(),
        )
        db.add(lead)
        db.commit()
        db.refresh(lead)

        # ---------- 5d. AUTOMATION (isolated, non-blocking) ----------
        try:
            engine = AutomationEngine(db)
            engine.trigger_event(
                tenant_id=tenant.id,
                event="lead_created",
                entity_type="lead",
                entity=lead,
            )
            engine.trigger_conditional(
                tenant_id=tenant.id,
                entity_type="lead",
                entity=lead,
            )
        except Exception as auto_err:
            logger.exception("Automation trigger failed (non-fatal): %s", auto_err)

        # ---------- 5e. AUTO-ATTACH FOLLOW-UP (isolated) ----------
        if tenant.auto_followup_enabled and tenant.default_followup_sequence_id:
            try:
                sequence = (
                    db.query(FollowupSequence)
                    .filter(
                        FollowupSequence.id == tenant.default_followup_sequence_id,
                        FollowupSequence.tenant_id == tenant.id,
                        FollowupSequence.is_active == True,
                    )
                    .first()
                )

                if sequence:
                    steps = (
                        db.query(FollowupSequenceStep)
                        .filter(
                            FollowupSequenceStep.sequence_id == sequence.id
                        )
                        .order_by(FollowupSequenceStep.step_order)
                        .all()
                    )

                    base_date = date.today()

                    for step in steps:
                        due = base_date + timedelta(days=step.delay_days)
                        db.add(FollowupTask(
                            tenant_id=tenant.id,
                            lead_id=lead.id,
                            sequence_id=sequence.id,
                            step_id=step.id,
                            title=step.title,
                            description=step.description,
                            action_type=step.action_type,
                            status="pending",
                            priority="medium",
                            due_date=due,
                            assigned_to=tenant.default_assignee_id,
                        ))

                    db.execute(
                        sql_update(Lead)
                        .where(Lead.id == lead.id)
                        .values(followup_sequence_id=sequence.id)
                    )
                    db.commit()
                    logger.info(
                        "Auto-attached sequence %s to lead %s",
                        sequence.id, lead.id,
                    )
            except Exception as attach_err:
                logger.exception(
                    "Auto-attach followup failed (non-fatal): %s", attach_err
                )
                db.rollback()

        # ---------- 5f. MARK EVENT SUCCESS ----------
        webhook_event.status = "success"
        webhook_event.response_status = 200
        webhook_event.attempts = 1
        db.commit()

        return WebhookResponse(
            success=True,
            lead_id=lead.id,
            message="Lead received successfully",
        )

    # ============================================================
    # 6. FAILURE HANDLER — schedule retry
    # ============================================================
    except Exception as e:
        logger.exception("Webhook lead creation failed: %s", e)
        db.rollback()

        # Re-fetch the webhook event (it was committed before try block)
        webhook_event = (
            db.query(WebhookEvent)
            .filter(WebhookEvent.id == event_pk)
            .first()
        )
        if not webhook_event:
            # Shouldn't happen, but just in case
            return WebhookResponse(
                success=True,
                lead_id=0,
                message="Lead received — will retry internally",
            )

        settings = (
            db.query(WebhookRetrySettings)
            .filter(WebhookRetrySettings.tenant_id == tenant.id)
            .first()
        )

        webhook_event.last_error = str(e)
        webhook_event.attempts = 1

        if settings and settings.enabled:
            delay_minutes = settings.base_delay_minutes
            webhook_event.next_retry_at = (
                datetime.utcnow() + timedelta(minutes=delay_minutes)
            )
            webhook_event.max_attempts = settings.max_attempts
            webhook_event.status = "retrying"
        else:
            webhook_event.status = "dead_letter"
            webhook_event.max_attempts = 0
            webhook_event.next_retry_at = None

        db.commit()

        # Always return 200 so external systems don't retry on our behalf
        return WebhookResponse(
            success=True,
            lead_id=0,
            message="Lead received — will retry internally",
        )