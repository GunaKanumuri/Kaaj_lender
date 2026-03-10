# ============================================================
# schemas/application.py — Application Pydantic Schemas
#
# TABLE OF CONTENTS
#   1. BusinessCreate / BusinessOut
#   2. PersonalGuarantorCreate / PersonalGuarantorOut
#   3. LoanRequestCreate / LoanRequestOut
#   4. ApplicationCreate / ApplicationUpdate / ApplicationOut
#
# DESIGN:
#   Each section follows the Base → Create → Out pattern.
#   "Create" schemas are used for API input (POST/PUT).
#   "Out" schemas are used for API responses (GET).
#   "Out" schemas inherit "Create" and add server-generated fields (id, timestamps).
# ============================================================

from datetime import datetime
from pydantic import BaseModel, Field


# region ── 1. Business ───────────────────────────────────────

class BusinessCreate(BaseModel):
    business_name:     str
    business_type:     str | None   = None           # LLC, Corp, Sole Prop, Partnership
    industry:          str | None   = None
    state:             str | None   = Field(None, max_length=2)  # 2-letter state code
    years_in_business: float | None = None
    annual_revenue:    float | None = None
    is_startup:        bool         = False
    paynet_score:      int | None   = None           # Optional — not all businesses have one


class BusinessOut(BusinessCreate):
    id: int
    class Config:
        from_attributes = True

# endregion


# region ── 2. PersonalGuarantor ──────────────────────────────

class PersonalGuarantorCreate(BaseModel):
    # Identity
    first_name: str
    last_name:  str

    # Credit profile
    fico_score:         int | None   = None
    is_homeowner:       bool         = False
    is_us_citizen:      bool         = True
    years_at_residence: float | None = None

    # Derogatory flags — all default False (clean record)
    has_bankruptcy:          bool         = False
    years_since_bankruptcy:  float | None = None
    has_judgement:           bool         = False
    has_foreclosure:         bool         = False
    has_repossession:        bool         = False
    has_tax_lien:            bool         = False
    has_collections_last_3y: bool         = False

    # Debt load
    revolving_debt:                float | None = None
    revolving_plus_unsecured_debt: float | None = None
    comparable_credit_pct:         float | None = None  # % of loan covered by comparable credit


class PersonalGuarantorOut(PersonalGuarantorCreate):
    id: int
    class Config:
        from_attributes = True

# endregion


# region ── 3. LoanRequest ────────────────────────────────────

class LoanRequestCreate(BaseModel):
    # Loan terms
    amount:      float    = Field(..., gt=0)   # Required, must be positive
    term_months: int | None = None

    # Equipment details
    equipment_type:      str | None   = None
    equipment_year:      int | None   = None   # API layer auto-derives equipment_age_years from this
    equipment_age_years: float | None = None   # Can be provided directly; overrides year-based derivation
    equipment_mileage:   int | None   = None

    # Flags
    is_private_party: bool = False
    is_titled_asset:  bool = False


class LoanRequestOut(LoanRequestCreate):
    id: int
    class Config:
        from_attributes = True

# endregion


# region ── 4. Application ────────────────────────────────────

class ApplicationCreate(BaseModel):
    """Full application payload — business + guarantor + loan request in one request."""
    business:     BusinessCreate
    guarantor:    PersonalGuarantorCreate
    loan_request: LoanRequestCreate


class ApplicationUpdate(BaseModel):
    """Partial update — any section can be omitted."""
    business:     BusinessCreate | None     = None
    guarantor:    PersonalGuarantorCreate | None = None
    loan_request: LoanRequestCreate | None  = None


class ApplicationOut(BaseModel):
    """Full application response including server-generated fields."""
    id:           int
    status:       str
    created_at:   datetime
    updated_at:   datetime
    business:     BusinessOut | None     = None
    guarantor:    PersonalGuarantorOut | None = None
    loan_request: LoanRequestOut | None  = None

    class Config:
        from_attributes = True

# endregion