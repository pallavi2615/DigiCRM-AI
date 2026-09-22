from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.db.database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(200), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="executive", index=True)
    status = Column(String(20), default="active", index=True)
    phone = Column(String(20))
    avatar_url = Column(String(500))
    department = Column(String(100))
    designation = Column(String(100))
    tenant_id = Column(Integer, ForeignKey("tenants.id"), index=True)

    reset_token = Column(String(255), nullable=True, index=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    
    refresh_token = Column(String(64), nullable=True, index=True)
    refresh_token_expires = Column(DateTime(timezone=True), nullable=True)

    last_password_change = Column(DateTime)
    email_verified = Column(Boolean, default=False)
    failed_login_attempts = Column(Integer, default=0)
    locked_until = Column(DateTime)
    last_login = Column(DateTime)

    invited_by = Column(Integer, ForeignKey("users.id"))
    invite_accepted_at = Column(DateTime)

    created_at = Column(DateTime, server_default=func.now())
    updated_at = Column(DateTime, server_default=func.now(), onupdate=func.now())