# ============================================================
# DATABASE — SQLAlchemy engine, session factory, Base model
# ============================================================
from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.core.config import settings

engine = create_engine(settings.DATABASE_URL, echo=settings.DEBUG)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ------------------------------------
# Dependency: yields a DB session per request, auto-closes after
# ------------------------------------
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
