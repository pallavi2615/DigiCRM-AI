from pydantic import BaseModel, Field, EmailStr
from typing import Optional, Dict, Any, List
from datetime import datetime


# ============================================================
# EXISTING (keep)
# ============================================================

class AutoFollowupSettingsUpdate(BaseModel):
    auto_followup_enabled: Optional[bool] = None
    default_followup_sequence_id: Optional[int] = None
    default_assignee_id: Optional[int] = None


class AutoFollowupSettingsResponse(BaseModel):
    auto_followup_enabled: bool
    default_followup_sequence_id: Optional[int] = None
    default_assignee_id: Optional[int] = None


# ============================================================
# NEW — Tenant info
# ============================================================

class TenantResponse(BaseModel):
    id: int
    name: str
    subdomain: Optional[str] = None
    webhook_id: Optional[str] = None
    webhook_url: Optional[str] = None
    api_key: Optional[str] = None
    branding: Dict[str, Any] = {}
    settings: Dict[str, Any] = {}
    status: str = "active"
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class TenantUpdate(BaseModel):
    """Update basic tenant info."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    subdomain: Optional[str] = Field(None, min_length=1, max_length=100)


class TenantBrandingUpdate(BaseModel):
    """Update tenant.branding JSON. Sent as flat keys to merge."""
    logo_url: Optional[str] = None
    primary_color: Optional[str] = None
    secondary_color: Optional[str] = None
    favicon_url: Optional[str] = None
    custom_css: Optional[str] = None
    # Add any other branding keys you use


class TenantSettingsUpdate(BaseModel):
    """Update tenant.settings JSON. Sent as flat keys to merge."""
    timezone: Optional[str] = None
    currency: Optional[str] = None
    language: Optional[str] = None
    date_format: Optional[str] = None
    # Add any other setting keys you use


class TenantListItem(BaseModel):
    id: int
    name: str
    subdomain: Optional[str] = None
    status: str
    webhook_id: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True

# ============================================================
# TENANT ONBOARDING
# ============================================================

class TenantCreateWithAdmin(BaseModel):
    """Payload SuperAdmin sends to create a new tenant + admin."""

    # Tenant basics
    name: str = Field(..., min_length=1, max_length=200)
    slug: str = Field(..., min_length=1, max_length=100)
    plan: Optional[str] = "lite"
    industry_template: Optional[str] = None
    tagline: Optional[str] = None

    # Branding
    primary_color: Optional[str] = "#4F46E5"
    accent_color: Optional[str] = "#a855f7"
    logo_url: Optional[str] = None
    custom_domain: Optional[str] = None

    # Admin user
    admin_email: EmailStr
    admin_full_name: str = Field(..., min_length=1, max_length=200)


class TenantCreateResponse(BaseModel):
    """Response after creating tenant — includes one-time temp password."""
    tenant_id: int
    tenant_name: str
    tenant_slug: str

    admin_user_id: int
    admin_email: str
    admin_full_name: str

    temp_password: Optional[str] = None   # ⚠️ one-time only

    email_sent: bool
    email_error: Optional[str] = None

    industries_assigned: List[str] = []
