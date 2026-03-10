# ============================================================
# MATCH RESULT MODELS
# MatchResult → RuleEvaluationResult (one per rule checked)
# ============================================================

import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base


class MatchStatus(str, enum.Enum):
    ELIGIBLE = "eligible"
    INELIGIBLE = "ineligible"
    PENDING = "pending"


class MatchResult(Base):
    __tablename__ = "match_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    application_id: Mapped[int] = mapped_column(ForeignKey("applications.id"), nullable=False)
    lender_id: Mapped[int] = mapped_column(ForeignKey("lenders.id"), nullable=False)
    program_id: Mapped[int | None] = mapped_column(ForeignKey("lender_programs.id"))

    status: Mapped[str] = mapped_column(String(20), default=MatchStatus.PENDING)
    fit_score: Mapped[float] = mapped_column(Float, default=0.0)
    summary: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    application: Mapped["Application"] = relationship("Application", back_populates="match_results")
    lender: Mapped["Lender"] = relationship("Lender")
    program: Mapped["LenderProgram"] = relationship("LenderProgram")
    rule_results: Mapped[list["RuleEvaluationResult"]] = relationship(
        "RuleEvaluationResult", back_populates="match_result", cascade="all, delete-orphan"
    )


class RuleEvaluationResult(Base):
    __tablename__ = "rule_evaluation_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    match_result_id: Mapped[int] = mapped_column(ForeignKey("match_results.id"), nullable=False)
    rule_id: Mapped[int] = mapped_column(ForeignKey("policy_rules.id"), nullable=False)

    passed: Mapped[bool] = mapped_column(Boolean, nullable=False)
    actual_value: Mapped[str | None] = mapped_column(String(300))
    required_value: Mapped[str | None] = mapped_column(String(300))
    explanation: Mapped[str | None] = mapped_column(Text)

    match_result: Mapped["MatchResult"] = relationship("MatchResult", back_populates="rule_results")
    rule: Mapped["PolicyRule"] = relationship("PolicyRule")
