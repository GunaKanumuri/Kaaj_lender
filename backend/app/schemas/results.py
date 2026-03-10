# ============================================================
# schemas/results.py — Underwriting Result Pydantic Schemas
#
# TABLE OF CONTENTS
#   1. RuleEvaluationResultOut  — one rule's pass/fail detail
#   2. MatchResultOut           — one lender's full result
#   3. UnderwritingRunResponse  — top-level API response
#
# DESIGN:
#   These schemas are response-only (no Create/Update variants).
#   They are populated by the service layer in api/underwriting.py,
#   not directly from ORM objects — the "rule" dict and lender_name
#   fields are injected manually since they cross model boundaries.
#
#   Data flow:
#     run_underwriting() → MatchResult ORM objects
#       → _serialize_results() → MatchResultOut schemas
#         → UnderwritingRunResponse
# ============================================================

from datetime import datetime
from pydantic import BaseModel


# region ── 1. RuleEvaluationResultOut ────────────────────────

class RuleEvaluationResultOut(BaseModel):
    """
    The result of evaluating one PolicyRule against the application.

    - passed:         True if the borrower satisfies this rule
    - actual_value:   What the borrower had (stringified for display)
    - required_value: What the rule required (e.g. ">= 700")
    - explanation:    Full human-readable sentence shown in the UI breakdown
    - rule:           Flattened rule metadata (id, field, operator, label, rule_type)
                      Injected by the serializer — not a direct ORM relationship.
    """
    id:             int
    rule_id:        int
    passed:         bool
    actual_value:   str | None
    required_value: str | None
    explanation:    str | None
    rule:           dict | None = None  # {id, field, operator, label, rule_type}

    class Config:
        from_attributes = True

# endregion


# region ── 2. MatchResultOut ─────────────────────────────────

class MatchResultOut(BaseModel):
    """
    The complete result of evaluating one lender against one application.

    - status:       "eligible" or "ineligible"
    - fit_score:    0–100, higher = better match
    - program_name: The best matching program (or closest attempt if ineligible)
    - summary:      One-line explanation for the UI card header
    - rule_results: Full rule-by-rule breakdown
    """
    id:             int
    application_id: int
    lender_id:      int
    program_id:     int | None
    status:         str
    fit_score:      float
    summary:        str | None
    created_at:     datetime
    lender_name:    str | None = None   # Denormalized for UI — avoids extra join
    program_name:   str | None = None   # Denormalized for UI
    rule_results:   list[RuleEvaluationResultOut] = []

    class Config:
        from_attributes = True

# endregion


# region ── 3. UnderwritingRunResponse ────────────────────────

class UnderwritingRunResponse(BaseModel):
    """
    Top-level response returned by both POST /run/{id} and GET /results/{id}.

    Results are sorted by the serializer: eligible first, then by fit_score desc.
    The UI uses eligible_count / ineligible_count for the summary stats cards.
    """
    application_id:        int
    status:                str    # Always "completed" for now
    total_lenders_checked: int
    eligible_count:        int
    ineligible_count:      int
    results:               list[MatchResultOut]

# endregion