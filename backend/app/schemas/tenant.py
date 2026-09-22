from pydantic import BaseModel
from typing import Optional
from datetime import datetime


# ============================================================
# AUTO-FOLLOWUP SETTINGS
# ============================================================

class AutoFollowupSettingsUpdate(BaseModel):
    """Payload for updating auto-followup settings."""
    auto_followup_enabled: Optional[bool] = None
    default_followup_sequence_id: Optional[int] = None
    default_assignee_id: Optional[int] = None


class AutoFollowupSettingsResponse(BaseModel):
    """Response for auto-followup settings."""
    auto_followup_enabled: bool = False
    default_followup_sequence_id: Optional[int] = None
    default_assignee_id: Optional[int] = None

    class Config:
        from_attributes = True


# ============================================================
# TENANT RESPONSE
# ============================================================

class TenantResponse(BaseModel):
    id: int
    name: str
    subdomain: Optional[str] = None
    webhook_id: Optional[str] = None
    webhook_url: Optional[str] = None
    api_key: Optional[str] = None
    status: str = "active"

    class Config:
        from_attributes = True