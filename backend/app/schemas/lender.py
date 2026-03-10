# ============================================================
# schemas/lender.py — Lender Pydantic Schemas
#
# TABLE OF CONTENTS
#   1. PolicyRuleBase / PolicyRuleCreate / PolicyRuleUpdate / PolicyRuleOut
#   2. LenderProgramBase / LenderProgramCreate / LenderProgramUpdate / LenderProgramOut
#   3. LenderBase / LenderCreate / LenderUpdate / LenderOut / LenderSummary
#
# DESIGN — Base → Create → Update → Out pattern:
#   Base    : shared fields (no id, no server-only fields)
#   Create  : used for POST input — may include nested children
#   Update  : used for PUT input — same as Base (all fields optional in practice)
#   Out     : used for GET responses — adds id + any server-generated fields
#   Summary : lightweight list view (no nested children)
# ============================================================

from pydantic import BaseModel


# region ── 1. PolicyRule Schemas ─────────────────────────────

class PolicyRuleBase(BaseModel):
    field:             str              # Maps to RuleField enum in models/lender.py
    operator:          str              # Maps to RuleOperator enum (gte, lte, eq, in, not_in, between ...)
    rule_type:         str  = "hard"   # "hard" = disqualifier, "soft" = score penalty only
    value_numeric:     float | None = None   # For gte / lte / gt / lt / between-min
    value_numeric_max: float | None = None   # For between-max
    value_text:        str | None   = None   # For eq / neq on string fields
    value_list:        str | None   = None   # Comma-separated for in / not_in  e.g. "CA,NV,TX"
    value_boolean:     bool | None  = None   # For eq / neq on boolean fields
    label:             str | None   = None   # Human-readable label shown in the UI
    description:       str | None   = None   # Optional extra context
    score_weight:      float        = 10.0   # Impact on fit score when soft rule fails


class PolicyRuleCreate(PolicyRuleBase):
    """Used when adding a rule via POST /programs/{id}/rules."""
    pass


class PolicyRuleUpdate(PolicyRuleBase):
    """Used when editing a rule via PUT /rules/{id}."""
    pass


class PolicyRuleOut(PolicyRuleBase):
    """Returned by all rule endpoints."""
    id:         int
    program_id: int

    class Config:
        from_attributes = True

# endregion


# region ── 2. LenderProgram Schemas ──────────────────────────

class LenderProgramBase(BaseModel):
    name:        str
    description: str | None   = None
    priority:    int          = 1      # Lower = better tier, evaluated first
    is_active:   bool         = True
    min_rate:    float | None = None   # e.g. 7.25 (%)
    max_rate:    float | None = None   # e.g. 7.75 (%)


class LenderProgramCreate(LenderProgramBase):
    """Used when creating a program. Rules can be nested inline."""
    rules: list[PolicyRuleCreate] = []


class LenderProgramUpdate(LenderProgramBase):
    """Used when editing program-level fields (name, rate, priority, is_active)."""
    pass


class LenderProgramOut(LenderProgramBase):
    """Returned by all program endpoints — includes all rules."""
    id:        int
    lender_id: int
    rules:     list[PolicyRuleOut] = []

    class Config:
        from_attributes = True

# endregion


# region ── 3. Lender Schemas ─────────────────────────────────

class LenderBase(BaseModel):
    name:          str
    description:   str | None = None
    is_active:     bool       = True
    contact_name:  str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None


class LenderCreate(LenderBase):
    """Used when creating a lender. Programs (with rules) can be nested inline."""
    programs: list[LenderProgramCreate] = []


class LenderUpdate(LenderBase):
    """Used when editing lender-level fields (name, contacts, is_active)."""
    pass


class LenderOut(LenderBase):
    """Full lender response — includes all programs and their rules."""
    id:       int
    programs: list[LenderProgramOut] = []

    class Config:
        from_attributes = True


class LenderSummary(LenderBase):
    """Lightweight view for list endpoints — no nested programs."""
    id:            int
    program_count: int = 0

    class Config:
        from_attributes = True

# endregion