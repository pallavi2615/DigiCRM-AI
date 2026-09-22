from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class RetrySettingsUpdate(BaseModel):
    max_attempts: Optional[int] = Field(None, ge=1, le=20)
    base_delay_minutes: Optional[int] = Field(None, ge=1, le=1440)
    backoff_factor: Optional[int] = Field(None, ge=1, le=10)
    enabled: Optional[bool] = None


class RetrySettingsResponse(BaseModel):
    id: int
    tenant_id: int
    tenant_name: Optional[str] = None
    tenant_subdomain: Optional[str] = None
    max_attempts: int
    base_delay_minutes: int
    backoff_factor: int
    enabled: bool
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    class Config:
        from_attributes = True