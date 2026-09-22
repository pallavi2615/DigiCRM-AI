from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime, date, timedelta

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.lead import Lead
from app.models.Followup import (
    FollowupSequence,
    FollowupSequenceStep,
    FollowupTask,
    LeadResponse,
)
from app.schemas.followup import (
    SequenceCreate,
    SequenceResponse,
    TaskCreate,
    TaskUpdate,
    TaskResponse,
    LeadResponseCreate,
    LeadResponseResponse,
    AttachSequenceRequest,
)

router = APIRouter(prefix="/followups", tags=["Follow-ups"])

SUPER_ADMIN_ROLE = "super_admin"


def _tenant_filter(query, model, user: User):
    if user.role != SUPER_ADMIN_ROLE:
        query = query.filter(model.tenant_id == user.tenant_id)
    return query


# ============================================================
# SEQUENCES
# ============================================================

@router.get("/sequences", response_model=List[SequenceResponse])
def list_sequences(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _tenant_filter(db.query(FollowupSequence), FollowupSequence, user)
    sequences = query.order_by(desc(FollowupSequence.created_at)).all()

    result = []
    for seq in sequences:
        steps = (
            db.query(FollowupSequenceStep)
            .filter(FollowupSequenceStep.sequence_id == seq.id)
            .order_by(FollowupSequenceStep.step_order)
            .all()
        )
        result.append(SequenceResponse(
            id=seq.id, tenant_id=seq.tenant_id, name=seq.name,
            description=seq.description, is_active=seq.is_active,
            total_steps=seq.total_steps, steps=steps, created_at=seq.created_at,
        ))
    return result


@router.post("/sequences", response_model=SequenceResponse, status_code=201)
def create_sequence(
    payload: SequenceCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    sequence = FollowupSequence(
        tenant_id=user.tenant_id,
        name=payload.name,
        description=payload.description,
        is_active=payload.is_active if payload.is_active is not None else True,
        created_by=user.id,
    )
    db.add(sequence)
    db.flush()

    for step_data in (payload.steps or []):
        db.add(FollowupSequenceStep(
            sequence_id=sequence.id,
            step_order=step_data.step_order,
            delay_days=step_data.delay_days,
            action_type=step_data.action_type,
            title=step_data.title,
            description=step_data.description,
            template=step_data.template,
        ))

    sequence.total_steps = len(payload.steps or [])
    db.commit()
    db.refresh(sequence)

    steps = (
        db.query(FollowupSequenceStep)
        .filter(FollowupSequenceStep.sequence_id == sequence.id)
        .order_by(FollowupSequenceStep.step_order)
        .all()
    )

    return SequenceResponse(
        id=sequence.id, tenant_id=sequence.tenant_id, name=sequence.name,
        description=sequence.description, is_active=sequence.is_active,
        total_steps=sequence.total_steps, steps=steps, created_at=sequence.created_at,
    )


@router.get("/sequences/{sequence_id}", response_model=SequenceResponse)
def get_sequence(
    sequence_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _tenant_filter(db.query(FollowupSequence), FollowupSequence, user)
    seq = query.filter(FollowupSequence.id == sequence_id).first()
    if not seq:
        raise HTTPException(404, "Sequence not found")

    steps = (
        db.query(FollowupSequenceStep)
        .filter(FollowupSequenceStep.sequence_id == seq.id)
        .order_by(FollowupSequenceStep.step_order)
        .all()
    )

    return SequenceResponse(
        id=seq.id, tenant_id=seq.tenant_id, name=seq.name,
        description=seq.description, is_active=seq.is_active,
        total_steps=seq.total_steps, steps=steps, created_at=seq.created_at,
    )


@router.delete("/sequences/{sequence_id}", status_code=204)
def delete_sequence(
    sequence_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _tenant_filter(db.query(FollowupSequence), FollowupSequence, user)
    seq = query.filter(FollowupSequence.id == sequence_id).first()
    if not seq:
        raise HTTPException(404, "Sequence not found")
    db.delete(seq)
    db.commit()
    return None


# ============================================================
# TASKS
# ============================================================

@router.get("/tasks", response_model=List[TaskResponse])
def list_tasks(
    status: Optional[str] = None,
    lead_id: Optional[int] = None,
    due_today: Optional[bool] = False,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _tenant_filter(db.query(FollowupTask), FollowupTask, user)
    if status:
        query = query.filter(FollowupTask.status == status)
    if lead_id:
        query = query.filter(FollowupTask.lead_id == lead_id)
    if due_today:
        query = query.filter(FollowupTask.due_date == date.today())

    return query.order_by(FollowupTask.due_date, desc(FollowupTask.created_at)).offset(skip).limit(limit).all()


@router.post("/tasks", response_model=TaskResponse, status_code=201)
def create_task(
    payload: TaskCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    task = FollowupTask(
        tenant_id=user.tenant_id,
        lead_id=payload.lead_id,
        title=payload.title,
        description=payload.description,
        action_type=payload.action_type or "task",
        priority=payload.priority or "medium",
        due_date=payload.due_date,
        assigned_to=payload.assigned_to,
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.put("/tasks/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _tenant_filter(db.query(FollowupTask), FollowupTask, user)
    task = query.filter(FollowupTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")

    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("status") == "completed" and task.status != "completed":
        task.completed_at = datetime.utcnow()
        task.completed_by = user.id

    for key, value in update_data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return task


@router.delete("/tasks/{task_id}", status_code=204)
def delete_task(
    task_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _tenant_filter(db.query(FollowupTask), FollowupTask, user)
    task = query.filter(FollowupTask.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    db.delete(task)
    db.commit()
    return None


# ============================================================
# ATTACH SEQUENCE TO LEAD
# ============================================================

@router.post("/leads/{lead_id}/attach-sequence")
def attach_sequence_to_lead(
    lead_id: int,
    payload: AttachSequenceRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Attach a follow-up sequence to a lead — auto-creates tasks."""
    # Get lead
    lead_query = db.query(Lead).filter(Lead.id == lead_id)
    if user.role != SUPER_ADMIN_ROLE:
        lead_query = lead_query.filter(Lead.tenant_id == user.tenant_id)
    lead = lead_query.first()
    if not lead:
        raise HTTPException(404, "Lead not found")

    # Get sequence
    seq_query = db.query(FollowupSequence).filter(FollowupSequence.id == payload.sequence_id)
    if user.role != SUPER_ADMIN_ROLE:
        seq_query = seq_query.filter(FollowupSequence.tenant_id == user.tenant_id)
    seq = seq_query.first()
    if not seq:
        raise HTTPException(404, "Sequence not found")

    # Get steps
    steps = (
        db.query(FollowupSequenceStep)
        .filter(FollowupSequenceStep.sequence_id == seq.id)
        .order_by(FollowupSequenceStep.step_order)
        .all()
    )

    # Delete existing pending tasks for this lead
    db.query(FollowupTask).filter(
        FollowupTask.lead_id == lead.id,
        FollowupTask.status == "pending",
    ).delete()

    # Base date
    base_date = (lead.created_at.date() if lead.created_at else date.today())

    created = []
    for step in steps:
        due = base_date + timedelta(days=step.delay_days)
        task = FollowupTask(
            tenant_id=user.tenant_id,
            lead_id=lead.id,
            sequence_id=seq.id,
            step_id=step.id,
            title=step.title,
            description=step.description,
            action_type=step.action_type,
            status="pending",
            priority="medium",
            due_date=due,
            assigned_to=user.id,
        )
        db.add(task)
        created.append(task)

    lead.followup_sequence_id = seq.id
    db.commit()

    return {
        "success": True,
        "lead_id": lead.id,
        "sequence_id": seq.id,
        "tasks_created": len(created),
        "message": f"{len(created)} follow-up tasks created",
    }


# ============================================================
# LEAD RESPONSES
# ============================================================

@router.get("/responses/{lead_id}", response_model=List[LeadResponseResponse])
def list_lead_responses(
    lead_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _tenant_filter(db.query(LeadResponse), LeadResponse, user)
    return query.filter(LeadResponse.lead_id == lead_id).order_by(desc(LeadResponse.responded_at)).all()


@router.post("/responses", response_model=LeadResponseResponse, status_code=201)
def create_lead_response(
    payload: LeadResponseCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record a lead response — stops pending follow-up tasks."""
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    response = LeadResponse(
        tenant_id=user.tenant_id,
        lead_id=payload.lead_id,
        response_type=payload.response_type,
        response_text=payload.response_text,
        created_by=user.id,
    )
    db.add(response)

    # Auto-stop pending tasks
    db.query(FollowupTask).filter(
        FollowupTask.lead_id == payload.lead_id,
        FollowupTask.status == "pending",
    ).update({"status": "skipped"})

    db.commit()
    db.refresh(response)
    return response