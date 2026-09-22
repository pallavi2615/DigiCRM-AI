import os
import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_
from typing import Optional, List
from datetime import datetime, date

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.task import Task, TaskAttachment
from app.schemas.task import (
    TaskCreate, TaskUpdate, TaskResponse, AttachmentResponse,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])

SUPER_ADMIN_ROLE = "super_admin"

# Upload settings
UPLOAD_DIR = "uploads/tasks"
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_TYPES = [
    "image/jpeg", "image/png", "image/gif", "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/plain",
    "text/csv",
]

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10 MB


def _apply_tenant_filter(query, user: User):
    if user.role != SUPER_ADMIN_ROLE:
        query = query.filter(Task.tenant_id == user.tenant_id)
    return query


def _get_task_or_404(db: Session, task_id: int, user: User) -> Task:
    task = _apply_tenant_filter(db.query(Task), user).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(404, "Task not found")
    return task


def _enrich_task(db: Session, task: Task) -> dict:
    """Return task with attachments."""
    attachments = (
        db.query(TaskAttachment)
        .filter(TaskAttachment.task_id == task.id)
        .all()
    )
    data = TaskResponse.model_validate(task).model_dump()
    data["attachments"] = [AttachmentResponse.model_validate(a) for a in attachments]
    return data


# ============================================================
# LIST
# ============================================================

@router.get("", response_model=List[TaskResponse])
def list_tasks(
    status: Optional[str] = None,
    priority: Optional[str] = None,
    assigned_to: Optional[int] = None,
    lead_id: Optional[int] = None,
    due_today: Optional[bool] = False,
    search: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    query = _apply_tenant_filter(db.query(Task), user)

    if status:
        query = query.filter(Task.status == status)
    if priority:
        query = query.filter(Task.priority == priority)
    if assigned_to:
        query = query.filter(Task.assigned_to == assigned_to)
    if lead_id:
        query = query.filter(Task.lead_id == lead_id)
    if due_today:
        query = query.filter(Task.due_date == date.today())
    if search:
        pattern = f"%{search}%"
        query = query.filter(
            or_(Task.title.ilike(pattern), Task.description.ilike(pattern))
        )

    tasks = (
        query
        .order_by(Task.due_date.asc().nullslast(), desc(Task.created_at))
        .offset(skip).limit(limit).all()
    )

    return [_enrich_task(db, t) for t in tasks]


# ============================================================
# STATS
# ============================================================

@router.get("/stats")
def task_stats(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = _apply_tenant_filter(db.query(Task), user)
    today = date.today()

    return {
        "total": query.count(),
        "pending": query.filter(Task.status == "pending").count(),
        "in_progress": query.filter(Task.status == "in_progress").count(),
        "completed": query.filter(Task.status == "completed").count(),
        "overdue": query.filter(
            Task.status.in_(["pending", "in_progress"]),
            Task.due_date < today,
        ).count(),
        "due_today": query.filter(
            Task.status.in_(["pending", "in_progress"]),
            Task.due_date == today,
        ).count(),
    }


# ============================================================
# TODAY
# ============================================================

@router.get("/today", response_model=List[TaskResponse])
def tasks_today(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    query = _apply_tenant_filter(db.query(Task), user)
    tasks = query.filter(Task.due_date == date.today()).order_by(Task.priority).all()
    return [_enrich_task(db, t) for t in tasks]


# ============================================================
# GET SINGLE
# ============================================================

@router.get("/{task_id}", response_model=TaskResponse)
def get_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = _get_task_or_404(db, task_id, user)
    return _enrich_task(db, task)


# ============================================================
# CREATE
# ============================================================

@router.post("", response_model=TaskResponse, status_code=201)
def create_task(payload: TaskCreate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not user.tenant_id:
        raise HTTPException(400, "User has no tenant")

    task = Task(
        tenant_id=user.tenant_id,
        title=payload.title,
        description=payload.description,
        status=payload.status or "pending",
        priority=payload.priority or "medium",
        due_date=payload.due_date,
        assigned_to=payload.assigned_to,
        created_by=user.id,
        lead_id=payload.lead_id,
        contact_id=payload.contact_id,
        company_id=payload.company_id,
        deal_id=payload.deal_id,
        tags=payload.tags or [],
    )
    db.add(task)
    db.commit()
    db.refresh(task)
    return task


# ============================================================
# UPDATE
# ============================================================

@router.put("/{task_id}", response_model=TaskResponse)
def update_task(
    task_id: int,
    payload: TaskUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_task_or_404(db, task_id, user)
    update_data = payload.model_dump(exclude_unset=True)

    if update_data.get("status") == "completed" and task.status != "completed":
        task.completed_at = datetime.utcnow()

    for key, value in update_data.items():
        setattr(task, key, value)

    db.commit()
    db.refresh(task)
    return task


# ============================================================
# DELETE
# ============================================================

@router.delete("/{task_id}", status_code=204)
def delete_task(task_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    task = _get_task_or_404(db, task_id, user)
    db.delete(task)
    db.commit()
    return None


# ============================================================
# ⭐ UPLOAD ATTACHMENT (Single)
# ============================================================

@router.post("/{task_id}/attachments", response_model=AttachmentResponse)
async def upload_attachment(
    task_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_task_or_404(db, task_id, user)

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(400, f"File type '{file.content_type}' not allowed")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(400, "File size exceeds 10 MB")

    ext = os.path.splitext(file.filename or "")[1]
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    attachment = TaskAttachment(
        task_id=task.id,
        file_name=file.filename,
        file_url=f"/uploads/tasks/{unique_name}",
        file_size=len(content),
        file_type=file.content_type,
        uploaded_by=user.id,
    )
    db.add(attachment)
    db.commit()
    db.refresh(attachment)
    return attachment


# ============================================================
# ⭐ UPLOAD MULTIPLE ATTACHMENTS
# ============================================================

@router.post("/{task_id}/attachments/bulk", response_model=List[AttachmentResponse])
async def upload_multiple(
    task_id: int,
    files: List[UploadFile] = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    task = _get_task_or_404(db, task_id, user)
    results = []

    for file in files:
        if file.content_type not in ALLOWED_TYPES:
            continue
        content = await file.read()
        if len(content) > MAX_FILE_SIZE:
            continue

        ext = os.path.splitext(file.filename or "")[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        file_path = os.path.join(UPLOAD_DIR, unique_name)

        with open(file_path, "wb") as f:
            f.write(content)

        attachment = TaskAttachment(
            task_id=task.id,
            file_name=file.filename,
            file_url=f"/uploads/tasks/{unique_name}",
            file_size=len(content),
            file_type=file.content_type,
            uploaded_by=user.id,
        )
        db.add(attachment)
        results.append(attachment)

    db.commit()
    for r in results:
        db.refresh(r)

    return results


# ============================================================
# ⭐ DELETE ATTACHMENT
# ============================================================

@router.delete("/{task_id}/attachments/{attachment_id}", status_code=204)
def delete_attachment(
    task_id: int,
    attachment_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    _get_task_or_404(db, task_id, user)

    attachment = (
        db.query(TaskAttachment)
        .filter(
            TaskAttachment.id == attachment_id,
            TaskAttachment.task_id == task_id,
        )
        .first()
    )
    if not attachment:
        raise HTTPException(404, "Attachment not found")

    file_path = os.path.join(UPLOAD_DIR, os.path.basename(attachment.file_url))
    if os.path.exists(file_path):
        os.remove(file_path)

    db.delete(attachment)
    db.commit()
    return None