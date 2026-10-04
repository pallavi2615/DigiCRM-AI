"""
User / Team management API.

Endpoints:
    GET    /users                — List team members of own tenant
    GET    /users/me             — Current user's profile
    PUT    /users/me             — Update own profile
    POST   /users/me/password    — Change own password
    POST   /users/me/set-password — First-time password set (from temp_token)
    POST   /users/invite         — Invite new user (admin+ or superadmin)
    GET    /users/{user_id}      — Get single user
    PATCH  /users/{user_id}/role — Change another user's role
    DELETE /users/{user_id}      — Delete user (admin+)
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional, List
from datetime import datetime
from pydantic import BaseModel, Field
from jose import jwt, JWTError
import secrets
import logging

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
)
from app.core.config import settings
from app.core.permissions import require_role
from app.core.constants import (
    SUPER_ADMIN_ROLE as SA_CONST,
    ADMIN_ROLE,
    MANAGER_ROLE,
    EXECUTIVE_ROLE,
)
from app.utils.password import check_password_strength, generate_temp_password
from app.utils.email import send_tenant_welcome_with_credentials
from app.models.user import User
from app.models.tenant import Tenant
from app.schemas.user import (
    UserResponse,
    UserUpdateMe,
    UserPasswordUpdate,
    UserRoleUpdate,
    TeamMemberResponse,
    UserInviteRequest,
    UserInviteResponse,
)
from app.models.role_change_history import RoleChangeHistory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/users", tags=["Users"])

SUPER_ADMIN_ROLE = "super_admin"

# ⭐ super_admin excluded — cannot be granted via API
VALID_ROLES = {ADMIN_ROLE, MANAGER_ROLE, EXECUTIVE_ROLE}


# ============================================================
# SCHEMAS — Set Password (first-time)
# ============================================================

class SetPasswordRequest(BaseModel):
    new_password: str = Field(..., min_length=8)
    temp_token: Optional[str] = None


# ============================================================
# GET CURRENT USER PROFILE
# ============================================================

@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    """Return the current user's profile."""
    return UserResponse.model_validate(user)


# ============================================================
# UPDATE OWN PROFILE
# ============================================================

@router.put("/me", response_model=UserResponse)
def update_me(
    payload: UserUpdateMe,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update the current user's profile fields."""
    update_data = payload.model_dump(exclude_unset=True)

    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


# ============================================================
# CHANGE OWN PASSWORD (already logged in)
# ============================================================

@router.post("/me/password")
def change_my_password(
    payload: UserPasswordUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Change the current user's password."""
    if not verify_password(payload.current_password, user.password_hash):
        raise HTTPException(400, "Current password is incorrect")

    is_valid, error = check_password_strength(payload.new_password)
    if not is_valid:
        raise HTTPException(400, error)

    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    user.last_password_change = datetime.utcnow()

    user.refresh_token = None
    user.refresh_token_expires = None

    db.commit()
    return {"success": True, "message": "Password updated. Please log in again."}


# ============================================================
# FIRST-TIME SET PASSWORD + WEBHOOK GENERATION
# ============================================================

@router.post("/me/set-password")
def set_my_password(
    payload: SetPasswordRequest,
    db: Session = Depends(get_db),
):
    """
    First-time password change for tenant admins.
    Generates webhook_id for the tenant on success (if not already).
    """
    user_id: Optional[int] = None

    if payload.temp_token:
        try:
            decoded = jwt.decode(
                payload.temp_token,
                settings.SECRET_KEY,
                algorithms=[settings.ALGORITHM],
            )
            if decoded.get("purpose") != "password_change":
                raise HTTPException(400, "Invalid token purpose")
            user_id = int(decoded.get("sub"))
        except (JWTError, ValueError, TypeError):
            raise HTTPException(401, "Invalid or expired temp token")

    if user_id is None:
        raise HTTPException(400, "temp_token is required")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(404, "User not found")

    is_valid, error = check_password_strength(payload.new_password)
    if not is_valid:
        raise HTTPException(400, error)

    # Update password
    user.password_hash = hash_password(payload.new_password)
    user.must_change_password = False
    user.last_password_change = datetime.utcnow()

    # ⭐ Generate webhook for the tenant (first-time login only)
    tenant = None
    if user.tenant_id:
        tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()
        if tenant and not tenant.webhook_id:
            tenant.webhook_id = f"wh_{secrets.token_urlsafe(16)}"
            if not tenant.api_key:
                tenant.api_key = secrets.token_urlsafe(32)

            current_settings = dict(tenant.settings or {})
            current_settings["webhook_enabled"] = True
            tenant.settings = current_settings

            logger.info(f"✅ Generated webhook for tenant {tenant.id} on first login")

    db.commit()
    db.refresh(user)
    if tenant:
        db.refresh(tenant)

    # Fresh tokens
    token_data = {"sub": str(user.id), "role": user.role, "tenant_id": user.tenant_id}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    webhook_url = None
    if tenant and tenant.webhook_id:
        webhook_url = f"{settings.WEBHOOK_BASE_URL}/{tenant.webhook_id}"

    return {
        "success": True,
        "message": "Password updated successfully",
        "user": UserResponse.model_validate(user),
        "tokens": {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_in": settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        },
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "subdomain": tenant.subdomain,
            "webhook_id": tenant.webhook_id,
            "webhook_url": webhook_url,
            "api_key": tenant.api_key,
        } if tenant else None,
    }


# ============================================================
# INVITE USER (admin+ only)
# ============================================================

@router.post("/invite", response_model=UserInviteResponse, status_code=201)
def invite_user(
    payload: UserInviteRequest,
    current: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    """
    Invite a new user to a tenant.

    Rules:
    - Tenant Admin: tenant_id comes from current user (auto)
    - SuperAdmin: tenant_id must be provided in the request
    - Email must be globally unique
    - Role: admin | manager | executive
    """

    # ⭐ Determine target tenant
    if current.role == SA_CONST:
        # SuperAdmin MUST specify tenant_id
        if not payload.tenant_id:
            raise HTTPException(
                400,
                "SuperAdmin must provide 'tenant_id' when inviting a user.",
            )
        target_tenant_id = payload.tenant_id

        tenant = db.query(Tenant).filter(Tenant.id == target_tenant_id).first()
        if not tenant:
            raise HTTPException(404, f"Tenant {target_tenant_id} not found")
    else:
        # Tenant Admin — use own tenant
        if not current.tenant_id:
            raise HTTPException(400, "You have no tenant")
        target_tenant_id = current.tenant_id

        tenant = db.query(Tenant).filter(Tenant.id == target_tenant_id).first()
        if not tenant:
            raise HTTPException(404, "Your tenant not found")

    # Email uniqueness
    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(400, "Email already registered")

    # Generate temp password
    temp_password = generate_temp_password(12)

    # Create user
    user = User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(temp_password),
        role=payload.role,
        status="active",
        tenant_id=target_tenant_id,
        must_change_password=True,
        email_verified=False,
        invited_by=current.id,
    )
    db.add(user)
    db.flush()

    # Send welcome email
    email_sent = False
    email_error = None
    if payload.send_welcome_email and tenant:
        try:
            email_sent = send_tenant_welcome_with_credentials(
                to_email=payload.email,
                admin_name=payload.full_name,
                tenant_name=tenant.name,
                temp_password=temp_password,
            )
        except Exception as e:
            logger.exception("Welcome email failed: %s", e)
            email_error = str(e)

    db.commit()
    db.refresh(user)

    return UserInviteResponse(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        role=user.role,
        tenant_id=user.tenant_id,
        temp_password=temp_password if not email_sent else None,
        email_sent=email_sent,
        email_error=email_error,
    )


# ============================================================
# LIST TEAM MEMBERS
# ============================================================

@router.get("", response_model=List[TeamMemberResponse])
def list_team_members(
    search: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(require_role(SA_CONST, ADMIN_ROLE, MANAGER_ROLE)),
    db: Session = Depends(get_db),
):
    """List users in the tenant."""
    query = db.query(User)

    if user.role != SA_CONST:
        if not user.tenant_id:
            raise HTTPException(400, "User has no tenant")
        query = query.filter(User.tenant_id == user.tenant_id)

    if search:
        pattern = f"%{search}%"
        query = query.filter(
            (User.full_name.ilike(pattern)) |
            (User.email.ilike(pattern))
        )
    if role:
        query = query.filter(User.role == role)
    if status:
        query = query.filter(User.status == status)

    members = (
        query.order_by(desc(User.created_at))
        .offset(skip).limit(limit).all()
    )

    return [TeamMemberResponse.model_validate(m) for m in members]


# ============================================================
# GET SINGLE USER
# ============================================================

@router.get("/{user_id}", response_model=TeamMemberResponse)
def get_user(
    user_id: int,
    current: User = Depends(require_role(SA_CONST, ADMIN_ROLE, MANAGER_ROLE)),
    db: Session = Depends(get_db),
):
    """Fetch a single user from your tenant."""
    query = db.query(User).filter(User.id == user_id)

    if current.role != SA_CONST:
        query = query.filter(User.tenant_id == current.tenant_id)

    target = query.first()
    if not target:
        raise HTTPException(404, "User not found")

    return TeamMemberResponse.model_validate(target)


# ============================================================
# CHANGE ANOTHER USER'S ROLE (admin+)
# ============================================================
@router.patch("/{user_id}/role", response_model=TeamMemberResponse)
def update_user_role(
    user_id: int,
    payload: UserRoleUpdate,
    current: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    """
    Change another user's role.
    Logs the change to role_change_history.
    """
    # super_admin cannot be granted
    ALLOWED_TARGET_ROLES = {ADMIN_ROLE, MANAGER_ROLE, EXECUTIVE_ROLE}
    if payload.role not in ALLOWED_TARGET_ROLES:
        raise HTTPException(
            400,
            f"Invalid role. Valid: {', '.join(sorted(ALLOWED_TARGET_ROLES))}",
        )

    if user_id == current.id:
        raise HTTPException(400, "You cannot change your own role")

    query = db.query(User).filter(User.id == user_id)
    if current.role != SA_CONST:
        query = query.filter(User.tenant_id == current.tenant_id)

    target = query.first()
    if not target:
        raise HTTPException(404, "User not found")

    #  Never modify SuperAdmin
    if target.role == SA_CONST:
        raise HTTPException(
            403,
            "Cannot change the SuperAdmin's role.",
        )

    old_role = target.role
    new_role = payload.role

    # Skip if no actual change
    if old_role == new_role:
        return TeamMemberResponse.model_validate(target)

    # ⭐ Update role
    target.role = new_role

    # ⭐ Log to history
    history = RoleChangeHistory(
        tenant_id=target.tenant_id or 0,
        user_id=target.id,
        user_name=target.full_name,
        user_email=target.email,
        actor_id=current.id,
        actor_name=current.full_name,
        actor_email=current.email,
        old_role=old_role,
        new_role=new_role,
    )
    db.add(history)

    db.commit()
    db.refresh(target)

    return TeamMemberResponse.model_validate(target)


# ============================================================
# DELETE USER (admin+)
# ============================================================

@router.delete("/{user_id}", status_code=204)
def delete_user(
    user_id: int,
    current: User = Depends(require_role(SA_CONST, ADMIN_ROLE)),
    db: Session = Depends(get_db),
):
    """
    Delete a user.

    Rules:
    - Cannot delete self
    - Cannot delete SuperAdmin
    - Non-SuperAdmin can only delete users in own tenant
    """
    if user_id == current.id:
        raise HTTPException(400, "You cannot delete yourself")

    query = db.query(User).filter(User.id == user_id)

    if current.role != SA_CONST:
        query = query.filter(User.tenant_id == current.tenant_id)

    target = query.first()
    if not target:
        raise HTTPException(404, "User not found")

    # ⭐ Never delete SuperAdmin
    if target.role == SA_CONST:
        raise HTTPException(
            403,
            "Cannot delete the SuperAdmin. This is the platform owner.",
        )

    db.delete(target)
    db.commit()
    return None