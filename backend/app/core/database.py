# ============================================================
# core/database.py — SQLAlchemy Engine, Session & Base
#
# TABLE OF CONTENTS
#   1. Engine
#   2. Session Factory
#   3. Declarative Base
#   4. Request-Scoped Session Dependency
# ============================================================

# region ── 1. Engine ─────────────────────────────────────────
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    echo=settings.DEBUG,       # logs SQL queries — disable in production
    pool_pre_ping=True,        # validates connections before use
)
# endregion


# region ── 2. Session Factory ────────────────────────────────
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)
# endregion


# region ── 3. Declarative Base ───────────────────────────────
class Base(DeclarativeBase):
    """
    All SQLAlchemy ORM models inherit from this base.
    Import order in models/__init__.py determines table creation order.
    """
    pass
# endregion


# region ── 4. Request-Scoped Session Dependency ──────────────
def get_db():
    """
    FastAPI dependency that yields a DB session per request.
    Session is always closed after the request, even on error.

    Usage:
        @router.get("/")
        def my_endpoint(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
# endregion