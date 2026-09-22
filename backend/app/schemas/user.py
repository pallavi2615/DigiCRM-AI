from pydantic import BaseModel
from typing import Optional


class UserResponse(BaseModel):
    id: int
    full_name: str
    email: str
    role: str
    status: str
    tenant_id: Optional[int] = None

    class Config:
        from_attributes = True