# ============================================================
# LENDER MODELS
# Lender → LenderProgram → PolicyRule
#
# Design: Rules are stored as data rows (field/operator/value),
# NOT hardcoded Python logic. This means adding/editing a lender
# = inserting/updating rows, zero code changes needed.
# ============================================================

import enum
from datetime import datetime

from sqlalchemy import (Boolean, DateTime, Enum, Float, ForeignKey,
                        Integer, String, Text)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# ------------------------------------
# Enums
# ------------------------------------

class RuleOperator(str, enum.Enum):
    GTE = "gte"           # >=
    LTE = "lte"           # <=
    GT = "gt"             # >
    LT = "lt"             # <
    EQ = "eq"             # ==
    NEQ = "neq"           # !=
    IN = "in"             # value in list
    NOT_IN = "not_in"     # value not in list
    BETWEEN = "between"   # min <= value <= max


class RuleType(str, enum.Enum):
    HARD = "hard"         # Instant disqualifier if fails
    SOFT = "soft"         # Reduces fit score if fails, but doesn't disqualify


class RuleField(str, enum.Enum):
    # Borrower / Credit
    FICO_SCORE = "fico_score"
    PAYNET_SCORE = "paynet_score"
    # Business
    TIME_IN_BUSINESS_YEARS = "time_in_business_years"
    ANNUAL_REVENUE = "annual_revenue"
    BUSINESS_STATE = "business_state"
    INDUSTRY = "industry"
    IS_STARTUP = "is_startup"
    # Loan
    LOAN_AMOUNT = "loan_amount"
    LOAN_TERM_MONTHS = "loan_term_months"
    # Equipment
    EQUIPMENT_TYPE = "equipment_type"
    EQUIPMENT_AGE_YEARS = "equipment_age_years"
    EQUIPMENT_MILEAGE = "equipment_mileage"
    # Derogatory flags
    HAS_BANKRUPTCY = "has_bankruptcy"
    YEARS_SINCE_BANKRUPTCY = "years_since_bankruptcy"
    HAS_JUDGEMENT = "has_judgement"
    HAS_FORECLOSURE = "has_foreclosure"
    HAS_REPOSSESSION = "has_repossession"
    HAS_TAX_LIEN = "has_tax_lien"
    HAS_COLLECTIONS_LAST_3Y = "has_collections_last_3y"
    # Personal
    IS_US_CITIZEN = "is_us_citizen"
    REVOLVING_DEBT = "revolving_debt"
    REVOLVING_PLUS_UNSECURED_DEBT = "revolving_plus_unsecured_debt"
    # Comparable credit
    COMPARABLE_CREDIT_PCT = "comparable_credit_pct"
    # Homeownership
    IS_HOMEOWNER = "is_homeowner"


# ------------------------------------
# Lender — top-level entity
# ------------------------------------
class Lender(Base):
    __tablename__ = "lenders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    contact_name: Mapped[str | None] = mapped_column(String(200))
    contact_email: Mapped[str | None] = mapped_column(String(200))
    contact_phone: Mapped[str | None] = mapped_column(String(50))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    programs: Mapped[list["LenderProgram"]] = relationship("LenderProgram", back_populates="lender", cascade="all, delete-orphan")


# ------------------------------------
# LenderProgram — a lender can have multiple tiers/programs
# e.g. Apex has: A+, A, B, C, Medical-A, Medical-B, Corp Only
# ------------------------------------
class LenderProgram(Base):
    __tablename__ = "lender_programs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    lender_id: Mapped[int] = mapped_column(ForeignKey("lenders.id"), nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)   # e.g. "Tier 1", "A Rate", "Medical B"
    description: Mapped[str | None] = mapped_column(Text)
    priority: Mapped[int] = mapped_column(Integer, default=1)        # Lower = better program (tried first)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    # Rate info
    min_rate: Mapped[float | None] = mapped_column(Float)
    max_rate: Mapped[float | None] = mapped_column(Float)

    lender: Mapped["Lender"] = relationship("Lender", back_populates="programs")
    rules: Mapped[list["PolicyRule"]] = relationship("PolicyRule", back_populates="program", cascade="all, delete-orphan")


# ------------------------------------
# PolicyRule — ONE check within a program.
# This is the extensibility core of the system.
#
# Example row:
#   field=fico_score, operator=gte, value_numeric=700, rule_type=hard
#   => "FICO score must be >= 700, instant reject if not"
#
# Example row (list):
#   field=business_state, operator=not_in, value_list="CA,NV,ND,VT", rule_type=hard
#   => "State must NOT be in [CA, NV, ND, VT]"
# ------------------------------------
class PolicyRule(Base):
    __tablename__ = "policy_rules"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    program_id: Mapped[int] = mapped_column(ForeignKey("lender_programs.id"), nullable=False)

    field: Mapped[str] = mapped_column(String(100), nullable=False)       # RuleField enum value
    operator: Mapped[str] = mapped_column(String(20), nullable=False)     # RuleOperator enum value
    rule_type: Mapped[str] = mapped_column(String(10), nullable=False, default=RuleType.HARD)

    # Value storage — only one of these is set per rule
    value_numeric: Mapped[float | None] = mapped_column(Float)            # For gte/lte/eq/between-min
    value_numeric_max: Mapped[float | None] = mapped_column(Float)        # For between-max
    value_text: Mapped[str | None] = mapped_column(String(500))           # For eq/neq on strings
    value_list: Mapped[str | None] = mapped_column(Text)                  # Comma-separated for in/not_in
    value_boolean: Mapped[bool | None] = mapped_column(Boolean)           # For boolean fields

    label: Mapped[str | None] = mapped_column(String(300))                # Human-readable: "Min FICO Score"
    description: Mapped[str | None] = mapped_column(Text)                 # Extra context

    # How much this rule affects the fit score if it's a soft rule
    score_weight: Mapped[float] = mapped_column(Float, default=10.0)

    program: Mapped["LenderProgram"] = relationship("LenderProgram", back_populates="rules")
