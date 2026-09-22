"""
Role-based access control utilities.

Provides decorators and helpers to enforce role-based
permissions across API endpoints.
"""

from fastapi import Depends, HTTPException, status
from app.core.deps import get_current_user
from app.core.constants import SUPER_ADMIN_ROLE
from app.models.user import User


def require_super_admin(
    user: User = Depends(get_current_user),
) -> User:
    """
    Dependency that ensures the current user is a SuperAdmin.

    Use this for endpoints that must only be accessible by
    platform administrators.

    Raises:
        HTTPException: 403 if user is not a SuperAdmin.
    """
    if user.role != SUPER_ADMIN_ROLE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SuperAdmin access required",
        )
    return user


def require_role(*allowed_roles: str):
    """
    Dependency factory that ensures the current user has
    one of the specified roles.

    Args:
        *allowed_roles: Role identifiers permitted to access.

    Returns:
        Dependency callable for FastAPI.

    Example:
        @router.get("/admin-only")
        def admin_endpoint(user=Depends(require_role("admin", "super_admin"))):
            ...
    """
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}",
            )
        return user
    return checker