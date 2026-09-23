from app.routes.auth_routes import router as auth_router
from app.routes.lead_routes import router as lead_router
from app.routes.proposal_routes import router as proposal_router
from app.routes.proposal_template_routes import router as proposal_template_router
from app.routes.webhook_routes import router as webhook_router
from app.routes.superadmin_routes import router as superadmin_router
from app.routes.dashboard_routes import router as dashboard_router
from app.routes.company_routes import router as company_router
from app.routes.contact_routes import router as contact_router
from app.routes.followup_routes import router as followup_router
from app.routes.followup_routes import router as task_router
from app.routes.calendar_routes import router as calendar_router
from app.routes.meeting_routes import router as meeting_router
from app.routes.ticket_routes import router as ticket_router

__all__ = [
    "auth_router",
    "lead_router",
    "proposal_router",
    "proposal_template_router",
    "webhook_router",
    "superadmin_router",
    "dashboard_router",
    "company_router",
    "contact_router",
    "followup_router",
    "task_router",
    "calendar_router",
    "meeting_router",
    "ticket_router",
]