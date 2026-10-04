"""
Industry Access Gate.

Blocks endpoints if the current tenant is not subscribed to
the required industry.

Usage:
    @router.get("/projects")
    def list_projects(
        user: User = Depends(require_industry("it_company")),
        ...
    ):
        ...
"""

from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.core.deps import get_current_user
from app.models.user import User
from app.models.industry import Industry, TenantIndustry


def require_industry(industry_key: str):
    """
    Dependency factory — blocks if tenant is not subscribed
    to the given industry.

    SuperAdmin bypasses the check.
    """

    def checker(
        user: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        # SuperAdmin can access any industry (for support/debugging)
        if user.role == "super_admin":
            return user

        if not user.tenant_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User has no tenant",
            )

        # Check active subscription
        sub = (
            db.query(TenantIndustry)
            .join(Industry, Industry.id == TenantIndustry.industry_id)
            .filter(
                TenantIndustry.tenant_id == user.tenant_id,
                TenantIndustry.status == "active",
                Industry.key == industry_key,
                Industry.is_active == True,
            )
            .first()
        )

        if not sub:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=(
                    f"Industry '{industry_key}' is not subscribed by your workspace. "
                    "Contact your administrator."
                ),
            )

        return user

    return checker