from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List
from datetime import datetime, date
import secrets
import logging

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.config import settings                                  # ⭐ NEW
from app.core.permissions import require_feature_permission, require_role
from app.core.constants import (
    SUPER_ADMIN_ROLE as SA_CONST,
    ADMIN_ROLE,
    MANAGER_ROLE,
)
from app.services.audit_service import AuditService
from app.services.notification_service import NotificationService
from app.models.user import User
from app.models.tenant import Tenant                                  # ⭐ NEW
from app.models.lead import Lead
from app.models.proposal import Proposal
from app.schemas.proposal import (
    ProposalCreate,
    ProposalUpdate,
    ProposalResponse,
    ProposalStatusUpdate,
    ProposalPublic,
    MessageResponse,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/proposals", tags=["Proposals"])

SUPER_ADMIN_ROLE = "super_admin"


# ============================================================
# HELPERS
# ============================================================

def apply_tenant_filter(query, user: User):
    if user.role != SA_CONST:
        query = query.filter(Proposal.tenant_id == user.tenant_id)
    if user.role in ("sales_executive", "executive"):
        query = query.filter(Proposal.created_by == user.id)
    return query


def get_proposal_or_404(db: Session, proposal_id: int, user: User) -> Proposal:
    query = apply_tenant_filter(
        db.query(Proposal), user
    ).filter(Proposal.id == proposal_id)

    proposal = query.first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal


def _snapshot(proposal: Proposal) -> dict:
    return {c.name: getattr(proposal, c.name) for c in proposal.__table__.columns}


def _notify_owner(
    db: Session,
    proposal: Proposal,
    actor: User,
    kind: str,
    message: str,
) -> None:
    if not proposal.created_by or proposal.created_by == actor.id:
        return
    try:
        notif = NotificationService(db)
        if kind == "accepted":
            notif.notify_proposal_accepted(
                user_id=proposal.created_by,
                tenant_id=proposal.tenant_id,
                proposal_id=proposal.id,
                proposal_title=proposal.title or f"Proposal #{proposal.id}",
            )
        elif kind == "declined":
            notif.notify_proposal_declined(
                user_id=proposal.created_by,
                tenant_id=proposal.tenant_id,
                proposal_id=proposal.id,
                proposal_title=proposal.title or f"Proposal #{proposal.id}",
            )
        else:
            notif.create(
                user_id=proposal.created_by,
                tenant_id=proposal.tenant_id,
                type=f"proposal_{kind}",
                title=f"Proposal {kind}: {proposal.title or f'#{proposal.id}'}",
                message=message,
                entity_type="proposal",
                entity_id=proposal.id,
                action_url=f"/proposals/{proposal.id}",
            )
    except Exception as e:
        logger.exception("Failed to notify proposal owner: %s", e)


# ============================================================
# STATIC ROUTES
# ============================================================

@router.get("", response_model=List[ProposalResponse])
def list_proposals(
    status_filter: Optional[str] = Query(None, alias="status"),
    pipeline_stage: Optional[str] = None,
    approval_status: Optional[str] = None,
    lead_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(require_feature_permission("pipeline", "view")),
    db: Session = Depends(get_db),
):
    query = apply_tenant_filter(db.query(Proposal), user)

    if status_filter:
        query = query.filter(Proposal.status == status_filter)
    if pipeline_stage:
        query = query.filter(Proposal.pipeline_stage == pipeline_stage)
    if approval_status:
        query = query.filter(Proposal.approval_status == approval_status)
    if lead_id:
        query = query.filter(Proposal.lead_id == lead_id)
    if search:
        query = query.filter(Proposal.title.ilike(f"%{search}%"))

    return (
        query.order_by(desc(Proposal.created_at))
        .offset(skip).limit(limit).all()
    )


@router.get("/stats")
def proposal_stats(
    user: User = Depends(require_feature_permission("pipeline", "view")),
    db: Session = Depends(get_db),
):
    query = apply_tenant_filter(db.query(Proposal), user)

    total = query.count()
    draft = query.filter(Proposal.status == "draft").count()
    sent = query.filter(Proposal.status == "sent").count()
    accepted = query.filter(Proposal.status == "accepted").count()
    declined = query.filter(Proposal.status == "declined").count()

    total_value = query.with_entities(func.sum(Proposal.amount)).scalar() or 0
    accepted_value = (
        query.filter(Proposal.status == "accepted")
        .with_entities(func.sum(Proposal.amount)).scalar() or 0
    )
    open_value = (
        query.filter(~Proposal.status.in_(["accepted", "declined"]))
        .with_entities(func.sum(Proposal.amount)).scalar() or 0
    )
    weighted_forecast = (
        query.with_entities(
            func.sum(Proposal.amount * Proposal.probability / 100.0)
        ).scalar() or 0
    )

    return {
        "total": total,
        "draft": draft,
        "sent": sent,
        "accepted": accepted,
        "declined": declined,
        "total_value": float(total_value),
        "accepted_value": float(accepted_value),
        "open_value": float(open_value),
        "weighted_forecast": float(weighted_forecast),
    }


@router.get("/public/{token}", response_model=ProposalPublic)
def get_public_proposal(
    token: str,
    db: Session = Depends(get_db),
):
    proposal = (
        db.query(Proposal)
        .filter(Proposal.public_token == token)
        .first()
    )
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")

    if not proposal.viewed_at:
        proposal.viewed_at = datetime.utcnow()
        db.commit()

    return proposal


# ============================================================
# DYNAMIC ROUTES
# ============================================================

@router.get("/{proposal_id}", response_model=ProposalResponse)
def get_proposal(
    proposal_id: int,
    user: User = Depends(require_feature_permission("pipeline", "view")),
    db: Session = Depends(get_db),
):
    return get_proposal_or_404(db, proposal_id, user)


@router.post("", response_model=ProposalResponse, status_code=201)
def create_proposal(
    payload: ProposalCreate,
    request: Request,
    user: User = Depends(require_feature_permission("pipeline", "create")),
    db: Session = Depends(get_db),
):
    if not user.tenant_id:
        raise HTTPException(400, "User is not associated with a tenant")

    public_token = secrets.token_urlsafe(32)

    proposal = Proposal(
        tenant_id=user.tenant_id,
        lead_id=payload.lead_id,
        contact_id=payload.contact_id,
        contact_name=payload.contact_name,
        contact_email=payload.contact_email,
        company_name=payload.company_name,
        title=payload.title,
        description=payload.description,
        notes=payload.notes,
        document_content=payload.document_content,
        amount=payload.amount or 0,
        currency=payload.currency or "INR",
        status="draft",
        valid_until=payload.valid_until,
        terms=payload.terms,
        public_token=public_token,
        probability=payload.probability or 0,
        close_date=payload.close_date,
        owner=payload.owner,
        version=payload.version or "v1",
        approval_status=payload.approval_status or "pending",
        pipeline_stage=payload.pipeline_stage or "in_pipeline",
        lead_name=payload.lead_name,
        template_id=payload.template_id,
        created_by=user.id,
    )
    db.add(proposal)
    db.flush()

    if payload.save_as_template:
        from app.models.proposal_template import ProposalTemplate
        template = ProposalTemplate(
            tenant_id=user.tenant_id,
            title=payload.title,
            description=payload.description,
            category=None,
            owner_label=payload.owner,
            amount=payload.amount or 0,
            currency=payload.currency or "INR",
            terms=payload.terms,
            content={"document_content": payload.document_content},
            shared_with_team=True,
            created_by=user.id,
        )
        db.add(template)
        db.flush()
        proposal.template_id = template.id

    AuditService(db).log_created_obj(
        entity_obj=proposal,
        tenant_id=user.tenant_id,
        user=user,
        request=request,
    )

    db.commit()
    db.refresh(proposal)
    return proposal


@router.put("/{proposal_id}", response_model=ProposalResponse)
def update_proposal(
    proposal_id: int,
    payload: ProposalUpdate,
    request: Request,
    user: User = Depends(require_feature_permission("pipeline", "edit")),
    db: Session = Depends(get_db),
):
    proposal = get_proposal_or_404(db, proposal_id, user)

    before = _snapshot(proposal)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(proposal, key, value)
    db.flush()

    after = _snapshot(proposal)

    svc = AuditService(db)
    changes = svc.diff(before, after, ignore_fields=["updated_at"])
    if changes:
        svc.log_updated_obj(
            entity_obj=proposal,
            tenant_id=proposal.tenant_id,
            user=user,
            changes=changes,
            request=request,
        )

    db.commit()
    db.refresh(proposal)
    return proposal


@router.patch("/{proposal_id}/status", response_model=ProposalResponse)
def update_proposal_status(
    proposal_id: int,
    payload: ProposalStatusUpdate,
    request: Request,
    user: User = Depends(require_feature_permission("pipeline", "edit")),
    db: Session = Depends(get_db),
):
    proposal = get_proposal_or_404(db, proposal_id, user)

    old_status = proposal.status
    proposal.status = payload.status

    if old_status != payload.status:
        AuditService(db).log_updated_obj(
            entity_obj=proposal,
            tenant_id=proposal.tenant_id,
            user=user,
            changes={"status": {"before": old_status, "after": payload.status}},
            request=request,
        )

    db.commit()
    db.refresh(proposal)
    return proposal


# ============ SEND (via email) ============
@router.post("/{proposal_id}/send", response_model=ProposalResponse)
def send_proposal(
    proposal_id: int,
    request: Request,
    user: User = Depends(require_feature_permission("pipeline", "edit")),
    db: Session = Depends(get_db),
):
    """Send proposal to client via email."""
    proposal = get_proposal_or_404(db, proposal_id, user)

    # Allow resending from any status except accepted/declined
    if proposal.status in ("accepted", "declined"):
        raise HTTPException(
            status_code=400,
            detail=f"Cannot send proposal with status '{proposal.status}'",
        )

    # ⭐ Validate email — try multiple sources
    client_email = proposal.contact_email

    # Fallback: try linked lead's email
    if not client_email and proposal.lead_id:
        lead = db.query(Lead).filter(Lead.id == proposal.lead_id).first()
        if lead:
            client_email = lead.email

    if not client_email:
        raise HTTPException(
            400,
            "Client email is required. Please add a contact email "
            "or link a lead with an email.",
        )

    # ⭐ Public URL
    public_url = f"{settings.FRONTEND_URL}/proposals/public/{proposal.public_token}"

    # ⭐ Company & sender
    tenant = db.query(Tenant).filter(Tenant.id == proposal.tenant_id).first()
    company_name = tenant.name if tenant else "Our Company"

    valid_until_str = (
        proposal.valid_until.strftime("%d %b %Y")
        if proposal.valid_until else None
    )

    # ⭐ Send email
    from app.utils.email import send_proposal_email

    email_sent = False
    email_error = None
    try:
        email_sent = send_proposal_email(
            to_email=client_email,
            client_name=proposal.contact_name or proposal.lead_name,
            proposal_title=proposal.title,
            proposal_amount=float(proposal.amount or 0),
            proposal_currency=proposal.currency or "INR",
            company_name=company_name,
            sender_name=user.full_name,
            public_url=public_url,
            valid_until=valid_until_str,
            message=proposal.description,
        )
    except Exception as e:
        logger.exception("Failed to send proposal email: %s", e)
        email_error = str(e)

    if not email_sent:
        raise HTTPException(
            500,
            f"Failed to send email: {email_error or 'check SMTP settings'}",
        )

    # ⭐ Update status
    old_status = proposal.status
    proposal.status = "sent"
    proposal.sent_at = datetime.utcnow()

    AuditService(db).log_updated_obj(
        entity_obj=proposal,
        tenant_id=proposal.tenant_id,
        user=user,
        changes={"status": {"before": old_status, "after": "sent"}},
        request=request,
    )

    db.commit()
    db.refresh(proposal)

    # Automation
    if proposal.lead_id:
        lead = db.query(Lead).filter(Lead.id == proposal.lead_id).first()
        if lead:
            from app.services.automation_service import AutomationEngine
            engine = AutomationEngine(db)
            engine.trigger_event(
                tenant_id=user.tenant_id,
                event="proposal_sent",
                entity_type="lead",
                entity=lead,
            )

    return proposal


@router.post("/{proposal_id}/accept", response_model=ProposalResponse)
def accept_proposal(
    proposal_id: int,
    request: Request,
    user: User = Depends(require_feature_permission("pipeline", "edit")),
    db: Session = Depends(get_db),
):
    proposal = get_proposal_or_404(db, proposal_id, user)

    old_status = proposal.status
    proposal.status = "accepted"
    proposal.accepted_at = datetime.utcnow()

    if proposal.lead_id:
        lead = db.query(Lead).filter(Lead.id == proposal.lead_id).first()
        if lead:
            lead.status = "won"
            lead.updated_at = datetime.utcnow()

    AuditService(db).log_updated_obj(
        entity_obj=proposal,
        tenant_id=proposal.tenant_id,
        user=user,
        changes={"status": {"before": old_status, "after": "accepted"}},
        request=request,
    )

    _notify_owner(
        db, proposal, user,
        kind="accepted",
        message="Great news — the client accepted!",
    )

    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/{proposal_id}/decline", response_model=ProposalResponse)
def decline_proposal(
    proposal_id: int,
    request: Request,
    user: User = Depends(require_feature_permission("pipeline", "edit")),
    db: Session = Depends(get_db),
):
    proposal = get_proposal_or_404(db, proposal_id, user)

    old_status = proposal.status
    proposal.status = "declined"
    proposal.declined_at = datetime.utcnow()

    if proposal.lead_id:
        lead = db.query(Lead).filter(Lead.id == proposal.lead_id).first()
        if lead:
            lead.status = "lost"

    AuditService(db).log_updated_obj(
        entity_obj=proposal,
        tenant_id=proposal.tenant_id,
        user=user,
        changes={"status": {"before": old_status, "after": "declined"}},
        request=request,
    )

    _notify_owner(
        db, proposal, user,
        kind="declined",
        message="The client declined this proposal.",
    )

    db.commit()
    db.refresh(proposal)

    if proposal.lead_id:
        lead = db.query(Lead).filter(Lead.id == proposal.lead_id).first()
        if lead:
            from app.services.automation_service import AutomationEngine
            engine = AutomationEngine(db)
            engine.trigger_event(
                tenant_id=user.tenant_id,
                event="proposal_declined",
                entity_type="lead",
                entity=lead,
            )

    return proposal


@router.post("/{proposal_id}/approve", response_model=ProposalResponse)
def approve_proposal(
    proposal_id: int,
    request: Request,
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE, MANAGER_ROLE)),
    db: Session = Depends(get_db),
):
    proposal = get_proposal_or_404(db, proposal_id, user)

    old_status = proposal.approval_status
    proposal.approval_status = "approved"

    AuditService(db).log_updated_obj(
        entity_obj=proposal,
        tenant_id=proposal.tenant_id,
        user=user,
        changes={"approval_status": {"before": old_status, "after": "approved"}},
        request=request,
    )

    _notify_owner(
        db, proposal, user,
        kind="approved",
        message="Your proposal was approved by the manager.",
    )

    db.commit()
    db.refresh(proposal)
    return proposal


@router.post("/{proposal_id}/reject", response_model=ProposalResponse)
def reject_proposal(
    proposal_id: int,
    request: Request,
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE, MANAGER_ROLE)),
    db: Session = Depends(get_db),
):
    proposal = get_proposal_or_404(db, proposal_id, user)

    old_status = proposal.approval_status
    proposal.approval_status = "rejected"

    AuditService(db).log_updated_obj(
        entity_obj=proposal,
        tenant_id=proposal.tenant_id,
        user=user,
        changes={"approval_status": {"before": old_status, "after": "rejected"}},
        request=request,
    )

    _notify_owner(
        db, proposal, user,
        kind="rejected",
        message="Your proposal was rejected.",
    )

    db.commit()
    db.refresh(proposal)
    return proposal


@router.delete("/{proposal_id}", status_code=204)
def delete_proposal(
    proposal_id: int,
    request: Request,
    user: User = Depends(require_feature_permission("pipeline", "delete")),
    db: Session = Depends(get_db),
):
    proposal = get_proposal_or_404(db, proposal_id, user)

    AuditService(db).log_deleted_obj(
        entity_obj=proposal,
        tenant_id=proposal.tenant_id,
        user=user,
        request=request,
    )

    db.delete(proposal)
    db.commit()
    return None


@router.post("/generate-document")
def generate_document(
    payload: dict,
    user: User = Depends(require_feature_permission("pipeline", "create")),
):
    title = payload.get("title", "Business Proposal")
    lead_name = payload.get("lead_name", "The Client")
    amount = payload.get("amount", 0)
    terms = payload.get("terms", "")

    from datetime import datetime
    document = f"""# {title}

**Prepared for:** {lead_name}
**Prepared by:** {user.full_name}
**Date:** {datetime.now().strftime('%B %d, %Y')}
**Facility Value:** ₹{amount:,.2f}

---

## 1. Executive Summary

This proposal outlines the terms and conditions for the requested facility.

## 2. Scope of Services

- Service 1
- Service 2
- Service 3

## 3. Commercial Terms

{terms or "Standard terms apply."}

## 4. Next Steps

Please review and sign to proceed.

---

*This document was generated by DigiCRM AI.*
"""
    return {"document_content": document}