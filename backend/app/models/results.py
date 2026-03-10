# ============================================================
# models/results.py — Underwriting Result ORM Models
#
# TABLE OF CONTENTS
#   1. MatchStatus Enum
#   2. MatchResult      (one per lender per underwriting run)
#   3. RuleEvaluationResult  (one per rule checked)
#
# DESIGN:
#   Each underwriting run produces one MatchResult per lender,
#   plus one RuleEvaluationResult per rule that was evaluated.
#   Re-running an application deletes and recreates all results.
#
#   MatchResult
#     └── RuleEvaluationResult  (one per PolicyRule evaluated)
# ============================================================

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


# region ── 1. MatchStatus Enum ───────────────────────────────

class MatchStatus(str, enum.Enum):
    ELIGIBLE   = "eligible"    # Borrower meets all hard rules for at least one program
    INELIGIBLE = "ineligible"  # Borrower fails at least one hard rule in every program
    PENDING    = "pending"     # Result created but not yet evaluated (intermediate state)

# endregion


# region ── 2. MatchResult ────────────────────────────────────

class MatchResult(Base):
    """
    The outcome of evaluating one lender against one application.

    - status:    eligible or ineligible
    - fit_score: 0–100, reflects how well the borrower exceeds minimums
                 and how many soft rules were satisfied
    - program:   the best matching program (or closest attempt if ineligible)
    - summary:   one-line human-readable explanation shown in the UI
    """
    __tablename__ = "match_results"

    id:             Mapped[int]        = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int]        = mapped_column(ForeignKey("applications.id"), nullable=False)
    lender_id:      Mapped[int]        = mapped_column(ForeignKey("lenders.id"),      nullable=False)
    program_id:     Mapped[int | None] = mapped_column(ForeignKey("lender_programs.id"))

    status:     Mapped[str]        = mapped_column(String(20), default=MatchStatus.PENDING)
    fit_score:  Mapped[float]      = mapped_column(Float, default=0.0)
    summary:    Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime]   = mapped_column(DateTime, default=datetime.utcnow)

    application:  Mapped["Application"]              = relationship("Application",  back_populates="match_results")
    lender:       Mapped["Lender"]                   = relationship("Lender")
    program:      Mapped["LenderProgram"]            = relationship("LenderProgram")
    rule_results: Mapped[list["RuleEvaluationResult"]] = relationship(
        "RuleEvaluationResult",
        back_populates="match_result",
        cascade="all, delete-orphan",
    )

# endregion


# region ── 3. RuleEvaluationResult ───────────────────────────

class RuleEvaluationResult(Base):
    """
    The outcome of evaluating one PolicyRule within a MatchResult.

    - passed:         True if the rule was satisfied
    - actual_value:   what the borrower's application had (as string)
    - required_value: what the rule required (human-readable)
    - explanation:    full sentence shown in the UI rule-by-rule breakdown
    """
    __tablename__ = "rule_evaluation_results"

    id:              Mapped[int]        = mapped_column(Integer, primary_key=True)
    match_result_id: Mapped[int]        = mapped_column(ForeignKey("match_results.id"), nullable=False)
    rule_id:         Mapped[int]        = mapped_column(ForeignKey("policy_rules.id"),  nullable=False)

    passed:          Mapped[bool]       = mapped_column(Boolean, nullable=False)
    actual_value:    Mapped[str | None] = mapped_column(String(300))
    required_value:  Mapped[str | None] = mapped_column(String(300))
    explanation:     Mapped[str | None] = mapped_column(Text)

    match_result: Mapped["MatchResult"] = relationship("MatchResult", back_populates="rule_results")
    rule:         Mapped["PolicyRule"]  = relationship("PolicyRule")

# endregion