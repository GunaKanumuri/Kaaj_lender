# ============================================================
# LENDER SCHEMAS — Pydantic models for API request/response
# ============================================================

from pydantic import BaseModel, Field


# ------------------------------------
# PolicyRule schemas
# ------------------------------------

class PolicyRuleBase(BaseModel):
    field: str
    operator: str
    rule_type: str = "hard"
    value_numeric: float | None = None
    value_numeric_max: float | None = None
    value_text: str | None = None
    value_list: str | None = None
    value_boolean: bool | None = None
    label: str | None = None
    description: str | None = None
    score_weight: float = 10.0


class PolicyRuleCreate(PolicyRuleBase):
    pass


class PolicyRuleUpdate(PolicyRuleBase):
    pass


class PolicyRuleOut(PolicyRuleBase):
    id: int
    program_id: int

    class Config:
        from_attributes = True


# ------------------------------------
# LenderProgram schemas
# ------------------------------------

class LenderProgramBase(BaseModel):
    name: str
    description: str | None = None
    priority: int = 1
    is_active: bool = True
    min_rate: float | None = None
    max_rate: float | None = None


class LenderProgramCreate(LenderProgramBase):
    rules: list[PolicyRuleCreate] = []


class LenderProgramUpdate(LenderProgramBase):
    pass


class LenderProgramOut(LenderProgramBase):
    id: int
    lender_id: int
    rules: list[PolicyRuleOut] = []

    class Config:
        from_attributes = True


# ------------------------------------
# Lender schemas
# ------------------------------------

class LenderBase(BaseModel):
    name: str
    description: str | None = None
    is_active: bool = True
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None


class LenderCreate(LenderBase):
    programs: list[LenderProgramCreate] = []


class LenderUpdate(LenderBase):
    pass


class LenderOut(LenderBase):
    id: int
    programs: list[LenderProgramOut] = []

    class Config:
        from_attributes = True


class LenderSummary(LenderBase):
    id: int
    program_count: int = 0

    class Config:
        from_attributes = True
