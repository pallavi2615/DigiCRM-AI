from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime

from app.db.database import get_db
from app.core.deps import get_current_user
from app.core.permissions import require_role  # <-- NEW
from app.core.constants import (               # <-- NEW
    SUPER_ADMIN_ROLE as SA_CONST,
    ADMIN_ROLE,
    MANAGER_ROLE,
    EXECUTIVE_ROLE,
)
from app.models.user import User
from app.models.automation import AutomationRuleSetting, AutomationLog

router = APIRouter(prefix="/automation", tags=["Automation"])

SUPER_ADMIN_ROLE = "super_admin"


# ============ LIST ============
@router.get("/rules")
def list_rules(
    # 🔒 Only Super Admin, Admin, and Sales Manager can view automation rules
    user: User = Depends(
        require_role(SA_CONST, ADMIN_ROLE, MANAGER_ROLE)
    ),
    db: Session = Depends(get_db),
):
    """List all automation rules."""
    is_superadmin = user.role == "super_admin"

    if is_superadmin:
        # SuperAdmin — see all rules across tenants
        rules = (
            db.query(AutomationRuleSetting)
            .order_by(AutomationRuleSetting.tenant_id, AutomationRuleSetting.id)
            .all()
        )
    else:
        if not user.tenant_id:
            raise HTTPException(400, "User has no tenant")

        rules = (
            db.query(AutomationRuleSetting)
            .filter(AutomationRuleSetting.tenant_id == user.tenant_id)
            .order_by(AutomationRuleSetting.id)
            .all()
        )

    return [
        {
            "id": r.id,
            "tenant_id": r.tenant_id,
            "rule_key": r.rule_key,
            "name": r.name,
            "description": r.description,
            "trigger_text": r.trigger_text,
            "action_text": r.action_text,
            "rule_type": r.rule_type,
            "is_active": r.is_active,
            "updated_at": r.updated_at,
        }
        for r in rules
    ]


# ============ TOGGLE ============
@router.patch("/rules/{rule_id}/toggle")
def toggle_rule(
    rule_id: int,
    # 🔒 Only Super Admin and Admin can toggle automation rules
    user: User = Depends(
        require_role(SA_CONST, ADMIN_ROLE)
    ),
    db: Session = Depends(get_db),
):
    """Toggle a rule ON/OFF."""
    is_superadmin = user.role == "super_admin"

    query = db.query(AutomationRuleSetting).filter(AutomationRuleSetting.id == rule_id)

    if not is_superadmin:
        if not user.tenant_id:
            raise HTTPException(400, "User has no tenant")
        query = query.filter(AutomationRuleSetting.tenant_id == user.tenant_id)

    rule = query.first()
    if not rule:
        raise HTTPException(404, "Rule not found")

    rule.is_active = not rule.is_active
    rule.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(rule)

    return {
        "id": rule.id,
        "name": rule.name,
        "is_active": rule.is_active,
    }


# ============ LOGS ============
@router.get("/logs")
def list_logs(
    # 🔒 Only Super Admin, Admin, and Sales Manager can view automation logs
    user: User = Depends(
        require_role(SA_CONST, ADMIN_ROLE, MANAGER_ROLE)
    ),
    db: Session = Depends(get_db),
):
    """List automation execution logs."""
    query = db.query(AutomationLog)
    if user.role != SUPER_ADMIN_ROLE:
        query = query.filter(AutomationLog.tenant_id == user.tenant_id)
    return query.order_by(desc(AutomationLog.executed_at)).limit(50).all()