# ============================================================
# RESULTS SCHEMAS
# ============================================================

from datetime import datetime
from pydantic import BaseModel
from app.schemas.lender import LenderOut, LenderProgramOut


class RuleEvaluationResultOut(BaseModel):
    id: int
    rule_id: int
    passed: bool
    actual_value: str | None
    required_value: str | None
    explanation: str | None
    rule: dict | None = None   # populated by service layer

    class Config:
        from_attributes = True


class MatchResultOut(BaseModel):
    id: int
    application_id: int
    lender_id: int
    program_id: int | None
    status: str
    fit_score: float
    summary: str | None
    created_at: datetime
    lender_name: str | None = None
    program_name: str | None = None
    rule_results: list[RuleEvaluationResultOut] = []

    class Config:
        from_attributes = True


class UnderwritingRunResponse(BaseModel):
    application_id: int
    status: str
    total_lenders_checked: int
    eligible_count: int
    ineligible_count: int
    results: list[MatchResultOut]
