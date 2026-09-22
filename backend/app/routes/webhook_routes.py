# from fastapi import APIRouter, Depends, HTTPException, Request
# from sqlalchemy.orm import Session
# from datetime import datetime

# from app.db.database import get_db
# from app.models.tenant import Tenant
# from app.models.lead import Lead
# from app.schemas.lead import WebhookPayload, WebhookResponse

# router = APIRouter(prefix="/webhook", tags=["Webhook"])


# @router.post("/{webhook_id}", response_model=WebhookResponse)
# def receive_lead(
#     webhook_id: str,
#     payload: WebhookPayload,
#     request: Request,
#     db: Session = Depends(get_db),
# ):
#     """
#     External systems se lead receive karo.
#     Public endpoint — koi auth nahi.
#     """
#     # 1. Tenant identify karo webhook_id se
#     tenant = db.query(Tenant).filter(Tenant.webhook_id == webhook_id).first()
#     if not tenant:
#         raise HTTPException(status_code=404, detail="Invalid webhook")
#     if tenant.status != "active":
#         raise HTTPException(status_code=403, detail="Tenant inactive")

#     # 2. Validate — kam se kam ek field hona chahiye
#     if not any([payload.name, payload.email, payload.phone]):
#         raise HTTPException(
#             status_code=400,
#             detail="At least one of name, email, or phone is required",
#         )

#     # 3. Create Lead 
#     lead = Lead(
#         tenant_id=tenant.id,
#         name=payload.name,
#         email=payload.email,
#         phone=payload.phone,
#         company_name=payload.company
#         message=payload.message,
#         source=payload.source or "webhook",
#         status="new",
#         priority=payload.priority or "medium",      
#         value=payload.value or 0,  
#         custom_fields=payload.custom_fields or {},
#         created_at=datetime.utcnow(),
#     )
#     db.add(lead)
#     db.commit()
#     db.refresh(lead)

#     # 4. Return success
#     return WebhookResponse(
#         success=True,
#         lead_id=lead.id,
#         message="Lead received successfully",
#     )


from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import secrets
from sqlalchemy import func
from sqlalchemy import func, update as sql_update

from app.db.database import get_db
from app.models.tenant import Tenant
from app.models.lead import Lead
from app.models.webhook_event import WebhookEvent
from app.models.webhook_retry_settings import WebhookRetrySettings
from app.schemas.lead import WebhookPayload, WebhookResponse
from app.models.company import Company
from app.models.contact import Contact
from app.models.Followup import FollowupSequence, FollowupSequenceStep, FollowupTask

from datetime import datetime, timedelta, date
import secrets
import logging
from sqlalchemy import func

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["Webhook"])


# @router.post("/{webhook_id}", response_model=WebhookResponse)
# def receive_lead(
#     webhook_id: str,
#     payload: WebhookPayload,
#     request: Request,
#     db: Session = Depends(get_db),
# ):
#     """
#     Receive a lead from an external webhook.

#     Flow:
#         1. Identify tenant by webhook_id.
#         2. Persist a webhook_events row with status 'pending'.
#         3. Attempt to create the lead.
#         4. On success: mark event as 'success'.
#         5. On failure: mark event as 'retrying' and schedule the
#            first retry using the tenant's retry settings.

#     Notes:
#         - Always returns HTTP 200 to the caller, even on internal
#           failure. Retries are handled asynchronously by a worker.
#         - Supports deduplication via the X-Event-ID header.
#     """
#     # ============================================================
#     # 1. IDENTIFY TENANT
#     # ============================================================
#     tenant = db.query(Tenant).filter(Tenant.webhook_id == webhook_id).first()
#     if not tenant:
#         raise HTTPException(status_code=404, detail="Invalid webhook")
#     if tenant.status != "active":
#         raise HTTPException(status_code=403, detail="Tenant inactive")

#     # ============================================================
#     # 2. VALIDATE PAYLOAD
#     # ============================================================
#     if not any([payload.name, payload.email, payload.phone]):
#         raise HTTPException(
#             status_code=400,
#             detail="At least one of name, email, or phone is required",
#         )

#     # ============================================================
#     # 3. DEDUPLICATION
#     # ============================================================
#     event_id = (
#         request.headers.get("X-Event-ID")
#         or request.headers.get("X-Request-ID")
#         or f"evt_{secrets.token_urlsafe(16)}"
#     )

#     existing_event = (
#         db.query(WebhookEvent)
#         .filter(WebhookEvent.event_id == event_id)
#         .first()
#     )
#     if existing_event and existing_event.status == "success":
#         return WebhookResponse(
#             success=True,
#             lead_id=0,
#             message="Duplicate event — already processed",
#         )

#     # ============================================================
#     # 4. CREATE WEBHOOK EVENT (PENDING)
#     # ============================================================
#     webhook_event = WebhookEvent(
#         tenant_id=tenant.id,
#         event_id=event_id,
#         webhook_id=webhook_id,
#         # payload=payload.model_dump(),
#         payload=payload.model_dump(mode="json"),
#         status="pending",
#         attempts=0,
#     )
#     db.add(webhook_event)
#     db.commit()
#     db.refresh(webhook_event)

#     # ============================================================
#     # 5. ATTEMPT LEAD CREATION
#     # ============================================================
#     try:
#         lead = Lead(
#             tenant_id=tenant.id,
#             name=payload.name,
#             email=payload.email,
#             phone=payload.phone,
#             company_name=payload.company,
#             message=payload.message,
#             source=payload.source or "webhook",
#             status="new",
#             priority=payload.priority or "medium",
#             estimated_value=payload.value or 0,
#             custom_fields=payload.custom_fields or {},
#             created_at=datetime.utcnow(),
#         )
#         db.add(lead)
#         db.commit()
#         db.refresh(lead)

#         # ✅ SUCCESS
#         webhook_event.status = "success"
#         webhook_event.response_status = 200
#         webhook_event.attempts = 1
#         db.commit()

#         return WebhookResponse(
#             success=True,
#             lead_id=lead.id,
#             message="Lead received successfully",
#         )

#     except Exception as e:
#         # ❌ FAILURE — schedule retry
#         db.rollback()

#         webhook_event = (
#             db.query(WebhookEvent)
#             .filter(WebhookEvent.id == webhook_event.id)
#             .first()
#         )

#         settings = (
#             db.query(WebhookRetrySettings)
#             .filter(WebhookRetrySettings.tenant_id == tenant.id)
#             .first()
#         )

#         webhook_event.last_error = str(e)
#         webhook_event.attempts = 1

#         if settings and settings.enabled:
#             delay_minutes = settings.base_delay_minutes
#             webhook_event.next_retry_at = (
#                 datetime.utcnow() + timedelta(minutes=delay_minutes)
#             )
#             webhook_event.max_attempts = settings.max_attempts
#             webhook_event.status = "retrying"
#         else:
#             webhook_event.status = "dead_letter"
#             webhook_event.max_attempts = 0
#             webhook_event.next_retry_at = None

#         db.commit()

#         return WebhookResponse(
#             success=True,
#             lead_id=0,
#             message="Lead received — will retry internally",
#         )

@router.post("/{webhook_id}", response_model=WebhookResponse)
def receive_lead(
    webhook_id: str,
    payload: WebhookPayload,
    request: Request,
    db: Session = Depends(get_db),
):
    """Receive a lead from an external webhook."""
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
    # 4. CREATE WEBHOOK EVENT (PENDING)
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
    db.commit()
    db.refresh(webhook_event)

    # ============================================================
    # 5. ATTEMPT LEAD CREATION (with auto-link)
    # ============================================================
    try:
        #  AUTO-CREATE / FIND COMPANY
        company = None
        if payload.company:
            company_name_clean = payload.company.strip()
            company = db.query(Company).filter(
                Company.tenant_id == tenant.id,
                func.lower(Company.name) == company_name_clean.lower(),
            ).first()

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

        # ⭐ AUTO-CREATE / FIND CONTACT
        contact = None
        if payload.email:
            contact = db.query(Contact).filter(
                Contact.tenant_id == tenant.id,
                Contact.email == payload.email,
            ).first()

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

        #  CREATE LEAD (with links)
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

        # ============================================================
        # ⭐ 6. AUTO-ATTACH FOLLOW-UP (Hybrid) — SAHI JAGAH
        # ============================================================
        if tenant.auto_followup_enabled and tenant.default_followup_sequence_id:
            try:
                sequence = db.query(FollowupSequence).filter(
                    FollowupSequence.id == tenant.default_followup_sequence_id,
                    FollowupSequence.tenant_id == tenant.id,
                    FollowupSequence.is_active == True,
                ).first()

                if sequence:
                    steps = (
                        db.query(FollowupSequenceStep)
                        .filter(FollowupSequenceStep.sequence_id == sequence.id)
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

                    from sqlalchemy import update as sql_update
                    db.execute(
                        sql_update(Lead)
                        .where(Lead.id == lead.id)
                        .values(followup_sequence_id=sequence.id)
                    )
                    db.commit()
                    logger.info(f"Auto-attached sequence {sequence.id} to lead {lead.id}")
            except Exception as e:
                logger.error(f"Auto-attach failed: {e}")
                print(f"=== AUTO-ATTACH FAILED: {e} ===")   # ← Ye add karo
                import traceback
                traceback.print_exc() 
                # Do NOT fail the webhook

        # ✅ SUCCESS — mark event as success
        webhook_event.status = "success"
        webhook_event.response_status = 200
        webhook_event.attempts = 1
        db.commit()

        return WebhookResponse(
            success=True,
            lead_id=lead.id,
            message="Lead received successfully",
        )

    except Exception as e:
        # ❌ FAILURE — schedule retry
        db.rollback()

        webhook_event = (
            db.query(WebhookEvent)
            .filter(WebhookEvent.id == webhook_event.id)
            .first()
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

        return WebhookResponse(
            success=True,
            lead_id=0,
            message="Lead received — will retry internally",
        )