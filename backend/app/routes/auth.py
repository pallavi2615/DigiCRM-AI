from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
import secrets

from app.database import get_db
from app.models import User
from app.schemas import (
    UserSignUp, UserSignIn, TokenResponse, UserResponse,
    ForgotPasswordRequest, ResetPasswordRequest
)
from app.auth import (
    get_password_hash, verify_password,
    create_access_token, create_refresh_token, get_current_user
)

router = APIRouter()

# ============================================================
# 1. SIGN UP API
# ============================================================
@router.post("/signup", response_model=TokenResponse, status_code=201)
def sign_up(user_data: UserSignUp, db: Session = Depends(get_db)):
    """
    Register new user
    """
    # Check if email already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(
            status_code=400,
            detail="Email already registered"
        )
    
    # Create new user
    new_user = User(
        full_name=user_data.full_name,
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role=user_data.role or "executive",
        status="active"
    )
    
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    
    # Generate tokens
    access_token = create_access_token(data={"sub": str(new_user.id)})
    refresh_token = create_refresh_token(data={"sub": str(new_user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": new_user.id,
            "full_name": new_user.full_name,
            "email": new_user.email,
            "role": new_user.role,
            "status": new_user.status
        }
    }


# ============================================================
# 2. SIGN IN API
# ============================================================
@router.post("/signin", response_model=TokenResponse)
def sign_in(credentials: UserSignIn, db: Session = Depends(get_db)):
    """
    Login with email and password
    """
    user = db.query(User).filter(User.email == credentials.email).first()
    
    if not user or not verify_password(credentials.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )
    
    if user.status != "active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is inactive. Please contact admin."
        )
    
    # Update last login
    user.last_login = datetime.utcnow()
    db.commit()
    
    # Generate tokens
    access_token = create_access_token(data={"sub": str(user.id)})
    refresh_token = create_refresh_token(data={"sub": str(user.id)})
    
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "email": user.email,
            "role": user.role,
            "status": user.status
        }
    }


# ============================================================
# 3. FORGOT PASSWORD API
# ============================================================
@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, db: Session = Depends(get_db)):
    """
    Send reset password link to email
    """
    user = db.query(User).filter(User.email == request.email).first()
    
    # Security: Always return success even if email not found
    if not user:
        return {
            "message": "If email exists, reset link has been sent",
            "success": True
        }
    
    # Generate reset token (valid for 15 minutes)
    reset_token = secrets.token_urlsafe(32)
    user.reset_token = reset_token
    user.reset_token_expires = datetime.utcnow() + timedelta(minutes=15)
    db.commit()
    
    # TODO: Send email with reset link
    # reset_link = f"{os.getenv('FRONTEND_URL')}/reset-password?token={reset_token}"
    # send_email(user.email, reset_link)
    
    # For development: Return token in response
    return {
        "message": "Reset link sent to your email",
        "success": True,
        "reset_token": reset_token,  # Remove this in production!
        "expires_in": "15 minutes"
    }


# ============================================================
# 4. RESET PASSWORD API
# ============================================================
@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    """
    Reset password using token
    """
    user = db.query(User).filter(User.reset_token == request.token).first()
    
    if not user:
        raise HTTPException(
            status_code=400,
            detail="Invalid reset token"
        )
    
    # Check if token expired
    if user.reset_token_expires < datetime.utcnow():
        raise HTTPException(
            status_code=400,
            detail="Reset token has expired. Please request a new one."
        )
    
    # Update password
    user.password_hash = get_password_hash(request.new_password)
    user.reset_token = None
    user.reset_token_expires = None
    db.commit()
    
    return {
        "message": "Password reset successfully",
        "success": True
    }


# ============================================================
# 5. GET CURRENT USER (Protected)
# ============================================================
@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    """
    Get logged-in user's profile
    """
    return current_user


# ============================================================
# 6. LOGOUT API
# ============================================================
@router.post("/logout")
def logout(current_user: User = Depends(get_current_user)):
    """
    Logout (frontend deletes token)
    """
    return {
        "message": "Logged out successfully",
        "success": True
    }