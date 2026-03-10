# ============================================================
# api/applications.py — Applications REST API
#
# TABLE OF CONTENTS
#   1. Router Setup
#   2. POST   /applications/          — Create application
#   3. GET    /applications/          — List applications
#   4. GET    /applications/{id}      — Get single application
#   5. PUT    /applications/{id}      — Update application
#   6. DELETE /applications/{id}      — Delete application
# ============================================================

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.application import Application, Business, LoanRequest, PersonalGuarantor
from app.schemas.application import ApplicationCreate, ApplicationOut, ApplicationUpdate


# region ── 1. Router Setup ───────────────────────────────────
router = APIRouter(prefix="/applications", tags=["Applications"])
# endregion


# region ── 2. POST /applications/ ────────────────────────────
@router.post("/", response_model=ApplicationOut, status_code=201)
def create_application(payload: ApplicationCreate, db: Session = Depends(get_db)):
    """
    Create a new loan application with business, guarantor, and loan request.
    equipment_age_years is auto-derived from equipment_year if not provided.
    Status is set to DRAFT — run underwriting separately.
    """
    app = Application()
    db.add(app)
    db.flush()

    business     = Business(application_id=app.id,      **payload.business.model_dump())
    guarantor    = PersonalGuarantor(application_id=app.id, **payload.guarantor.model_dump())
    loan_request = LoanRequest(application_id=app.id,   **payload.loan_request.model_dump())

    # Auto-derive equipment age from year if not explicitly provided
    if loan_request.equipment_year and not loan_request.equipment_age_years:
        loan_request.equipment_age_years = datetime.now().year - loan_request.equipment_year

    db.add_all([business, guarantor, loan_request])
    db.commit()
    db.refresh(app)
    return app
# endregion


# region ── 3. GET /applications/ ─────────────────────────────
@router.get("/", response_model=list[ApplicationOut])
def list_applications(skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    """List all applications with their child records, newest first."""
    return (
        db.query(Application)
        .options(
            joinedload(Application.business),
            joinedload(Application.guarantor),
            joinedload(Application.loan_request),
        )
        .order_by(Application.created_at.desc())
        .offset(skip)
        .limit(limit)
        .all()
    )
# endregion


# region ── 4. GET /applications/{id} ─────────────────────────
@router.get("/{application_id}", response_model=ApplicationOut)
def get_application(application_id: int, db: Session = Depends(get_db)):
    """Get a single application by ID."""
    app = (
        db.query(Application)
        .options(
            joinedload(Application.business),
            joinedload(Application.guarantor),
            joinedload(Application.loan_request),
        )
        .filter(Application.id == application_id)
        .first()
    )
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    return app
# endregion


# region ── 5. PUT /applications/{id} ─────────────────────────
@router.put("/{application_id}", response_model=ApplicationOut)
def update_application(application_id: int, payload: ApplicationUpdate, db: Session = Depends(get_db)):
    """Update application fields. Partial updates supported (exclude_unset)."""
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")

    if payload.business and app.business:
        for k, v in payload.business.model_dump(exclude_unset=True).items():
            setattr(app.business, k, v)

    if payload.guarantor and app.guarantor:
        for k, v in payload.guarantor.model_dump(exclude_unset=True).items():
            setattr(app.guarantor, k, v)

    if payload.loan_request and app.loan_request:
        for k, v in payload.loan_request.model_dump(exclude_unset=True).items():
            setattr(app.loan_request, k, v)

    db.commit()
    db.refresh(app)
    return app
# endregion


# region ── 6. DELETE /applications/{id} ──────────────────────
@router.delete("/{application_id}", status_code=204)
def delete_application(application_id: int, db: Session = Depends(get_db)):
    """Delete an application and all its child records (cascades)."""
    app = db.query(Application).filter(Application.id == application_id).first()
    if not app:
        raise HTTPException(status_code=404, detail="Application not found")
    db.delete(app)
    db.commit()
# endregion