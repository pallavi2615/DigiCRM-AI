from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routes import auth

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DigiCRM AI API",
    description="Authentication APIs for DigiCRM AI",
    version="1.0.0"
)

# CORS - Allow your frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",     # Your React dev server
        "http://localhost:3000",     # Alternative
        "http://localhost:5173",     # Vite
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register auth routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])

@app.get("/")
def root():
    return {
        "name": "DigiCRM AI API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
        "auth_endpoints": {
            "signup": "POST /api/auth/signup",
            "signin": "POST /api/auth/signin",
            "forgot_password": "POST /api/auth/forgot-password",
            "reset_password": "POST /api/auth/reset-password",
            "me": "GET /api/auth/me",
            "logout": "POST /api/auth/logout"
        }
    }

@app.get("/health")
def health():
    return {"status": "healthy"}