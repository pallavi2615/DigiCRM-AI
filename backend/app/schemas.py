from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

# ===== SIGN UP =====
class UserSignUp(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=8)
    role: Optional[str] = "executive"

# ===== SIGN IN =====
class UserSignIn(BaseModel):
    email: EmailStr
    password: str

# ===== TOKEN RESPONSE =====
class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict

# ===== USER RESPONSE =====
class UserResponse(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

# ===== FORGOT PASSWORD =====
class ForgotPasswordRequest(BaseModel):
    email: EmailStr

# ===== RESET PASSWORD =====
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8)