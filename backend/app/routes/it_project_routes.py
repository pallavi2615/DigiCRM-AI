"""
IT Services — Project routes.

All endpoints require the tenant to be subscribed to 'it_company'.
"""

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy.orm import Session
from sqlalchemy import desc, func
from typing import Optional, List
from datetime import datetime

from app.db.database import get_db
from app.core.permissions import require_feature_permission
from app.core.industry_gate import require_industry
from app.models.user import User
from app.models.it_project import ITProject, IT_PROJECT_STAGES
from app.schemas.it_project import (
    ITProjectCreate,
    ITProjectUpdate,
    ITProjectResponse,
    ITProjectStageUpdate,
    ITProjectStats,
    ITProjectListResponse,
)

router = APIRouter(prefix="/it/projects", tags=["IT Projects"])


# ============================================================
# LIST (with filters + pagination)
# ============================================================

@router.get("", response_model=ITProjectListResponse)
def list_it_projects(
    stage: Optional[str] = None,
    search: Optional[str] = None,
    owner_id: Optional[int] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    """List IT projects for the current tenant."""
    query = db.query(ITProject)

    # Tenant scoping (SuperAdmin sees all)
    if user.role != "super_admin":
        query = query.filter(ITProject.tenant_id == user.tenant_id)
    else:
        query = query.filter(ITProject.tenant_id == user.tenant_id) if user.tenant_id else query

    if stage:
        query = query.filter(ITProject.stage == stage)
    if owner_id:
        query = query.filter(ITProject.owner_id == owner_id)
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (ITProject.name.ilike(pattern)) |
            (ITProject.client_name.ilike(pattern)) |
            (ITProject.client_email.ilike(pattern))
        )

    total = query.count()
    rows = (
        query.order_by(desc(ITProject.created_at))
        .offset(skip).limit(limit).all()
    )

    return ITProjectListResponse(
        data=[ITProjectResponse.model_validate(r) for r in rows],
        total=total,
        skip=skip,
        limit=limit,
    )


# ============================================================
# STATS
# ============================================================

@router.get("/stats", response_model=ITProjectStats)
def it_project_stats(
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    """Aggregate stats for IT projects."""
    query = db.query(ITProject)

    if user.role != "super_admin":
        query = query.filter(ITProject.tenant_id == user.tenant_id)
    elif user.tenant_id:
        query = query.filter(ITProject.tenant_id == user.tenant_id)

    total = query.count()

    # Count by stage
    by_stage = {}
    for s in IT_PROJECT_STAGES:
        by_stage[s] = query.filter(ITProject.stage == s).count()

    total_value = (
        query.with_entities(func.coalesce(func.sum(ITProject.value), 0))
        .scalar() or 0
    )

    won_value = (
        query.filter(ITProject.stage.in_(["delivered", "closed"]))
        .with_entities(func.coalesce(func.sum(ITProject.value), 0))
        .scalar() or 0
    )

    return ITProjectStats(
        total=total,
        by_stage=by_stage,
        total_value=float(total_value),
        won_value=float(won_value),
    )


# ============================================================
# GET SINGLE
# ============================================================

@router.get("/{project_id}", response_model=ITProjectResponse)
def get_it_project(
    project_id: int,
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    """Get a single IT project."""
    query = db.query(ITProject).filter(ITProject.id == project_id)

    if user.role != "super_admin":
        query = query.filter(ITProject.tenant_id == user.tenant_id)

    project = query.first()
    if not project:
        raise HTTPException(404, "Project not found")

    return ITProjectResponse.model_validate(project)


# ============================================================
# CREATE
# ============================================================

@router.post("", response_model=ITProjectResponse, status_code=201)
def create_it_project(
    payload: ITProjectCreate,
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    """Create a new IT project."""
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    project = ITProject(
        tenant_id=user.tenant_id,
        name=payload.name,
        client_name=payload.client_name,
        client_email=payload.client_email,
        stack=payload.stack,
        description=payload.description,
        stage=payload.stage or "discovery",
        value=payload.value or 0,
        currency=payload.currency or "INR",
        start_date=payload.start_date,
        end_date=payload.end_date,
        owner_id=payload.owner_id,
        lead_id=payload.lead_id,
        tags=payload.tags,
        notes=payload.notes,
        created_by=user.id,
    )
    db.add(project)
    db.commit()
    db.refresh(project)

    return ITProjectResponse.model_validate(project)


# ============================================================
# UPDATE
# ============================================================

@router.put("/{project_id}", response_model=ITProjectResponse)
def update_it_project(
    project_id: int,
    payload: ITProjectUpdate,
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    """Update an IT project."""
    query = db.query(ITProject).filter(ITProject.id == project_id)
    if user.role != "super_admin":
        query = query.filter(ITProject.tenant_id == user.tenant_id)

    project = query.first()
    if not project:
        raise HTTPException(404, "Project not found")

    update_data = payload.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(project, key, value)

    db.commit()
    db.refresh(project)
    return ITProjectResponse.model_validate(project)


# ============================================================
# MOVE STAGE (pipeline drag-and-drop)
# ============================================================

@router.patch("/{project_id}/stage", response_model=ITProjectResponse)
def move_it_project_stage(
    project_id: int,
    payload: ITProjectStageUpdate,
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    """Move an IT project to a different stage."""
    query = db.query(ITProject).filter(ITProject.id == project_id)
    if user.role != "super_admin":
        query = query.filter(ITProject.tenant_id == user.tenant_id)

    project = query.first()
    if not project:
        raise HTTPException(404, "Project not found")

    project.stage = payload.stage
    db.commit()
    db.refresh(project)
    return ITProjectResponse.model_validate(project)


# ============================================================
# DELETE
# ============================================================

@router.delete("/{project_id}", status_code=204)
def delete_it_project(
    project_id: int,
    user: User = Depends(require_industry("it_company")),
    db: Session = Depends(get_db),
):
    """Delete an IT project."""
    query = db.query(ITProject).filter(ITProject.id == project_id)
    if user.role != "super_admin":
        query = query.filter(ITProject.tenant_id == user.tenant_id)

    project = query.first()
    if not project:
        raise HTTPException(404, "Project not found")

    db.delete(project)
    db.commit()
    return None