from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class SequenceStepCreate(BaseModel):
    step_order: int
    delay_days: int = 0
    action_type: str
    title: str
    description: Optional[str] = None
    template: Optional[str] = None


class SequenceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    is_active: Optional[bool] = True
    steps: Optional[List[SequenceStepCreate]] = []


class SequenceStepResponse(BaseModel):
    id: int
    step_order: int
    delay_days: int
    action_type: str
    title: str
    description: Optional[str] = None
    template: Optional[str] = None

    class Config:
        from_attributes = True


class SequenceResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    description: Optional[str] = None
    is_active: bool
    total_steps: int
    steps: Optional[List[SequenceStepResponse]] = []
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TaskCreate(BaseModel):
    lead_id: int
    title: str
    description: Optional[str] = None
    action_type: Optional[str] = "task"
    priority: Optional[str] = "medium"
    due_date: Optional[date] = None
    assigned_to: Optional[int] = None


class TaskUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    priority: Optional[str] = None
    due_date: Optional[date] = None
    assigned_to: Optional[int] = None
    notes: Optional[str] = None


class TaskResponse(BaseModel):
    id: int
    tenant_id: int
    lead_id: int
    sequence_id: Optional[int] = None
    step_id: Optional[int] = None
    title: str
    description: Optional[str] = None
    action_type: Optional[str] = None
    status: str
    priority: str
    due_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    assigned_to: Optional[int] = None
    notes: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class LeadResponseCreate(BaseModel):
    lead_id: int
    response_type: str
    response_text: Optional[str] = None


class LeadResponseResponse(BaseModel):
    id: int
    tenant_id: int
    lead_id: int
    response_type: Optional[str] = None
    response_text: Optional[str] = None
    responded_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AttachSequenceRequest(BaseModel):
    sequence_id: int