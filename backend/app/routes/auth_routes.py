from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timezone
import secrets

from app.db.database import get_db
from app.core.security import (
    hash_password,
    verify_password,
    create_access_token,
    create_refresh_token,
    generate_reset_token,
    get_reset_token_expiry,
    hash_refresh_token,
    get_refresh_token_expiry,
)
from app.core.deps import get_current_user
from app.core.config import settings
from app.core.permissions import FEATURE_MATRIX
from app.models.user import User
from app.models.tenant import Tenant
from app.models.industry import Industry, TenantIndustry
from app.schemas.auth import (
    SignupRequest,
    LoginRequest,
    TokenResponse,
    AuthResponse,
    ForgotPasswordRequest,
    ResetPasswordRequest,
    MessageResponse,
    TenantInfo,
    RefreshTokenRequest,
)
from app.schemas.user import UserResponse
from app.utils.email import send_reset_password_email, send_welcome_email
from app.services.automation_service import create_default_automation_rules   # ⭐ NEW

router = APIRouter(prefix="/auth", tags=["Auth"])


# ============================================================
# HELPER: Refresh token save karo user row mein
# ============================================================
def _save_refresh_token(user: User, refresh_token: str) -> None:
    """Refresh token ka hash user row mein store karo."""
    user.refresh_token = hash_refresh_token(refresh_token)
    user.refresh_token_expires = get_refresh_token_expiry()


# ============================================================
# SIGNUP — bootstrap only (first-ever user)
# ============================================================
@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """
    Bootstrap signup — ONLY allowed for the very first user ever.
    That user becomes the platform SuperAdmin.

    After the first user, public signup is CLOSED.
    New users must be invited by their tenant admin via /users/invite.
    """
    # ⭐ Public signup CLOSED after first user
    any_user_exists = db.query(User).first()
    if any_user_exists:
        raise HTTPException(
            status_code=403,
            detail=(
                "Public signup is closed. "
                "Please contact your workspace admin for an invite."
            ),
        )

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # ⭐ First user = SuperAdmin
    role = "super_admin"

    # Platform-level home tenant for SuperAdmin
    tenant = Tenant(
        name="Platform Admin",
        subdomain="platform",
        webhook_id=None,
        api_key=None,
        settings={},
        status="active",
    )
    db.add(tenant)
    db.flush()

    # ⭐ Seed default automation rules (5 rules)
    create_default_automation_rules(db, tenant.id)

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
        status="active",
        tenant_id=tenant.id,
        email_verified=True,
        must_change_password=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.refresh(tenant)

    token_data = {"sub": str(user.id), "role": user.role, "tenant_id": user.tenant_id}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
        tenant=TenantInfo(
            id=tenant.id,
            name=tenant.name,
            webhook_id=None,
            webhook_url=None,
            api_key=None,
        ),
    )


# ============================================================
# LOGIN — with forced password change check
# ============================================================
@router.post("/signin")
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Login. If must_change_password → return temp_token instead of full auth."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account inactive")

    user.last_login = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)

    # ⭐ FORCED PASSWORD CHANGE
    if user.must_change_password:
        temp_token = create_access_token({
            "sub": str(user.id),
            "purpose": "password_change",
            "role": user.role,
            "tenant_id": user.tenant_id,
        })
        return {
            "requires_password_change": True,
            "temp_token": temp_token,
            "user": {
                "id": user.id,
                "email": user.email,
                "full_name": user.full_name,
            },
            "message": "You must change your password before continuing",
        }

    # ── Normal login flow ──
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()

    token_data = {"sub": str(user.id), "role": user.role, "tenant_id": user.tenant_id}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    _save_refresh_token(user, refresh_token)
    db.commit()
    db.refresh(user)

    webhook_url = None
    if tenant and tenant.webhook_id:
        webhook_url = f"{settings.WEBHOOK_BASE_URL}/{tenant.webhook_id}"

    return AuthResponse(
        user=UserResponse.model_validate(user),
        tokens=TokenResponse(
            access_token=access_token,
            refresh_token=refresh_token,
            expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        ),
        tenant=TenantInfo(
            id=tenant.id,
            name=tenant.name,
            webhook_id=tenant.webhook_id,
            webhook_url=webhook_url,
            api_key=tenant.api_key,
        ) if tenant else None,
    )


# ============================================================
# REFRESH
# ============================================================
@router.post("/refresh", response_model=TokenResponse)
def refresh_tokens(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Refresh token se naya access + refresh token lo (rotation)."""
    token_hash = hash_refresh_token(payload.refresh_token)

    user = db.query(User).filter(User.refresh_token == token_hash).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    now = datetime.now(timezone.utc)
    expires = user.refresh_token_expires
    if expires is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if now > expires:
        user.refresh_token = None
        user.refresh_token_expires = None
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expired")

    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account inactive")

    token_data = {"sub": str(user.id), "role": user.role, "tenant_id": user.tenant_id}
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    _save_refresh_token(user, new_refresh)
    db.commit()

    return TokenResponse(
        access_token=new_access,
        refresh_token=new_refresh,
        expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
    )


# ============================================================
# LOGOUT
# ============================================================
@router.post("/logout", response_model=MessageResponse)
def logout(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Logout — refresh token invalidate karo."""
    current_user.refresh_token = None
    current_user.refresh_token_expires = None
    db.commit()
    return MessageResponse(message="Logged out successfully")


# ============================================================
# FORGOT PASSWORD
# ============================================================
@router.post("/forgot-password", response_model=MessageResponse)
def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """Password reset link email pe bhejo."""
    user = db.query(User).filter(User.email == payload.email).first()

    generic_message = (
        "We received a request to reset your DigiCRM account password. "
        "If an account with this email exists, you will receive a reset link shortly. "
        "If you did not request a password reset, you can safely ignore this email."
    )

    if not user:
        return MessageResponse(message=generic_message)

    token = generate_reset_token()
    user.reset_token = token
    user.reset_token_expires = get_reset_token_expiry()
    db.commit()

    email_sent = send_reset_password_email(user.email, token, user.full_name)
    if not email_sent:
        raise HTTPException(
            status_code=500,
            detail="We were unable to send the password reset email. Please try again later.",
        )

    return MessageResponse(message=generic_message)


# ============================================================
# RESET PASSWORD
# ============================================================
@router.post("/reset-password", response_model=MessageResponse)
def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
    """Token se naya password set karo + sessions revoke."""
    user = db.query(User).filter(User.reset_token == payload.token).first()

    if not user or not user.reset_token_expires:
        raise HTTPException(status_code=400, detail="Invalid or expired token")

    now = datetime.now(timezone.utc)
    expires = user.reset_token_expires
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if now > expires:
        raise HTTPException(status_code=400, detail="Token expired")

    user.password_hash = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    user.last_password_change = now.replace(tzinfo=None)

    user.refresh_token = None
    user.refresh_token_expires = None

    db.commit()

    return MessageResponse(message="Password reset successful. Please login again.")


# ============================================================
# ME
# ============================================================
@router.get("/me", response_model=UserResponse)
def me(current_user: User = Depends(get_current_user)):
    """Current user info."""
    return UserResponse.model_validate(current_user)


# ============================================================
# MY PERMISSIONS
# ============================================================
@router.get("/my-permissions")
def get_my_permissions(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Returns everything the frontend needs to render the sidebar.
    """
    user_role = current_user.role
    is_super_admin = user_role == "super_admin"

    # ── Feature permissions ──
    permissions = {}
    for module, roles in FEATURE_MATRIX.items():
        permissions[module] = roles.get(user_role, [])

    # ── Subscribed industries ──
    if is_super_admin:
        rows = (
            db.query(Industry.key)
            .filter(Industry.is_active == True)
            .all()
        )
        industries = [r[0] for r in rows]
    elif current_user.tenant_id:
        rows = (
            db.query(Industry.key)
            .join(TenantIndustry, TenantIndustry.industry_id == Industry.id)
            .filter(
                TenantIndustry.tenant_id == current_user.tenant_id,
                TenantIndustry.status == "active",
                Industry.is_active == True,
            )
            .all()
        )
        industries = [r[0] for r in rows]
    else:
        industries = []

    # ── Nav visibility flags ──
    nav = {
        # Common nav
        "dashboard": True,
        "leads": True,
        "follow_ups": True,
        "contacts": True,
        "companies": True,
        "pipeline": True,
        "tasks": True,
        "calendar": True,
        "meetings": True,
        "tickets": True,
        "inbound": True,
        "lead_sources": True,
        "reports": True,
        "ai_assistant": True,
        "proposals": True,
        "automation": True,

        # Admin+ only
        "webhook_retries":  user_role in ("super_admin", "admin"),
        "webhook_settings": user_role in ("super_admin", "admin"),
        "audit_logs":       user_role in ("super_admin", "admin"),
        "billing":          user_role in ("super_admin", "admin"),
        "payments":         user_role in ("super_admin", "admin"),
        "cash_flow":        user_role in ("super_admin", "admin"),
        "partner_payouts":  user_role in ("super_admin", "admin"),
        "payout_accounts":  user_role in ("super_admin", "admin"),

        # Common insights
        "landing_analytics": True,
        "conversions":       True,
        "affiliates":        True,

        # SuperAdmin only
        "super_admin_section": is_super_admin,
        "tenants":             is_super_admin,
        "industries_manage":   is_super_admin,
        "industry_packs":      is_super_admin,
        "template_builder":    is_super_admin,
    }

    return {
        "role": user_role,
        "is_super_admin": is_super_admin,
        "permissions": permissions,
        "industries": industries,
        "nav": nav,
    }