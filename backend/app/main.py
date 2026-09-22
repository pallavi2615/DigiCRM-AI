from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

os.makedirs("uploads/tasks", exist_ok=True)

from app.core.config import settings
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
                        )
from app.api.v1.ai import router as ai_router
from app.routes import tenants_routes
from app.worker.followup_worker import start_worker, stop_worker
from app.routes import task_routes


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

@app.on_event("shutdown")
def shutdown_event():
    stop_worker()