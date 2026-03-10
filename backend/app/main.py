# ============================================================
# main.py — FastAPI Application Entry Point
#
# TABLE OF CONTENTS
#   1. Imports
#   2. Database Initialization
#   3. App Factory
#   4. Middleware
#   5. Routers
#   6. Startup Events
#   7. Health Endpoints
# ============================================================

# region ── 1. Imports ───────────────────────────────────────
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import applications, lenders, underwriting
from app.core.config import settings
from app.core.database import Base, SessionLocal, engine
from app.models import *  # noqa: F401,F403 — registers all models with Base
from app.seed.seeder import seed_lenders
# endregion


# region ── 2. Database Initialization ───────────────────────
Base.metadata.create_all(bind=engine)
# endregion


# region ── 3. App Factory ────────────────────────────────────
app = FastAPI(
    title=settings.APP_TITLE,
    version=settings.APP_VERSION,
    description=(
        "Kaaj Lender Matching Platform — evaluates loan applications "
        "against lender credit policies in real time."
    ),
)
# endregion


# region ── 4. Middleware ─────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# endregion


# region ── 5. Routers ────────────────────────────────────────
app.include_router(applications.router, prefix="/api/v1")
app.include_router(lenders.router,      prefix="/api/v1")
app.include_router(underwriting.router, prefix="/api/v1")
# endregion


# region ── 6. Startup Events ─────────────────────────────────
@app.on_event("startup")
def on_startup() -> None:
    """
    Sync lender seed data with the database on every startup.
    Lenders added to lenders_data.py are inserted automatically.
    Lenders removed from lenders_data.py are deleted automatically.
    """
    db = SessionLocal()
    try:
        seed_lenders(db)
    finally:
        db.close()
# endregion


# region ── 7. Health Endpoints ───────────────────────────────
@app.get("/", tags=["Health"])
def root() -> dict:
    return {
        "message": "Kaaj Lender Matching API",
        "version": settings.APP_VERSION,
        "docs": "/docs",
    }


@app.get("/health", tags=["Health"])
def health() -> dict:
    return {"status": "healthy"}
# endregion