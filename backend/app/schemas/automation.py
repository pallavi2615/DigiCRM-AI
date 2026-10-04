from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime


class AutomationRuleCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    rule_type: str = Field(..., description="event | time | condition")
    trigger_event: Optional[str] = None
    trigger_schedule: Optional[str] = None
    trigger_condition: Optional[Dict[str, Any]] = {}
    entity_type: Optional[str] = "lead"
    action_type: str = Field(..., description="move_stage | set_priority | assign | notify | add_tag")
    action_config: Optional[Dict[str, Any]] = {}
    is_active: Optional[bool] = True
    priority: Optional[int] = 0


class AutomationRuleUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    trigger_event: Optional[str] = None
    trigger_schedule: Optional[str] = None
    trigger_condition: Optional[Dict[str, Any]] = None
    action_type: Optional[str] = None
    action_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None
    priority: Optional[int] = None


class AutomationRuleResponse(BaseModel):
    id: int
    tenant_id: int
    name: str
    description: Optional[str] = None
    rule_type: str
    trigger_event: Optional[str] = None
    trigger_schedule: Optional[str] = None
    trigger_condition: Optional[Dict[str, Any]] = {}
    entity_type: str
    action_type: str
    action_config: Optional[Dict[str, Any]] = {}
    is_active: bool
    priority: int
    last_run_at: Optional[datetime] = None
    run_count: int = 0
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class AutomationLogResponse(BaseModel):
    id: int
    rule_id: int
    entity_type: Optional[str] = None
    entity_id: Optional[int] = None
    action_taken: Optional[str] = None
    result: Optional[str] = None
    error_message: Optional[str] = None
    executed_at: Optional[datetime] = None

    class Config:
        from_attributes = True