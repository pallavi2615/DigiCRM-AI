from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
from jose import jwt, JWTError
from passlib.context import CryptContext
import secrets
import hashlib
from datetime import datetime, timedelta, timezone


from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def hash_password(password: str) -> str:
    """Plain password ko hash karo."""
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    """Plain password ko hashed se compare karo."""
    return pwd_context.verify(plain, hashed)


def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """JWT access token banao."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode.update({"exp": expire, "type": "access"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_refresh_token(data: Dict[str, Any]) -> str:
    """JWT refresh token banao."""
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_token(token: str) -> Optional[Dict[str, Any]]:
    """JWT token verify aur decode karo."""
    try:
        return jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError:
        return None

def generate_reset_token() -> str:
    """Secure random token generate karo."""
    return secrets.token_urlsafe(32)


def get_reset_token_expiry() -> datetime:
    """Reset token ki expiry time."""
    from app.core.config import settings
    return datetime.now(timezone.utc) + timedelta(minutes=settings.RESET_TOKEN_EXPIRE_MINUTES)

def hash_refresh_token(token: str) -> str:
    """Refresh token ka SHA-256 hash (DB mein plain store nahi karna)."""
    return hashlib.sha256(token.encode()).hexdigest()


def get_refresh_token_expiry() -> datetime:
    """Refresh token ki DB-side expiry datetime."""
    return datetime.now(timezone.utc) + timedelta(
        days=settings.REFRESH_TOKEN_EXPIRE_DAYS
    )