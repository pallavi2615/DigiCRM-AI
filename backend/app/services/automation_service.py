from sqlalchemy.orm import Session
from sqlalchemy import desc
from datetime import datetime, timedelta
from typing import Any, Dict

from app.models.automation import AutomationRuleSetting, AutomationLog
from app.models.lead import Lead


# ============================================================
# DEFAULT RULES TEMPLATE
# ============================================================
DEFAULT_AUTOMATION_RULES = [
    {
        "rule_key": "auto_assign_leads",
        "name": "Auto-assign new leads",
        "description": "New leads are automatically assigned to the next available sales rep",
        "trigger_text": "New lead created",
        "action_text": "Assign to round-robin sales rep",
        "rule_type": "event",
        "trigger_event": "lead_created",
        "action_type": "assign",
        "action_config": {"method": "round_robin"},
        "is_active": True,
    },
    {
        "rule_key": "followup_reminder",
        "name": "Follow-up reminder",
        "description": "Create a follow-up task if a lead has not been touched for 3 days",
        "trigger_text": "Lead untouched for 3 days",
        "action_text": "Create task for owner",
        "rule_type": "time",
        "trigger_event": "untouched_leads",
        "action_type": "notify",
        "action_config": {"days": 3, "create_task": True},
        "is_active": True,
    },
    {
        "rule_key": "deal_won_notification",
        "name": "Deal won notification",
        "description": "Notify the sales manager when a lead is moved to Won",
        "trigger_text": "Lead moved to Won",
        "action_text": "Notify sales manager",
        "rule_type": "event",
        "trigger_event": "proposal_accepted",
        "action_type": "move_stage",
        "action_config": {"target_stage": "won"},
        "is_active": True,
    },
    {
        "rule_key": "cold_lead_nurture",
        "name": "Cold lead nurture",
        "description": "Send a drip email sequence to cold leads after 7 days",
        "trigger_text": "Lead in New Status > 7 days",
        "action_text": "Send drip email sequence",
        "rule_type": "time",
        "trigger_event": "cold_leads",
        "action_type": "notify",
        "action_config": {"days": 7, "send_drip": True},
        "is_active": False,
    },
    {
        "rule_key": "proposal_followup",
        "name": "Proposal follow-up",
        "description": "Create a call task 2 days after a proposal is sent",
        "trigger_text": "Proposal sent + 2 days",
        "action_text": "Create call task",
        "rule_type": "time",
        "trigger_event": "proposal_sent",
        "action_type": "notify",
        "action_config": {"days": 2, "create_task": True},
        "is_active": True,
    },
]


def create_default_automation_rules(db: Session, tenant_id: int):
    """
    Create default automation rules for a new tenant.
    Called during signup.
    """
    for rule_data in DEFAULT_AUTOMATION_RULES:
        # Check if already exists
        existing = (
            db.query(AutomationRuleSetting)
            .filter(
                AutomationRuleSetting.tenant_id == tenant_id,
                AutomationRuleSetting.rule_key == rule_data["rule_key"],
            )
            .first()
        )
        if existing:
            continue

        rule = AutomationRuleSetting(
            tenant_id=tenant_id,
            rule_key=rule_data["rule_key"],
            name=rule_data["name"],
            description=rule_data["description"],
            trigger_text=rule_data["trigger_text"],
            action_text=rule_data["action_text"],
            rule_type=rule_data["rule_type"],
            trigger_event=rule_data["trigger_event"],
            action_type=rule_data["action_type"],
            action_config=rule_data["action_config"],
            is_active=rule_data["is_active"],
        )
        db.add(rule)
    # Don't commit here — caller will commit


# ============================================================
# AUTOMATION ENGINE
# ============================================================
class AutomationEngine:
    """Unified automation engine."""

    def __init__(self, db: Session):
        self.db = db

    # ============================================================
    # EVENT-BASED
    # ============================================================
    def trigger_event(
        self,
        tenant_id: int,
        event: str,
        entity_type: str = "lead",
        entity: Any = None,
        context: Dict = None,
    ):
        rules = (
            self.db.query(AutomationRuleSetting)
            .filter(
                AutomationRuleSetting.tenant_id == tenant_id,
                AutomationRuleSetting.is_active == True,
                AutomationRuleSetting.rule_type == "event",
                AutomationRuleSetting.trigger_event == event,
            )
            .all()
        )
        for rule in rules:
            self._execute_rule(rule, entity, context or {})

    # ============================================================
    # CONDITION-BASED
    # ============================================================
    def trigger_conditional(
        self,
        tenant_id: int,
        entity_type: str = "lead",
        entity: Any = None,
    ):
        rules = (
            self.db.query(AutomationRuleSetting)
            .filter(
                AutomationRuleSetting.tenant_id == tenant_id,
                AutomationRuleSetting.is_active == True,
                AutomationRuleSetting.rule_type == "condition",
            )
            .all()
        )
        for rule in rules:
            if self._matches_condition(rule.trigger_condition, entity):
                self._execute_rule(rule, entity)

    def _matches_condition(self, condition: Dict, entity: Any) -> bool:
        if not condition or not entity:
            return False

        field = condition.get("field")
        operator = condition.get("operator")
        value = condition.get("value")

        if not field or not hasattr(entity, field):
            return False

        try:
            entity_value = getattr(entity, field)
            if operator == "eq":
                return entity_value == value
            elif operator == "gt":
                return entity_value > value
            elif operator == "lt":
                return entity_value < value
            elif operator == "gte":
                return entity_value >= value
            elif operator == "lte":
                return entity_value <= value
        except (TypeError, AttributeError):
            return False
        return False

    # ============================================================
    # TIME-BASED (worker)
    # ============================================================
    def run_time_rules(self):
        rules = (
            self.db.query(AutomationRuleSetting)
            .filter(
                AutomationRuleSetting.is_active == True,
                AutomationRuleSetting.rule_type == "time",
            )
            .all()
        )
        for rule in rules:
            self._execute_time_rule(rule)

    def _execute_time_rule(self, rule: AutomationRuleSetting):
        config = rule.trigger_condition or {}

        if rule.trigger_event == "untouched_leads":
            days = config.get("days", 3)
            cutoff = datetime.utcnow() - timedelta(days=days)
            leads = (
                self.db.query(Lead)
                .filter(
                    Lead.tenant_id == rule.tenant_id,
                    Lead.status.in_(["new", "contacted"]),
                    Lead.updated_at < cutoff,
                )
                .all()
            )
            for lead in leads:
                self._apply_action(rule, lead)
                self._log(rule, lead, "success")

    # ============================================================
    # EXECUTE
    # ============================================================
    def _execute_rule(self, rule: AutomationRuleSetting, entity: Any, context: Dict = None):
        try:
            self._apply_action(rule, entity, context or {})
            self._log(rule, entity, "success")
        except Exception as e:
            self._log(rule, entity, "failed", str(e))

    def _apply_action(self, rule: AutomationRuleSetting, entity: Any, context: Dict = None):
        action = rule.action_type
        config = rule.action_config or {}

        if action == "move_stage":
            target = config.get("target_stage")
            if target and hasattr(entity, "status"):
                entity.status = target

        elif action == "set_priority":
            priority = config.get("priority")
            if priority and hasattr(entity, "priority"):
                entity.priority = priority

        elif action == "assign":
            method = config.get("method")
            if method == "round_robin" and hasattr(entity, "assigned_to"):
                # TODO: Implement round-robin logic
                pass

        elif action == "add_tag":
            tag = config.get("tag")
            if tag and hasattr(entity, "tags"):
                tags = list(entity.tags or [])
                if tag not in tags:
                    tags.append(tag)
                entity.tags = tags

        elif action == "notify":
            # TODO: Notification service
            pass

        self.db.commit()

    def _log(self, rule: AutomationRuleSetting, entity: Any, result: str, error: str = None):
        log = AutomationLog(
            tenant_id=rule.tenant_id,
            rule_id=rule.id,
            entity_type="lead",
            entity_id=getattr(entity, "id", 0),
            action_taken=rule.action_type,
            result=result,
            error_message=error,
        )
        self.db.add(log)
        self.db.commit()