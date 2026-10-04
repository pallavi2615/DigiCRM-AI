"""
Audit logging service — called by other routes when CRUD happens.
API is read-only for audit logs.
"""

import logging
from typing import Optional, Dict, Any
from uuid import UUID, uuid4
from sqlalchemy.orm import Session
from fastapi import Request

from app.models.audit_log import AuditLog
from app.models.user import User

logger = logging.getLogger(__name__)


def _safe(v):
    """Make a value JSON-serializable for the JSONB column."""
    if v is None:
        return None
    if isinstance(v, (str, int, float, bool)):
        return v
    return str(v)


class AuditService:
    def __init__(self, db: Session):
        self.db = db

    # ── Core writer ────────────────────────────────────
    def log(
        self,
        *,
        tenant_id: int,
        table_name: str,
        row_id,
        action: str,
        user: Optional[User] = None,
        description: Optional[str] = None,
        changes: Optional[Dict[str, Any]] = None,
        request: Optional[Request] = None,
    ) -> Optional[AuditLog]:
        """Write a single audit log entry. Swallows exceptions."""
        try:
            ip = None
            ua = None
            if request is not None:
                ip = request.client.host if request.client else None
                ua = request.headers.get("user-agent")

            # Coerce row_id to UUID
            if isinstance(row_id, UUID):
                rid = row_id
            else:
                try:
                    rid = UUID(str(row_id))
                except (ValueError, AttributeError, TypeError):
                    rid = uuid4()

            entry = AuditLog(
                tenant_id=tenant_id,
                user_id=user.id if user else None,
                user_name=user.full_name if user else "System",
                table_name=table_name,
                row_id=rid,
                action=action,
                description=description,
                changes=changes,
                ip_address=ip,
                user_agent=ua,
            )
            self.db.add(entry)
            self.db.flush()
            return entry
        except Exception as e:
            logger.exception("Audit log write failed (non-fatal): %s", e)
            return None

    # ── Convenience: kwargs-style ─────────────────────
    def log_created(self, **kwargs) -> Optional[AuditLog]:
        kwargs["action"] = "created"
        kwargs.setdefault(
            "description",
            f"Created {kwargs.get('table_name', 'record')}",
        )
        return self.log(**kwargs)

    def log_updated(self, changes: Dict[str, Any], **kwargs) -> Optional[AuditLog]:
        kwargs["action"] = "updated"
        kwargs["changes"] = changes
        if changes:
            fields = ", ".join(changes.keys())
            kwargs.setdefault(
                "description",
                f"Updated {kwargs.get('table_name', 'record')} — changed: {fields}",
            )
        return self.log(**kwargs)

    def log_deleted(self, **kwargs) -> Optional[AuditLog]:
        kwargs["action"] = "deleted"
        kwargs.setdefault(
            "description",
            f"Deleted {kwargs.get('table_name', 'record')}",
        )
        return self.log(**kwargs)

    # ⭐ Convenience: pass ORM object directly ─────────
    def log_created_obj(
        self,
        *,
        entity_obj,
        tenant_id: int,
        user: Optional[User] = None,
        request: Optional[Request] = None,
    ) -> Optional[AuditLog]:
        return self.log(
            tenant_id=tenant_id,
            table_name=entity_obj.__tablename__,
            row_id=getattr(entity_obj, "uuid", None),
            action="created",
            user=user,
            request=request,
            description=f"Created {entity_obj.__tablename__}",
        )

    def log_updated_obj(
        self,
        *,
        entity_obj,
        tenant_id: int,
        changes: Dict[str, Any],
        user: Optional[User] = None,
        request: Optional[Request] = None,
    ) -> Optional[AuditLog]:
        fields = ", ".join(changes.keys()) if changes else ""
        return self.log(
            tenant_id=tenant_id,
            table_name=entity_obj.__tablename__,
            row_id=getattr(entity_obj, "uuid", None),
            action="updated",
            user=user,
            request=request,
            changes=changes,
            description=(
                f"Updated {entity_obj.__tablename__} — changed: {fields}"
                if fields else f"Updated {entity_obj.__tablename__}"
            ),
        )

    def log_deleted_obj(
        self,
        *,
        entity_obj,
        tenant_id: int,
        user: Optional[User] = None,
        request: Optional[Request] = None,
    ) -> Optional[AuditLog]:
        return self.log(
            tenant_id=tenant_id,
            table_name=entity_obj.__tablename__,
            row_id=getattr(entity_obj, "uuid", None),
            action="deleted",
            user=user,
            request=request,
            description=f"Deleted {entity_obj.__tablename__}",
        )

    # ── Diff helper ───────────────────────────────────
    @staticmethod
    def diff(
        before: Dict[str, Any],
        after: Dict[str, Any],
        ignore_fields: Optional[list] = None,
    ) -> Dict[str, Dict[str, Any]]:
        """Return { field: {"before": X, "after": Y} } for changed fields."""
        ignore = set(ignore_fields or [])
        result = {}
        for key in after.keys():
            if key in ignore:
                continue
            old = before.get(key)
            new = after.get(key)
            if old != new:
                result[key] = {"before": _safe(old), "after": _safe(new)}
        return result