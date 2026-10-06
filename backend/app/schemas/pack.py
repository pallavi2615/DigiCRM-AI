"""Pydantic schemas for industry pack configs."""

from datetime import datetime
from typing import Optional, Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict


class PackConfigResponse(BaseModel):
    id: UUID
    tenant_id: Optional[int] = None
    group_slug: str
    pack_slug: str
    name: Optional[str] = None
    tagline: Optional[str] = None
    description: Optional[str] = None
    gradient: Optional[str] = None
    record_label: Optional[str] = None
    record_label_plural: Optional[str] = None
    party_label: Optional[str] = None
    value_label: Optional[str] = None
    stages: Optional[Any] = None
    won_stages: Optional[Any] = None
    lost_stages: Optional[Any] = None
    fields: Optional[Any] = None
    kpi_labels: Optional[Any] = None
    verifications: Optional[Any] = None
    agents: Optional[Any] = None
    is_custom: bool = False
    archived_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)