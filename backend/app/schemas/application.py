# ============================================================
# APPLICATION SCHEMAS
# ============================================================

from datetime import datetime
from pydantic import BaseModel, Field


# ------------------------------------
# Business
# ------------------------------------

class BusinessCreate(BaseModel):
    business_name: str
    business_type: str | None = None
    industry: str | None = None
    state: str | None = Field(None, max_length=2)
    years_in_business: float | None = None
    annual_revenue: float | None = None
    is_startup: bool = False
    paynet_score: int | None = None


class BusinessOut(BusinessCreate):
    id: int
    class Config:
        from_attributes = True


# ------------------------------------
# Personal Guarantor
# ------------------------------------

class PersonalGuarantorCreate(BaseModel):
    first_name: str
    last_name: str
    fico_score: int | None = None
    is_homeowner: bool = False
    is_us_citizen: bool = True
    years_at_residence: float | None = None
    has_bankruptcy: bool = False
    years_since_bankruptcy: float | None = None
    has_judgement: bool = False
    has_foreclosure: bool = False
    has_repossession: bool = False
    has_tax_lien: bool = False
    has_collections_last_3y: bool = False
    revolving_debt: float | None = None
    revolving_plus_unsecured_debt: float | None = None
    comparable_credit_pct: float | None = None


class PersonalGuarantorOut(PersonalGuarantorCreate):
    id: int
    class Config:
        from_attributes = True


# ------------------------------------
# Loan Request
# ------------------------------------

class LoanRequestCreate(BaseModel):
    amount: float = Field(..., gt=0)
    term_months: int | None = None
    equipment_type: str | None = None
    equipment_year: int | None = None
    equipment_age_years: float | None = None
    equipment_mileage: int | None = None
    is_private_party: bool = False
    is_titled_asset: bool = False


class LoanRequestOut(LoanRequestCreate):
    id: int
    class Config:
        from_attributes = True


# ------------------------------------
# Application
# ------------------------------------

class ApplicationCreate(BaseModel):
    business: BusinessCreate
    guarantor: PersonalGuarantorCreate
    loan_request: LoanRequestCreate


class ApplicationUpdate(BaseModel):
    business: BusinessCreate | None = None
    guarantor: PersonalGuarantorCreate | None = None
    loan_request: LoanRequestCreate | None = None


class ApplicationOut(BaseModel):
    id: int
    status: str
    created_at: datetime
    updated_at: datetime
    business: BusinessOut | None = None
    guarantor: PersonalGuarantorOut | None = None
    loan_request: LoanRequestOut | None = None

    class Config:
        from_attributes = True
