# ============================================================
# MAIN — FastAPI app entry point
# ============================================================

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import engine, SessionLocal
from app.models import *   # ensures all models are registered with Base
from app.core.database import Base
from app.api import applications, lenders, underwriting
from app.seed.seeder import seed_lenders

# ------------------------------------
# Create all tables on startup
# ------------------------------------
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description="Lender Matching Platform — evaluates loan applications against lender credit policies"
)

# ------------------------------------
# CORS — allow frontend dev server
# ------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------------
# Routers
# ------------------------------------
app.include_router(applications.router, prefix="/api/v1")
app.include_router(lenders.router, prefix="/api/v1")
app.include_router(underwriting.router, prefix="/api/v1")


# ------------------------------------
# Startup event — auto-seed lenders
# ------------------------------------
@app.on_event("startup")
def startup_event():
    db = SessionLocal()
    try:
        seed_lenders(db)
    finally:
        db.close()


@app.get("/")
def root():
    return {"message": "Kaaj Lender Matching API", "version": settings.APP_VERSION, "docs": "/docs"}


@app.get("/health")
def health():
    return {"status": "healthy"}
