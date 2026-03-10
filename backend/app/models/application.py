# ============================================================
# APPLICATION MODELS
# Application → Business + Borrower + Guarantor + LoanRequest
# ============================================================

import enum
from datetime import datetime

from sqlalchemy import (Boolean, DateTime, Enum, Float, ForeignKey,
                        Integer, String, Text)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class ApplicationStatus(str, enum.Enum):
    DRAFT = "draft"
    SUBMITTED = "submitted"
    UNDER_REVIEW = "under_review"
    COMPLETED = "completed"
    FAILED = "failed"


# ------------------------------------
# Application — the parent wrapper
# ------------------------------------
class Application(Base):
    __tablename__ = "applications"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    status: Mapped[str] = mapped_column(String(30), default=ApplicationStatus.DRAFT)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    business: Mapped["Business"] = relationship("Business", back_populates="application", uselist=False, cascade="all, delete-orphan")
    guarantor: Mapped["PersonalGuarantor"] = relationship("PersonalGuarantor", back_populates="application", uselist=False, cascade="all, delete-orphan")
    loan_request: Mapped["LoanRequest"] = relationship("LoanRequest", back_populates="application", uselist=False, cascade="all, delete-orphan")
    match_results: Mapped[list["MatchResult"]] = relationship("MatchResult", back_populates="application", cascade="all, delete-orphan")


# ------------------------------------
# Business — the company applying
# ------------------------------------
class Business(Base):
    __tablename__ = "businesses"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), nullable=False)

    # Identity
    business_name: Mapped[str] = mapped_column(String(300), nullable=False)
    business_type: Mapped[str | None] = mapped_column(String(100))   # LLC, Corp, Sole Prop, etc.
    industry: Mapped[str | None] = mapped_column(String(200))
    state: Mapped[str | None] = mapped_column(String(2))             # 2-letter state code

    # Financials
    years_in_business: Mapped[float | None] = mapped_column(Float)   # stored as decimal years
    annual_revenue: Mapped[float | None] = mapped_column(Float)
    is_startup: Mapped[bool] = mapped_column(Boolean, default=False)

    # Business credit
    paynet_score: Mapped[int | None] = mapped_column(Integer)

    application: Mapped["Application"] = relationship("Application", back_populates="business")


# ------------------------------------
# PersonalGuarantor — the individual signing the PG
# ------------------------------------
class PersonalGuarantor(Base):
    __tablename__ = "personal_guarantors"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), nullable=False)

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)

    # Credit profile
    fico_score: Mapped[int | None] = mapped_column(Integer)
    is_homeowner: Mapped[bool] = mapped_column(Boolean, default=False)
    is_us_citizen: Mapped[bool] = mapped_column(Boolean, default=True)
    years_at_residence: Mapped[float | None] = mapped_column(Float)

    # Derogatory flags
    has_bankruptcy: Mapped[bool] = mapped_column(Boolean, default=False)
    years_since_bankruptcy: Mapped[float | None] = mapped_column(Float)
    has_judgement: Mapped[bool] = mapped_column(Boolean, default=False)
    has_foreclosure: Mapped[bool] = mapped_column(Boolean, default=False)
    has_repossession: Mapped[bool] = mapped_column(Boolean, default=False)
    has_tax_lien: Mapped[bool] = mapped_column(Boolean, default=False)
    has_collections_last_3y: Mapped[bool] = mapped_column(Boolean, default=False)

    # Debt profile
    revolving_debt: Mapped[float | None] = mapped_column(Float)
    revolving_plus_unsecured_debt: Mapped[float | None] = mapped_column(Float)
    comparable_credit_pct: Mapped[float | None] = mapped_column(Float)   # % of loan amount covered by comp credit

    application: Mapped["Application"] = relationship("Application", back_populates="guarantor")


# ------------------------------------
# LoanRequest — what they're asking for
# ------------------------------------
class LoanRequest(Base):
    __tablename__ = "loan_requests"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), nullable=False)

    # Loan details
    amount: Mapped[float] = mapped_column(Float, nullable=False)
    term_months: Mapped[int | None] = mapped_column(Integer)

    # Equipment
    equipment_type: Mapped[str | None] = mapped_column(String(200))
    equipment_year: Mapped[int | None] = mapped_column(Integer)
    equipment_age_years: Mapped[float | None] = mapped_column(Float)   # derived from year
    equipment_mileage: Mapped[int | None] = mapped_column(Integer)
    is_private_party: Mapped[bool] = mapped_column(Boolean, default=False)
    is_titled_asset: Mapped[bool] = mapped_column(Boolean, default=False)

    application: Mapped["Application"] = relationship("Application", back_populates="loan_request")
