from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List
from datetime import datetime, date
import secrets

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
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

router = APIRouter(prefix="/proposals", tags=["Proposals"])

SUPER_ADMIN_ROLE = "super_admin"


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def apply_tenant_filter(query, user: User):
    """Apply role-based tenant filtering."""
    if user.role != SUPER_ADMIN_ROLE:
        query = query.filter(Proposal.tenant_id == user.tenant_id)
    return query


def get_proposal_or_404(db: Session, proposal_id: int, user: User) -> Proposal:
    """Fetch a proposal with tenant access control."""
    query = apply_tenant_filter(
        db.query(Proposal), user
    ).filter(Proposal.id == proposal_id)

    proposal = query.first()
    if not proposal:
        raise HTTPException(status_code=404, detail="Proposal not found")
    return proposal


# ============================================================
# STATIC ROUTES (must come first)
# ============================================================

# ============ LIST ============
@router.get("", response_model=List[ProposalResponse])
def list_proposals(
    status_filter: Optional[str] = Query(None, alias="status"),
    pipeline_stage: Optional[str] = None,
    approval_status: Optional[str] = None,
    lead_id: Optional[int] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve proposals with filters and pagination."""
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
        query
        .order_by(desc(Proposal.created_at))
        .offset(skip)
        .limit(limit)
        .all()
    )


# ============ STATS ============
@router.get("/stats")
def proposal_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return proposal statistics including weighted forecast."""
    query = apply_tenant_filter(db.query(Proposal), user)

    total = query.count()
    draft = query.filter(Proposal.status == "draft").count()
    sent = query.filter(Proposal.status == "sent").count()
    accepted = query.filter(Proposal.status == "accepted").count()
    declined = query.filter(Proposal.status == "declined").count()

    # Revenue metrics
    total_value = query.with_entities(func.sum(Proposal.amount)).scalar() or 0

    accepted_value = (
        query
        .filter(Proposal.status == "accepted")
        .with_entities(func.sum(Proposal.amount))
        .scalar()
        or 0
    )

    # Open value (not accepted/declined)
    open_value = (
        query
        .filter(~Proposal.status.in_(["accepted", "declined"]))
        .with_entities(func.sum(Proposal.amount))
        .scalar()
        or 0
    )

    # Weighted forecast: sum(amount * probability / 100)
    weighted_forecast = (
        query
        .with_entities(
            func.sum(Proposal.amount * Proposal.probability / 100.0)
        )
        .scalar()
        or 0
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


# ============ PUBLIC VIEW ============
@router.get("/public/{token}", response_model=ProposalPublic)
def get_public_proposal(
    token: str,
    db: Session = Depends(get_db),
):
    """Retrieve a proposal using its public share token (no auth)."""
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

# ============ GET SINGLE ============
@router.get("/{proposal_id}", response_model=ProposalResponse)
def get_proposal(
    proposal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a single proposal by ID."""
    return get_proposal_or_404(db, proposal_id, user)


# ============ CREATE ============
@router.post("", response_model=ProposalResponse, status_code=201)
def create_proposal(
    payload: ProposalCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new proposal."""
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

    # If "Save as template" is checked
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

    db.commit()
    db.refresh(proposal)
    return proposal

# ============ UPDATE ============
@router.put("/{proposal_id}", response_model=ProposalResponse)
def update_proposal(
    proposal_id: int,
    payload: ProposalUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update a proposal."""
    proposal = get_proposal_or_404(db, proposal_id, user)

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(proposal, key, value)

    db.commit()
    db.refresh(proposal)
    return proposal


# ============ PATCH STATUS ============
@router.patch("/{proposal_id}/status", response_model=ProposalResponse)
def update_proposal_status(
    proposal_id: int,
    payload: ProposalStatusUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update only the status of a proposal."""
    proposal = get_proposal_or_404(db, proposal_id, user)
    proposal.status = payload.status
    db.commit()
    db.refresh(proposal)
    return proposal


# ============ SEND ============
@router.post("/{proposal_id}/send", response_model=ProposalResponse)
def send_proposal(
    proposal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a proposal as sent (only from draft)."""
    proposal = get_proposal_or_404(db, proposal_id, user)

    if proposal.status != "draft":
        raise HTTPException(
            status_code=400,
            detail=f"Cannot send proposal with status '{proposal.status}'",
        )

    proposal.status = "sent"
    proposal.sent_at = datetime.utcnow()
    db.commit()
    db.refresh(proposal)
    return proposal


# ============ ACCEPT ============
@router.post("/{proposal_id}/accept", response_model=ProposalResponse)
def accept_proposal(
    proposal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a proposal as accepted and update lead status."""
    proposal = get_proposal_or_404(db, proposal_id, user)

    proposal.status = "accepted"
    proposal.accepted_at = datetime.utcnow()

    if proposal.lead_id:
        lead = db.query(Lead).filter(Lead.id == proposal.lead_id).first()
        if lead:
            lead.status = "won"

    db.commit()
    db.refresh(proposal)
    return proposal


# ============ DECLINE ============
@router.post("/{proposal_id}/decline", response_model=ProposalResponse)
def decline_proposal(
    proposal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Mark a proposal as declined and update lead status."""
    proposal = get_proposal_or_404(db, proposal_id, user)

    proposal.status = "declined"
    proposal.declined_at = datetime.utcnow()

    if proposal.lead_id:
        lead = db.query(Lead).filter(Lead.id == proposal.lead_id).first()
        if lead:
            lead.status = "lost"

    db.commit()
    db.refresh(proposal)
    return proposal


# ============ APPROVE (NEW) ============
@router.post("/{proposal_id}/approve", response_model=ProposalResponse)
def approve_proposal(
    proposal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Approve a proposal (sets approval_status = 'approved')."""
    proposal = get_proposal_or_404(db, proposal_id, user)
    proposal.approval_status = "approved"
    db.commit()
    db.refresh(proposal)
    return proposal


# ============ REJECT (NEW) ============
@router.post("/{proposal_id}/reject", response_model=ProposalResponse)
def reject_proposal(
    proposal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Reject a proposal (sets approval_status = 'rejected')."""
    proposal = get_proposal_or_404(db, proposal_id, user)
    proposal.approval_status = "rejected"
    db.commit()
    db.refresh(proposal)
    return proposal


# ============ DELETE ============
@router.delete("/{proposal_id}", status_code=204)
def delete_proposal(
    proposal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a proposal."""
    proposal = get_proposal_or_404(db, proposal_id, user)
    db.delete(proposal)
    db.commit()
    return None


# ============ Generate with AI ============
@router.post("/generate-document")
def generate_document(
    payload: dict,
    user: User = Depends(get_current_user),
):
    """
    Generate a proposal document using AI.

    Payload:
        title, lead_name, amount, terms, notes

    Returns:
        { "document_content": "..." }
    """
    # For now, return a template-based document
    # TODO: Integrate OpenAI/Claude API
    
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
