# ============================================================
# models/lender.py — Lender ORM Models
#
# TABLE OF CONTENTS
#   1. Enums  (RuleOperator, RuleType, RuleField)
#   2. Lender
#   3. LenderProgram
#   4. PolicyRule
#
# DESIGN — Data-Driven Rule Engine:
#   Rules are stored as DB rows (field / operator / value),
#   NOT hardcoded Python logic. Adding or editing a lender
#   means inserting/updating rows — zero code changes needed.
#
#   Hierarchy:
#     Lender
#       └── LenderProgram  (e.g. "A Rate", "Medical B", "Tier 1")
#             └── PolicyRule  (e.g. fico_score >= 700)
# ============================================================

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# region ── 1. Enums ──────────────────────────────────────────

class RuleOperator(str, enum.Enum):
    """Comparison operators supported by the rule evaluator."""
    GTE     = "gte"      # >=
    LTE     = "lte"      # <=
    GT      = "gt"       # >
    LT      = "lt"       # <
    EQ      = "eq"       # ==
    NEQ     = "neq"      # !=
    IN      = "in"       # value in allowed list
    NOT_IN  = "not_in"   # value not in excluded list
    BETWEEN = "between"  # min <= value <= max


class RuleType(str, enum.Enum):
    """How a failed rule affects the eligibility decision."""
    HARD = "hard"  # Instant disqualifier — borrower cannot proceed
    SOFT = "soft"  # Score penalty only — borrower still eligible


class RuleField(str, enum.Enum):
    """
    All application fields that can be referenced in a PolicyRule.
    Maps directly to keys in the application context dict built by
    matching_engine.build_application_context().
    """
    # ── Credit scores ───────────────────────────────
    FICO_SCORE                  = "fico_score"
    PAYNET_SCORE                = "paynet_score"

    # ── Business info ───────────────────────────────
    TIME_IN_BUSINESS_YEARS      = "time_in_business_years"
    ANNUAL_REVENUE              = "annual_revenue"
    BUSINESS_STATE              = "business_state"
    INDUSTRY                    = "industry"
    IS_STARTUP                  = "is_startup"

    # ── Loan request ────────────────────────────────
    LOAN_AMOUNT                 = "loan_amount"
    LOAN_TERM_MONTHS            = "loan_term_months"

    # ── Equipment ───────────────────────────────────
    EQUIPMENT_TYPE              = "equipment_type"
    EQUIPMENT_AGE_YEARS         = "equipment_age_years"
    EQUIPMENT_MILEAGE           = "equipment_mileage"

    # ── Derogatory flags ────────────────────────────
    HAS_BANKRUPTCY              = "has_bankruptcy"
    YEARS_SINCE_BANKRUPTCY      = "years_since_bankruptcy"
    HAS_JUDGEMENT               = "has_judgement"
    HAS_FORECLOSURE             = "has_foreclosure"
    HAS_REPOSSESSION            = "has_repossession"
    HAS_TAX_LIEN                = "has_tax_lien"
    HAS_COLLECTIONS_LAST_3Y     = "has_collections_last_3y"

    # ── Personal guarantor ───────────────────────────
    IS_US_CITIZEN               = "is_us_citizen"
    IS_HOMEOWNER                = "is_homeowner"
    YEARS_AT_RESIDENCE          = "years_at_residence"
    REVOLVING_DEBT              = "revolving_debt"
    REVOLVING_PLUS_UNSECURED_DEBT = "revolving_plus_unsecured_debt"
    COMPARABLE_CREDIT_PCT       = "comparable_credit_pct"

# endregion


# region ── 2. Lender ─────────────────────────────────────────

class Lender(Base):
    """
    Top-level lender entity.
    A lender has one or more LenderPrograms, each with their own PolicyRules.
    """
    __tablename__ = "lenders"

    id:            Mapped[int]      = mapped_column(Integer, primary_key=True)
    name:          Mapped[str]      = mapped_column(String(200), nullable=False, unique=True)
    description:   Mapped[str | None] = mapped_column(Text)
    is_active:     Mapped[bool]     = mapped_column(Boolean, default=True)
    contact_name:  Mapped[str | None] = mapped_column(String(200))
    contact_email: Mapped[str | None] = mapped_column(String(200))
    contact_phone: Mapped[str | None] = mapped_column(String(50))
    created_at:    Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at:    Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    programs: Mapped[list["LenderProgram"]] = relationship(
        "LenderProgram",
        back_populates="lender",
        cascade="all, delete-orphan",
        order_by="LenderProgram.priority",
    )

# endregion


# region ── 3. LenderProgram ──────────────────────────────────

class LenderProgram(Base):
    """
    A named credit tier or program under a lender.
    Examples: "A+ Rate", "Medical B", "Corp Only Tier 1", "Startup Program".

    Programs are evaluated in ascending priority order — lower number = better
    deal for the borrower. The matching engine picks the first eligible program.
    """
    __tablename__ = "lender_programs"

    id:          Mapped[int]        = mapped_column(Integer, primary_key=True)
    lender_id:   Mapped[int]        = mapped_column(ForeignKey("lenders.id"), nullable=False)
    name:        Mapped[str]        = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    priority:    Mapped[int]        = mapped_column(Integer, default=1)
    is_active:   Mapped[bool]       = mapped_column(Boolean, default=True)
    min_rate:    Mapped[float | None] = mapped_column(Float)
    max_rate:    Mapped[float | None] = mapped_column(Float)

    lender: Mapped["Lender"] = relationship("Lender", back_populates="programs")
    rules:  Mapped[list["PolicyRule"]] = relationship(
        "PolicyRule",
        back_populates="program",
        cascade="all, delete-orphan",
    )

# endregion


# region ── 4. PolicyRule ─────────────────────────────────────

class PolicyRule(Base):
    """
    A single eligibility check within a LenderProgram.

    Only one value column is set per rule:
      - value_numeric      → for gte / lte / gt / lt / between-min
      - value_numeric_max  → for between-max
      - value_text         → for eq / neq on string fields
      - value_list         → comma-separated string for in / not_in
      - value_boolean      → for eq / neq on boolean fields

    Examples:
      field=fico_score,    operator=gte,     value_numeric=700   → FICO >= 700
      field=business_state,operator=not_in,  value_list="CA,NV"  → State not CA or NV
      field=has_bankruptcy,operator=eq,      value_boolean=False → No bankruptcy
      field=loan_amount,   operator=between, value_numeric=10000,
                                             value_numeric_max=75000
    """
    __tablename__ = "policy_rules"

    id:               Mapped[int]        = mapped_column(Integer, primary_key=True)
    program_id:       Mapped[int]        = mapped_column(ForeignKey("lender_programs.id"), nullable=False)

    # What to check and how
    field:            Mapped[str]        = mapped_column(String(100), nullable=False)
    operator:         Mapped[str]        = mapped_column(String(20),  nullable=False)
    rule_type:        Mapped[str]        = mapped_column(String(10),  nullable=False, default=RuleType.HARD)

    # Value storage — only one is populated per rule
    value_numeric:    Mapped[float | None] = mapped_column(Float)
    value_numeric_max:Mapped[float | None] = mapped_column(Float)
    value_text:       Mapped[str | None]   = mapped_column(String(500))
    value_list:       Mapped[str | None]   = mapped_column(Text)
    value_boolean:    Mapped[bool | None]  = mapped_column(Boolean)

    # Display
    label:            Mapped[str | None]   = mapped_column(String(300))
    description:      Mapped[str | None]   = mapped_column(Text)

    # Score impact for soft rules (higher = more important preference)
    score_weight:     Mapped[float]        = mapped_column(Float, default=10.0)

    program: Mapped["LenderProgram"] = relationship("LenderProgram", back_populates="rules")

# endregion