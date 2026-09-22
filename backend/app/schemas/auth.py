from pydantic import BaseModel, EmailStr, Field
from typing import Optional

from app.schemas.user import UserResponse


class SignupRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(..., min_length=6)
    company_name: Optional[str] = None  # tenant name


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int

class TenantInfo(BaseModel):
    id: int
    name: str
    webhook_id: Optional[str] = None       
    webhook_url: Optional[str] = None      
    api_key: Optional[str] = None

class AuthResponse(BaseModel):
    user: UserResponse
    tokens: TokenResponse
    tenant: TenantInfo

#  Naya — Forgot Password
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


#  Naya — Reset Password
class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6)


class MessageResponse(BaseModel):
    message: str
    
class RefreshTokenRequest(BaseModel):
    refresh_token: str


