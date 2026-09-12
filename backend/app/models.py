from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.sql import func
from app.database import Base

class User(Base):
    __tablename__ = "users_details"
    
    id = Column(Integer, primary_key=True, index=True)
    full_name = Column(String(200), nullable=False)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), default="executive")
    status = Column(String(20), default="active")
    tenant_id = Column(Integer, nullable=True)
    reset_token = Column(String(255), nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)
    last_login = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())