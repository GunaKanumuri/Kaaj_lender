# ============================================================
# models/application.py — Loan Application ORM Models
#
# TABLE OF CONTENTS
#   1. ApplicationStatus Enum
#   2. Application  (parent record)
#   3. Business     (the company applying)
#   4. PersonalGuarantor  (the individual signing the PG)
#   5. LoanRequest  (what they're asking for)
#
# DESIGN — One application, three child records:
#   Application
#     ├── Business          (1:1)
#     ├── PersonalGuarantor (1:1)
#     └── LoanRequest       (1:1)
#
#   Deleting an Application cascades to all children.
#   MatchResults also cascade-delete from Application.
# ============================================================

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# region ── 1. ApplicationStatus Enum ─────────────────────────

class ApplicationStatus(str, enum.Enum):
    DRAFT        = "draft"         # Created, underwriting not yet run
    SUBMITTED    = "submitted"     # Submitted for review (future use)
    UNDER_REVIEW = "under_review"  # Being manually reviewed (future use)
    COMPLETED    = "completed"     # Underwriting has run successfully
    FAILED       = "failed"        # Underwriting encountered an error

# endregion


# region ── 2. Application ────────────────────────────────────

class Application(Base):
    """
    The root application record. Acts as a wrapper/FK anchor
    for Business, PersonalGuarantor, and LoanRequest.
    Status transitions from DRAFT → COMPLETED after underwriting runs.
    """
    __tablename__ = "applications"

    id:         Mapped[int]      = mapped_column(Integer, primary_key=True)
    status:     Mapped[str]      = mapped_column(String(30), default=ApplicationStatus.DRAFT)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business:     Mapped["Business"]          = relationship("Business",          back_populates="application", uselist=False, cascade="all, delete-orphan")
    guarantor:    Mapped["PersonalGuarantor"] = relationship("PersonalGuarantor", back_populates="application", uselist=False, cascade="all, delete-orphan")
    loan_request: Mapped["LoanRequest"]       = relationship("LoanRequest",       back_populates="application", uselist=False, cascade="all, delete-orphan")
    match_results:Mapped[list["MatchResult"]] = relationship("MatchResult",       back_populates="application", cascade="all, delete-orphan")

# endregion


# region ── 3. Business ───────────────────────────────────────

class Business(Base):
    """
    The company applying for equipment finance.
    Fields here map to rule engine context keys:
      years_in_business → time_in_business_years
      state             → business_state
      paynet_score      → paynet_score
    """
    __tablename__ = "businesses"

    id:             Mapped[int]        = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int]        = mapped_column(ForeignKey("applications.id"), nullable=False)

    # Identity
    business_name:  Mapped[str]        = mapped_column(String(300), nullable=False)
    business_type:  Mapped[str | None] = mapped_column(String(100))   # LLC, Corp, Sole Prop, Partnership
    industry:       Mapped[str | None] = mapped_column(String(200))
    state:          Mapped[str | None] = mapped_column(String(2))      # 2-letter state code

    # Financials
    years_in_business: Mapped[float | None] = mapped_column(Float)    # Decimal years, e.g. 2.5
    annual_revenue:    Mapped[float | None] = mapped_column(Float)
    is_startup:        Mapped[bool]         = mapped_column(Boolean, default=False)

    # Business credit
    paynet_score: Mapped[int | None] = mapped_column(Integer)         # Optional — not all borrowers have one

    application: Mapped["Application"] = relationship("Application", back_populates="business")

# endregion


# region ── 4. PersonalGuarantor ──────────────────────────────

class PersonalGuarantor(Base):
    """
    The individual(s) personally guaranteeing the loan.
    Credit profile, derogatory flags, and debt load all live here.
    """
    __tablename__ = "personal_guarantors"

    id:             Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), nullable=False)

    # Identity
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name:  Mapped[str] = mapped_column(String(100), nullable=False)

    # Credit profile
    fico_score:         Mapped[int | None]   = mapped_column(Integer)
    is_homeowner:       Mapped[bool]         = mapped_column(Boolean, default=False)
    is_us_citizen:      Mapped[bool]         = mapped_column(Boolean, default=True)
    years_at_residence: Mapped[float | None] = mapped_column(Float)

    # Derogatory flags — all default False (clean)
    has_bankruptcy:           Mapped[bool]         = mapped_column(Boolean, default=False)
    years_since_bankruptcy:   Mapped[float | None] = mapped_column(Float)
    has_judgement:            Mapped[bool]         = mapped_column(Boolean, default=False)
    has_foreclosure:          Mapped[bool]         = mapped_column(Boolean, default=False)
    has_repossession:         Mapped[bool]         = mapped_column(Boolean, default=False)
    has_tax_lien:             Mapped[bool]         = mapped_column(Boolean, default=False)
    has_collections_last_3y:  Mapped[bool]         = mapped_column(Boolean, default=False)

    # Debt load
    revolving_debt:                Mapped[float | None] = mapped_column(Float)
    revolving_plus_unsecured_debt: Mapped[float | None] = mapped_column(Float)
    comparable_credit_pct:         Mapped[float | None] = mapped_column(Float)  # % of loan covered by comparable credit

    application: Mapped["Application"] = relationship("Application", back_populates="guarantor")

# endregion


# region ── 5. LoanRequest ────────────────────────────────────

class LoanRequest(Base):
    """
    The specific equipment finance request.
    equipment_age_years is auto-derived from equipment_year in the API layer
    if not explicitly provided.
    """
    __tablename__ = "loan_requests"

    id:             Mapped[int]   = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int]   = mapped_column(ForeignKey("applications.id"), nullable=False)

    # Loan terms
    amount:      Mapped[float]    = mapped_column(Float, nullable=False)
    term_months: Mapped[int | None] = mapped_column(Integer)

    # Equipment details
    equipment_type:     Mapped[str | None]   = mapped_column(String(200))
    equipment_year:     Mapped[int | None]   = mapped_column(Integer)
    equipment_age_years:Mapped[float | None] = mapped_column(Float)   # Derived from equipment_year
    equipment_mileage:  Mapped[int | None]   = mapped_column(Integer)

    # Flags
    is_private_party: Mapped[bool] = mapped_column(Boolean, default=False)
    is_titled_asset:  Mapped[bool] = mapped_column(Boolean, default=False)

    application: Mapped["Application"] = relationship("Application", back_populates="loan_request")

# endregion