from pydantic import BaseModel, Field, EmailStr
from typing import Optional
from datetime import datetime


# ============================================================
# EXISTING — keep as-is
# ============================================================

class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    status: str
    tenant_id: Optional[int] = None

    class Config:
        from_attributes = True


# ============================================================
# NEW — Settings endpoints
# ============================================================

class UserUpdateMe(BaseModel):
    """Fields the current user can update about themselves."""
    full_name: Optional[str] = Field(None, min_length=1, max_length=200)
    phone: Optional[str] = Field(None, max_length=20)
    avatar_url: Optional[str] = Field(None, max_length=500)
    department: Optional[str] = Field(None, max_length=100)
    designation: Optional[str] = Field(None, max_length=100)


class UserPasswordUpdate(BaseModel):
    """Change own password."""
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=6)


class UserRoleUpdate(BaseModel):
    """Admin/Manager changes another user's role."""
    role: str = Field(..., pattern="^(super_admin|admin|manager|executive)$")


class TeamMemberResponse(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: str
    role: str
    status: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    department: Optional[str] = None
    designation: Optional[str] = None
    tenant_id: Optional[int] = None
    last_login: Optional[datetime] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


# ============================================================
# USER INVITE
# ============================================================

class UserInviteRequest(BaseModel):
    full_name: str = Field(..., min_length=1, max_length=200)
    email: EmailStr
    role: str = Field(..., pattern="^(admin|manager|executive)$")
    tenant_id: Optional[int] = None   # ⭐ Required for SuperAdmin only
    send_welcome_email: bool = True


class UserInviteResponse(BaseModel):
    user_id: int
    email: str
    full_name: str
    role: str
    tenant_id: int
    temp_password: Optional[str] = None
    email_sent: bool
    email_error: Optional[str] = None

class UserLiteResponse(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: str
    role: str
    
    class Config:
        from_attributes = True