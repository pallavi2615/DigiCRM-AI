from datetime import datetime
from sqlalchemy import Column, Integer, DateTime
from sqlalchemy.sql import func
from app.db.database import Base


class TimestampMixin:
    created_at = Column(DateTime, server_default=func.now(), nullable=False)
    updated_at = Column(
        DateTime,
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )