# from fastapi import APIRouter, Depends, HTTPException, status
# from sqlalchemy.orm import Session
# from datetime import datetime, timezone
# import secrets
# from app.db.database import get_db
# from app.core.security import (
#     hash_password,
#     verify_password,
#     create_access_token,
#     create_refresh_token,
#     generate_reset_token,
#     get_reset_token_expiry,
# )
# from app.core.deps import get_current_user
# from app.core.config import settings
# from app.models.user import User
# from app.models.tenant import Tenant
# from app.schemas.auth import (
#     SignupRequest,
#     LoginRequest,
#     TokenResponse,
#     AuthResponse,
#     ForgotPasswordRequest,
#     ResetPasswordRequest,
#     MessageResponse, TenantInfo,
# )
# from app.schemas.user import UserResponse
# from app.utils.email import send_reset_password_email, send_welcome_email

# router = APIRouter(prefix="/auth", tags=["Auth"])

# import secrets
# from fastapi import APIRouter, Depends, HTTPException, status
# from sqlalchemy.orm import Session


# @router.post("/signup", response_model=AuthResponse, status_code=201)
# def signup(payload: SignupRequest, db: Session = Depends(get_db)):
#     """Naya client onboard karo — tenant + user + webhook_id."""
    
#     # 1. Email check
#     existing = db.query(User).filter(User.email == payload.email).first()
#     if existing:
#         raise HTTPException(status_code=400, detail="Email already registered")

#     # 2. SuperAdmin logic
#     super_admin_exists = db.query(User).filter(User.role == "super_admin").first()
#     role = "admin" if super_admin_exists else "super_admin"

#     # 3. Webhook ID + API Key generate karo
#     webhook_id = f"wh_{secrets.token_urlsafe(16)}"
#     api_key = secrets.token_urlsafe(32)

#     # 4. Tenant banao
#     tenant = Tenant(
#         name=payload.company_name or payload.full_name,
#         webhook_id=webhook_id,
#         api_key=api_key,
#         settings={"webhook_enabled": True},
#         status="active",
#     )
#     db.add(tenant)
#     db.flush()

#     # 5. User banao
#     user = User(
#         full_name=payload.full_name,
#         email=payload.email,
#         password_hash=hash_password(payload.password),
#         role=role,
#         status="active",
#         tenant_id=tenant.id,
#         email_verified=False,
#     )
#     db.add(user)
#     db.commit()
#     db.refresh(user)
#     db.refresh(tenant)

#     # 6. Tokens banao
#     token_data = {"sub": str(user.id), "role": user.role, "tenant_id": user.tenant_id}
#     access_token = create_access_token(token_data)
#     refresh_token = create_refresh_token(token_data)

#     # 7. Webhook URL generate karo
#     webhook_url = f"{settings.WEBHOOK_BASE_URL}/{tenant.webhook_id}"

#     # 8. Response return karo
#     return AuthResponse(
#         user=UserResponse.model_validate(user),
#         tokens=TokenResponse(
#             access_token=access_token,
#             refresh_token=refresh_token,
#             expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
#         ),
#         tenant=TenantInfo(
#             id=tenant.id,
#             name=tenant.name,
#             webhook_id=tenant.webhook_id,
#             webhook_url=webhook_url,
#             api_key=tenant.api_key,
#         ),
#     )

# @router.post("/signin", response_model=AuthResponse)
# def login(payload: LoginRequest, db: Session = Depends(get_db)):
#     """Login karo aur JWT token lo."""
#     user = db.query(User).filter(User.email == payload.email).first()
#     if not user or not verify_password(payload.password, user.password_hash):
#         raise HTTPException(status_code=401, detail="Invalid credentials")

#     if user.status != "active":
#         raise HTTPException(status_code=403, detail="Account inactive")

#     user.last_login = datetime.utcnow()
#     db.commit()
#     db.refresh(user)

#     # Tenant fetch karo
#     tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()

#     token_data = {"sub": str(user.id), "role": user.role, "tenant_id": user.tenant_id}
#     access_token = create_access_token(token_data)
#     refresh_token = create_refresh_token(token_data)

#     # Webhook URL generate karo
#     webhook_url = None
#     if tenant and tenant.webhook_id:
#         webhook_url = f"{settings.WEBHOOK_BASE_URL}/{tenant.webhook_id}"

#     return AuthResponse(
#         user=UserResponse.model_validate(user),
#         tokens=TokenResponse(
#             access_token=access_token,
#             refresh_token=refresh_token,
#             expires_in=settings.ACCESS_TOKEN_EXPIRE_MINUTES * 60,
#         ),
#         tenant=TenantInfo(
#             id=tenant.id,
#             name=tenant.name,
#             webhook_id=tenant.webhook_id,
#             webhook_url=webhook_url,
#             api_key=tenant.api_key,
#         ) if tenant else None,
#     )

# # FORGOT PASSWORD
# @router.post("/forgot-password", response_model=MessageResponse)
# def forgot_password(payload: ForgotPasswordRequest, db: Session = Depends(get_db)):
#     """Password reset link email pe bhejo."""
#     user = db.query(User).filter(User.email == payload.email).first()

#     # Security: chahe user mile ya na mile, same response do
#     if not user:
#         return MessageResponse(
#             message="We received a request to reset your DigiCRM account password. Click the button below to create a new password."

#                     "If you did not request a password reset, you can safely ignore this email."
#         )

#     # Reset token generate karo
#     token = generate_reset_token()
#     user.reset_token = token
#     user.reset_token_expires = get_reset_token_expiry()
#     db.commit()

#     # Email bhejo
#     email_sent = send_reset_password_email(user.email, token, user.full_name)

#     if not email_sent:
#         raise HTTPException(
#             status_code=500,
#             detail="We were unable to send the password reset email. Please try again later."
#         )

#     return MessageResponse(
#         message="We received a request to reset your DigiCRM account password. Click the button below to create a new password."

#                     "If you did not request a password reset, you can safely ignore this email."
#     )


# # ⭐ RESET PASSWORD
# @router.post("/reset-password", response_model=MessageResponse)
# def reset_password(payload: ResetPasswordRequest, db: Session = Depends(get_db)):
#     """Token se naya password set karo."""
#     user = db.query(User).filter(User.reset_token == payload.token).first()

#     if not user:
#         raise HTTPException(status_code=400, detail="Invalid or expired token")

#     # Expiry check
#     if not user.reset_token_expires:
#         raise HTTPException(status_code=400, detail="Invalid token")

#     # Timezone-aware comparison
#     now = datetime.now(timezone.utc)
#     expires = user.reset_token_expires
#     if expires.tzinfo is None:
#         expires = expires.replace(tzinfo=timezone.utc)

#     if now > expires:
#         raise HTTPException(status_code=400, detail="Token expired")

#     # Password update
#     user.password_hash = hash_password(payload.new_password)
#     user.reset_token = None
#     user.reset_token_expires = None
#     user.last_password_change = datetime.utcnow()
#     db.commit()

#     return MessageResponse(message="Password successfully reset ho gaya. Ab login karo.")


# @router.get("/me", response_model=UserResponse)
# def me(current_user: User = Depends(get_current_user)):
#     """Current user info."""
#     return UserResponse.model_validate(current_user)

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
from app.models.user import User
from app.models.tenant import Tenant
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

router = APIRouter(prefix="/auth", tags=["Auth"])


# ============================================================
# HELPER: Refresh token save karo user row mein
# ============================================================
def _save_refresh_token(user: User, refresh_token: str) -> None:
    """Refresh token ka hash user row mein store karo."""
    user.refresh_token = hash_refresh_token(refresh_token)
    user.refresh_token_expires = get_refresh_token_expiry()


# ============================================================
# SIGNUP
# ============================================================
@router.post("/signup", response_model=AuthResponse, status_code=201)
def signup(payload: SignupRequest, db: Session = Depends(get_db)):
    """Naya client onboard karo — tenant + user + webhook_id."""

    existing = db.query(User).filter(User.email == payload.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # SuperAdmin logic
    super_admin_exists = db.query(User).filter(User.role == "super_admin").first()
    is_first_user = not super_admin_exists
    role = "super_admin" if is_first_user else "admin"

    # Webhook sirf client (admin) ke liye generate karo
    webhook_id = None
    api_key = None
    if not is_first_user:  # SuperAdmin ke liye nahi
        webhook_id = f"wh_{secrets.token_urlsafe(16)}"
        api_key = secrets.token_urlsafe(32)

    tenant = Tenant(
        name=payload.company_name or payload.full_name,
        webhook_id=webhook_id,       # ← None for super_admin
        api_key=api_key,             # ← None for super_admin
        settings={"webhook_enabled": bool(webhook_id)},
        status="active",
    )
    db.add(tenant)
    db.flush()

    user = User(
        full_name=payload.full_name,
        email=payload.email,
        password_hash=hash_password(payload.password),
        role=role,
        status="active",
        tenant_id=tenant.id,
        email_verified=False,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    db.refresh(tenant)

    token_data = {"sub": str(user.id), "role": user.role, "tenant_id": user.tenant_id}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    # Webhook URL — sirf agar webhook_id hai
    webhook_url = None
    if tenant.webhook_id:
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
            webhook_id=tenant.webhook_id,       # ← None for super_admin
            webhook_url=webhook_url,            # ← None for super_admin
            api_key=tenant.api_key,
        ),
    )


# ============================================================
# LOGIN
# ============================================================
@router.post("/signin", response_model=AuthResponse)
def login(payload: LoginRequest, db: Session = Depends(get_db)):
    """Login karo aur JWT token lo."""
    user = db.query(User).filter(User.email == payload.email).first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account inactive")

    user.last_login = datetime.now(timezone.utc)

    # Tenant fetch
    tenant = db.query(Tenant).filter(Tenant.id == user.tenant_id).first()

    token_data = {"sub": str(user.id), "role": user.role, "tenant_id": user.tenant_id}
    access_token = create_access_token(token_data)
    refresh_token = create_refresh_token(token_data)

    #  Refresh token save karo
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
            webhook_id=tenant.webhook_id,  # ← None
            webhook_url=webhook_url,       # ← None 
            api_key=tenant.api_key,
        ) if tenant else None,
    )


# ============================================================
#  REFRESH — access token expire hone pe naya token lo
# ============================================================
@router.post("/refresh", response_model=TokenResponse)
def refresh_tokens(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    """Refresh token se naya access + refresh token lo (rotation)."""
    token_hash = hash_refresh_token(payload.refresh_token)

    # 1. User dhoondo jiske paas yeh token hash hai
    user = db.query(User).filter(User.refresh_token == token_hash).first()
    if not user:
        raise HTTPException(status_code=401, detail="Invalid refresh token")

    # 2. Expiry check
    now = datetime.now(timezone.utc)
    expires = user.refresh_token_expires
    if expires is None:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    if expires.tzinfo is None:
        expires = expires.replace(tzinfo=timezone.utc)
    if now > expires:
        # Expired — clear kar do
        user.refresh_token = None
        user.refresh_token_expires = None
        db.commit()
        raise HTTPException(status_code=401, detail="Refresh token expired")

    # 3. User active hona chahiye
    if user.status != "active":
        raise HTTPException(status_code=403, detail="Account inactive")

    # 4. Rotation — naya access + refresh, purana replace
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
# LOGOUT — refresh token clear karo
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

    # Password update
    user.password_hash = hash_password(payload.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    user.last_password_change = now

    # ⭐ Security: refresh token bhi revoke karo
    # (agar attacker ke paas tha, wo bhi invalid ho jaye)
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