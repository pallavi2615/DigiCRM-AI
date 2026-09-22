from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.lead import Lead
from app.models.tenant_stage import TenantStage
from app.schemas.pipeline import (
    PipelineStage,
    PipelineDeal,
    StageGroup,
    PipelineResponse,
    PipelineStats,
    MoveDealRequest,
)

router = APIRouter(prefix="/pipeline", tags=["Pipeline"])

SUPER_ADMIN_ROLE = "super_admin"

DEFAULT_STAGES = [
    {"key": "new", "label": "New", "color": "#6B7280", "probability": 10, "order_index": 1},
    {"key": "contacted", "label": "Contacted", "color": "#3B82F6", "probability": 25, "order_index": 2},
    {"key": "qualified", "label": "Qualified", "color": "#8B5CF6", "probability": 40, "order_index": 3},
    {"key": "proposal_sent", "label": "Proposal", "color": "#F59E0B", "probability": 60, "order_index": 4},
    {"key": "negotiation", "label": "Negotiation", "color": "#EC4899", "probability": 80, "order_index": 5},
    {"key": "won", "label": "Won", "color": "#10B981", "probability": 100, "order_index": 6, "is_won": True},
    {"key": "lost", "label": "Lost", "color": "#EF4444", "probability": 0, "order_index": 7, "is_lost": True},
]


def _get_stages(db: Session, tenant_id: int) -> list:
    """Fetch tenant's custom stages, fallback to defaults."""
    custom_stages = (
        db.query(TenantStage)
        .filter(TenantStage.tenant_id == tenant_id)
        .order_by(TenantStage.order_index)
        .all()
    )

    if custom_stages:
        return [
            {
                "key": s.name.lower().replace(" ", "_"),
                "label": s.name,
                "color": s.color,
                "probability": 0,
                "order_index": s.order_index,
                "is_won": s.is_won,
                "is_lost": s.is_lost,
            }
            for s in custom_stages
        ]

    return DEFAULT_STAGES


# ============================================================
# GET PIPELINE
# ============================================================

@router.get("", response_model=PipelineResponse)
def get_pipeline(
    priority: Optional[str] = Query(None),
    stage: Optional[str] = Query(None),
    company: Optional[str] = Query(None),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Get the complete pipeline (Kanban view).

    SuperAdmin sees all tenants' leads.
    Admin sees only their own tenant's leads.
    """
    is_superadmin = user.role == SUPER_ADMIN_ROLE

    # Stages — SuperAdmin ke liye default (tenant 1)
    if is_superadmin:
        stages_data = DEFAULT_STAGES
    else:
        if not user.tenant_id:
            raise HTTPException(400, "User has no tenant")
        stages_data = _get_stages(db, user.tenant_id)

    # Leads query
    query = db.query(Lead)
    if not is_superadmin:
        query = query.filter(Lead.tenant_id == user.tenant_id)

    if priority:
        query = query.filter(Lead.priority == priority)
    if company:
        query = query.filter(Lead.company_name.ilike(f"%{company}%"))

    leads = query.order_by(desc(Lead.updated_at)).all()

    # Group by stage
    stage_groups = []
    total_deals = 0
    total_value = 0
    priority_rank = {"urgent": 4, "high": 3, "medium": 2, "low": 1}

    for stage_info in stages_data:
        stage_key = stage_info["key"]

        if stage and stage != stage_key:
            continue

        stage_deals = [
            l for l in leads
            if (l.status or "new").lower() == stage_key
        ]

        stage_deals.sort(
            key=lambda l: (
                -priority_rank.get(l.priority or "medium", 0),
                -(l.updated_at.timestamp() if l.updated_at else 0),
            )
        )

        stage_value = sum(float(l.estimated_value or 0) for l in stage_deals)

        deals_response = [
            PipelineDeal(
                id=l.id,
                company_name=l.company_name,
                contact_person=l.contact_person,
                email=l.email,
                phone=l.phone,
                status=l.status or "new",
                priority=l.priority or "medium",
                estimated_value=float(l.estimated_value or 0),
                expected_close_date=l.expected_close_date,
                source=l.source,
                industry=l.industry,
                updated_at=l.updated_at,
            )
            for l in stage_deals
        ]

        stage_groups.append(StageGroup(
            stage=PipelineStage(**stage_info),
            deals=deals_response,
            count=len(stage_deals),
            total_value=stage_value,
        ))

        total_deals += len(stage_deals)
        total_value += stage_value

    return PipelineResponse(
        stages=stage_groups,
        total_deals=total_deals,
        total_value=total_value,
    )


# ============================================================
# GET STAGES
# ============================================================

@router.get("/stages")
def get_pipeline_stages(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get pipeline stage definitions."""
    if user.role == SUPER_ADMIN_ROLE:
        return DEFAULT_STAGES
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")
    return _get_stages(db, user.tenant_id)


# ============================================================
# PIPELINE STATS
# ============================================================

@router.get("/stats", response_model=PipelineStats)
def get_pipeline_stats(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get aggregated pipeline statistics."""
    is_superadmin = user.role == SUPER_ADMIN_ROLE

    if is_superadmin:
        stages_data = DEFAULT_STAGES
    else:
        if not user.tenant_id:
            raise HTTPException(400, "User has no tenant")
        stages_data = _get_stages(db, user.tenant_id)

    stage_probability = {s["key"]: s.get("probability", 0) for s in stages_data}

    query = db.query(Lead)
    if not is_superadmin:
        query = query.filter(Lead.tenant_id == user.tenant_id)
    leads = query.all()

    by_stage = {}
    total_deals = 0
    total_value = 0
    weighted_value = 0

    for stage_info in stages_data:
        stage_key = stage_info["key"]
        stage_leads = [l for l in leads if (l.status or "new").lower() == stage_key]
        stage_value = sum(float(l.estimated_value or 0) for l in stage_leads)

        by_stage[stage_key] = {
            "label": stage_info["label"],
            "count": len(stage_leads),
            "value": stage_value,
            "probability": stage_probability.get(stage_key, 0),
        }

        total_deals += len(stage_leads)
        total_value += stage_value
        weighted_value += stage_value * stage_probability.get(stage_key, 0) / 100

    return PipelineStats(
        total_deals=total_deals,
        total_value=total_value,
        weighted_value=weighted_value,
        by_stage=by_stage,
    )


# ============================================================
# MOVE DEAL TO STAGE
# ============================================================

@router.patch("/deals/{lead_id}/stage")
def move_deal_to_stage(
    lead_id: int,
    payload: MoveDealRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Move a deal (lead) to a new stage."""
    is_superadmin = user.role == SUPER_ADMIN_ROLE

    query = db.query(Lead).filter(Lead.id == lead_id)
    if not is_superadmin:
        query = query.filter(Lead.tenant_id == user.tenant_id)

    lead = query.first()
    if not lead:
        raise HTTPException(404, "Deal not found")

    if is_superadmin:
        valid_keys = [s["key"] for s in DEFAULT_STAGES]
    else:
        stages_data = _get_stages(db, lead.tenant_id)
        valid_keys = [s["key"] for s in stages_data]

    if payload.status not in valid_keys:
        raise HTTPException(400, f"Invalid stage. Valid: {', '.join(valid_keys)}")

    lead.status = payload.status
    db.commit()
    db.refresh(lead)

    return {
        "success": True,
        "deal_id": lead.id,
        "new_status": lead.status,
        "message": f"Deal moved to '{payload.status}'",
    }