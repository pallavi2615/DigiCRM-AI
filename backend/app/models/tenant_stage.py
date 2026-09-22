from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

from app.db.database import Base


class TenantStage(Base):
    """Custom pipeline stage for a tenant."""
    __tablename__ = "tenant_stages"

    id = Column(Integer, primary_key=True, index=True)
    tenant_id = Column(Integer, ForeignKey("tenants.id", ondelete="CASCADE"), index=True)
    name = Column(String(100), nullable=False)
    color = Column(String(50), default="#3B82F6")
    order_index = Column(Integer, default=0)
    is_won = Column(Boolean, default=False)
    is_lost = Column(Boolean, default=False)
    created_at = Column(DateTime, server_default=func.now())