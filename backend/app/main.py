from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

os.makedirs("uploads/tasks", exist_ok=True)
from app.core.config import settings
from app.db.database import Base, engine          # ⭐ ADDED
from app.models import *
from app.routes import ( auth_routes,
                         superadmin_routes, 
                         lead_routes, 
                         webhook_routes,
                        proposal_routes,  
                        proposal_template_routes, 
                        dashboard_routes, 
                        webhook_setting_routes,
                        webhook_event_routes,
                        company_routes,         
                        contact_routes,
                        pipelines_routes,
                        followup_routes, 
                        calendar_routes,
                        meeting_routes,
                        automation_routes,
                        )
from app.api.v1.ai import router as ai_router
from app.routes import tenants_routes
from app.worker.followup_worker import start_worker, stop_worker
from app.routes import task_routes, ticket_routes
from app.worker.automation_worker import (
    start_automation_worker,
    stop_automation_worker,
)
from app.routes import audit_routes
from app.routes import report_routes
from app.routes import notification_routes
from app.routes import landing_routes
from app.routes import user_routes
from app.routes import tenant_billing_routes
from app.routes import industry_routes
from app.routes import it_project_routes, it_ticket_routes, it_dashboard_routes
from app.routes import it_pipeline_routes
from app.routes import role_change_routes
from app.routes import cashflow_routes
from app.routes import payment_routes 
from app.routes import portal_routes
from app.routes import lead_source_routes

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    debug=settings.DEBUG,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

Base.metadata.create_all(bind=engine)

# Routes
app.include_router(auth_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(superadmin_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(lead_routes.router, prefix="/api/v1") 
app.include_router(proposal_routes.router, prefix=settings.API_V1_PREFIX)  
app.include_router(proposal_template_routes.router, prefix=settings.API_V1_PREFIX) 
app.include_router(ai_router, prefix="/api/v1")
app.include_router(dashboard_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(tenants_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(webhook_setting_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(webhook_event_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(company_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(contact_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(pipelines_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(followup_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(task_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(calendar_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(meeting_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(ticket_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(automation_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(audit_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(report_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(notification_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(landing_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(user_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(tenant_billing_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(industry_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(it_project_routes.router, prefix=settings.API_V1_PREFIX,)
app.include_router(it_ticket_routes.router, prefix=settings.API_V1_PREFIX,)
app.include_router(it_dashboard_routes.router, prefix=settings.API_V1_PREFIX,)
app.include_router(it_pipeline_routes.router, prefix=settings.API_V1_PREFIX,)
app.include_router(role_change_routes.router, prefix=settings.API_V1_PREFIX,)
app.include_router(cashflow_routes.router, prefix=settings.API_V1_PREFIX,)
app.include_router(payment_routes.router, prefix=settings.API_V1_PREFIX,) 
app.include_router(portal_routes.router, prefix=settings.API_V1_PREFIX)
app.include_router(lead_source_routes.router, prefix=settings.API_V1_PREFIX)

# Public webhook (no /api/v1 prefix)
app.include_router(webhook_routes.router)                    




@app.get("/", tags=["Health"])
def root():
    return {"status": "ok", "app": settings.APP_NAME, "env": settings.APP_ENV}


@app.get("/health", tags=["Health"])
def health():
    return {"status": "healthy"}


@app.on_event("startup")
def startup_event():
    start_worker()
    start_automation_worker()   # ← Add


@app.on_event("shutdown")
def shutdown_event():
    stop_worker()
    stop_automation_worker()   # ← Add