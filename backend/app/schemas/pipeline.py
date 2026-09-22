from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import date, datetime


class PipelineStage(BaseModel):
    """Single stage in pipeline."""
    key: str
    label: str
    color: Optional[str] = None
    probability: int = 0
    order_index: int = 0
    is_won: bool = False
    is_lost: bool = False


class PipelineDeal(BaseModel):
    """Deal (lead) card in pipeline."""
    id: int
    company_name: Optional[str] = None
    contact_person: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    status: str
    priority: str = "medium"
    estimated_value: float = 0
    expected_close_date: Optional[date] = None
    source: Optional[str] = None
    industry: Optional[str] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class StageGroup(BaseModel):
    """Stage with its deals."""
    stage: PipelineStage
    deals: List[PipelineDeal]
    count: int
    total_value: float


class PipelineResponse(BaseModel):
    """Complete pipeline view."""
    stages: List[StageGroup]
    total_deals: int
    total_value: float


class PipelineStats(BaseModel):
    """Pipeline analytics."""
    total_deals: int
    total_value: float
    weighted_value: float         # Sum(value × probability / 100)
    by_stage: Dict[str, Dict[str, Any]]


class MoveDealRequest(BaseModel):
    """Move deal to a new stage."""
    status: str