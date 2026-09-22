from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
import secrets

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.proposal_template import ProposalTemplate
from app.models.proposal import Proposal
from app.schemas.proposal_template import (
    TemplateCreate,
    TemplateUpdate,
    TemplateResponse,
)

router = APIRouter(prefix="/proposal-templates", tags=["Proposal Templates"])

SUPER_ADMIN_ROLE = "super_admin"


def apply_template_filter(query, user: User):
    """Apply tenant filtering for templates."""
    if user.role != SUPER_ADMIN_ROLE:
        query = query.filter(ProposalTemplate.tenant_id == user.tenant_id)
    return query


# ============ LIST ============
@router.get("", response_model=List[TemplateResponse])
def list_templates(
    category: Optional[str] = None,
    search: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all proposal templates."""
    query = apply_template_filter(db.query(ProposalTemplate), user)

    if category:
        query = query.filter(ProposalTemplate.category == category)
    if search:
        query = query.filter(ProposalTemplate.title.ilike(f"%{search}%"))

    return query.order_by(desc(ProposalTemplate.created_at)).offset(skip).limit(limit).all()


# ============ USE TEMPLATE ============
@router.post("/{template_id}/use", status_code=201)
def use_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new proposal from a template."""
    query = apply_template_filter(
        db.query(ProposalTemplate), user
    ).filter(ProposalTemplate.id == template_id)

    template = query.first()
    if not template:
        raise HTTPException(404, "Template not found")

    if not user.tenant_id:
        raise HTTPException(400, "User is not associated with a tenant")

    public_token = secrets.token_urlsafe(32)

    proposal = Proposal(
        tenant_id=user.tenant_id,
        title=template.title,
        description=template.description,
        amount=template.amount,
        currency=template.currency,
        terms=template.terms,
        status="draft",
        public_token=public_token,
        version="v1",
        approval_status="pending",
        pipeline_stage="in_pipeline",
        template_id=template.id,
        created_by=user.id,
    )
    db.add(proposal)
    db.commit()
    db.refresh(proposal)

    return {
        "success": True,
        "proposal_id": proposal.id,
        "message": "Proposal created from template",
    }


# ============ GET SINGLE ============
@router.get("/{template_id}", response_model=TemplateResponse)
def get_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve a single template."""
    query = apply_template_filter(
        db.query(ProposalTemplate), user
    ).filter(ProposalTemplate.id == template_id)

    template = query.first()
    if not template:
        raise HTTPException(404, "Template not found")
    return template


# ============ CREATE ============
@router.post("", response_model=TemplateResponse, status_code=201)
def create_template(
    payload: TemplateCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new proposal template."""
    if not user.tenant_id:
        raise HTTPException(400, "User is not associated with a tenant")

    template = ProposalTemplate(
        tenant_id=user.tenant_id,
        title=payload.title,
        description=payload.description,
        category=payload.category,
        owner_label=payload.owner_label,
        amount=payload.amount or 0,
        currency=payload.currency or "INR",
        terms=payload.terms,
        content=payload.content or {},
        shared_with_team=payload.shared_with_team,
        created_by=user.id,
    )
    db.add(template)
    db.commit()
    db.refresh(template)
    return template


# ============ UPDATE ============
@router.put("/{template_id}", response_model=TemplateResponse)
def update_template(
    template_id: int,
    payload: TemplateUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing template."""
    query = apply_template_filter(
        db.query(ProposalTemplate), user
    ).filter(ProposalTemplate.id == template_id)

    template = query.first()
    if not template:
        raise HTTPException(404, "Template not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(template, key, value)

    db.commit()
    db.refresh(template)
    return template


# ============ DELETE ============
@router.delete("/{template_id}", status_code=204)
def delete_template(
    template_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a template."""
    query = apply_template_filter(
        db.query(ProposalTemplate), user
    ).filter(ProposalTemplate.id == template_id)

    template = query.first()
    if not template:
        raise HTTPException(404, "Template not found")

    db.delete(template)
    db.commit()
    return None