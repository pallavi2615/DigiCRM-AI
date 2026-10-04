"""
Role-based access control utilities.

Provides decorators and helpers to enforce role-based
permissions across API endpoints.
"""

from fastapi import Depends, HTTPException, status
from app.core.deps import get_current_user
from app.core.constants import (
    SUPER_ADMIN_ROLE,
    ADMIN_ROLE,
    MANAGER_ROLE,
    EXECUTIVE_ROLE,
)
from app.models.user import User


# ==========================================
# 1. BASIC ROLE CHECKS
# ==========================================

def require_super_admin(
    user: User = Depends(get_current_user),
) -> User:
    """Dependency that ensures the current user is a SuperAdmin."""
    if user.role != SUPER_ADMIN_ROLE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="SuperAdmin access required",
        )
    return user


def require_role(*allowed_roles: str):
    """Dependency factory that ensures the current user has one of the specified roles."""
    def checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required roles: {', '.join(allowed_roles)}",
            )
        return user
    return checker


# ==========================================
# 2. FEATURE MATRIX (From the UI Screenshot)
# ==========================================
# Pattern:
#   - super_admin  : full access (view, create, edit, delete)
#   - admin        : full access (view, create, edit, delete)
#   - manager      : NO delete (view, create, edit only)
#   - executive    : NO delete (view, create, edit only)

FEATURE_MATRIX = {
    "dashboard": {
        SUPER_ADMIN_ROLE: ["view", "create", "edit", "delete"],
        ADMIN_ROLE:       ["view", "create", "edit", "delete"],
        MANAGER_ROLE:     ["view", "create", "edit"],
        EXECUTIVE_ROLE:   ["view", "create", "edit"],
    },
    "leads": {
        SUPER_ADMIN_ROLE: ["view", "create", "edit", "delete"],
        ADMIN_ROLE:       ["view", "create", "edit", "delete"],
        MANAGER_ROLE:     ["view", "create", "edit"],
        EXECUTIVE_ROLE:   ["view", "create", "edit"],
    },
    "contacts": {
        SUPER_ADMIN_ROLE: ["view", "create", "edit", "delete"],
        ADMIN_ROLE:       ["view", "create", "edit", "delete"],
        MANAGER_ROLE:     ["view", "create", "edit"],
        EXECUTIVE_ROLE:   ["view", "create", "edit"],
    },
    "companies": {
        SUPER_ADMIN_ROLE: ["view", "create", "edit", "delete"],
        ADMIN_ROLE:       ["view", "create", "edit", "delete"],
        MANAGER_ROLE:     ["view", "create", "edit"],
        EXECUTIVE_ROLE:   ["view", "create", "edit"],
    },
    "pipeline": {
        SUPER_ADMIN_ROLE: ["view", "create", "edit", "delete"],
        ADMIN_ROLE:       ["view", "create", "edit", "delete"],
        MANAGER_ROLE:     ["view", "create", "edit"],
        EXECUTIVE_ROLE:   ["view", "create", "edit"],
    },
    "tasks": {
        SUPER_ADMIN_ROLE: ["view", "create", "edit", "delete"],
        ADMIN_ROLE:       ["view", "create", "edit", "delete"],
        MANAGER_ROLE:     ["view", "create", "edit"],
        EXECUTIVE_ROLE:   ["view", "create", "edit"],
    },
    "calendar": {
        SUPER_ADMIN_ROLE: ["view", "create", "edit", "delete"],
        ADMIN_ROLE:       ["view", "create", "edit", "delete"],
        MANAGER_ROLE:     ["view", "create", "edit"],
        EXECUTIVE_ROLE:   ["view", "create", "edit"],
    },
    "meetings": {
        SUPER_ADMIN_ROLE: ["view", "create", "edit", "delete"],
        ADMIN_ROLE:       ["view", "create", "edit", "delete"],
        MANAGER_ROLE:     ["view", "create", "edit"],
        EXECUTIVE_ROLE:   ["view", "create", "edit"],
    },
    "cashflow": {
        "super_admin":     ["view", "create", "edit", "delete"],
        "admin":           ["view", "create", "edit", "delete"],
        "manager":         ["view"],                    # View only
        "sales_executive": [],                          # No access
    },
    # ── NEW: Payments & Ledger ──────────────────
    "payments": {
        "super_admin":     ["view", "create", "edit", "delete"],
        "admin":           ["view", "create", "edit", "delete"],
        "sales_manager":   ["view"],
        "sales_executive": [],
    },

    # ── NEW: Payout Accounts ────────────────────
    "payout-accounts": {
        "super_admin":     ["view", "create", "edit", "delete"],
        "admin":           ["view", "create", "edit", "delete"],
        "sales_manager":   ["view"],
        "sales_executive": [],
    },

    # ── NEW: Payout History ─────────────────────
    "payout-history": {
        "super_admin":     ["view", "create", "edit", "delete"],
        "admin":           ["view", "create", "edit", "delete"],
        "sales_manager":   ["view"],
        "sales_executive": ["view"],
    },

    # ── NEW: Billing ────────────────────────────
    "billing": {
        "super_admin":     ["view", "create", "edit", "delete"],
        "admin":           ["view", "create", "edit", "delete"],
        "sales_manager":   [],
        "sales_executive": [],
    },

    # ── NEW: Partner Payouts ────────────────────
    "partner": {
        "super_admin":     ["view", "create", "edit", "delete"],
        "admin":           ["view", "create", "edit", "delete"],
        "sales_manager":   ["view"],
        "sales_executive": ["view"],
    },

    # ── NEW: Affiliates ─────────────────────────
    "affiliates": {
        "super_admin":     ["view", "create", "edit", "delete"],
        "admin":           ["view", "create", "edit", "delete"],
        "sales_manager":   ["view"],
        "sales_executive": ["view"],
    },


}


def require_feature_permission(module: str, action: str):
    """
    Enforces the Feature Matrix.
    Example: Depends(require_feature_permission("leads", "delete"))
    """
    def checker(user: User = Depends(get_current_user)) -> User:
        user_role = user.role
        if module not in FEATURE_MATRIX:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Module '{module}' not configured in permissions matrix.",
            )
        allowed = FEATURE_MATRIX[module].get(user_role, [])
        if action not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied: Role '{user_role}' cannot '{action}' in '{module}'.",
            )
        return user
    return checker