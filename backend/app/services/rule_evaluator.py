# ============================================================
# services/rule_evaluator.py — Single Rule Evaluator
#
# TABLE OF CONTENTS
#   1. EvaluationResult dataclass
#   2. OPTIONAL_FIELDS constant
#   3. evaluate_rule()   — main entry point
#   4. _build_required_description()  — helper
#
# DESIGN — Pure Logic, No DB:
#   This module has zero DB calls and zero side effects.
#   Input:  one PolicyRule + one application context dict
#   Output: EvaluationResult (passed, actual, required, explanation)
#
#   This makes it trivially unit-testable and safe to run
#   concurrently across many lenders without any shared state.
#
#   Extending the engine:
#     Adding a new operator = one new elif block in evaluate_rule().
#     No other file needs to change.
# ============================================================

from dataclasses import dataclass

from app.models.lender import PolicyRule, RuleOperator


# region ── 1. EvaluationResult ───────────────────────────────

@dataclass
class EvaluationResult:
    """Structured output from a single rule check."""
    passed:         bool
    actual_value:   str   # What the borrower had (stringified)
    required_value: str   # What the rule requires (human-readable)
    explanation:    str   # Full sentence for the UI breakdown

# endregion


# region ── 2. OPTIONAL_FIELDS ────────────────────────────────

# Fields where None means "not applicable — skip this rule"
# rather than "missing required data — fail the borrower".
#
# Rationale:
#   paynet_score:         Many small businesses have no PayNet score.
#                         Programs that need it will have it; others skip.
#   comparable_credit_pct:Not all lenders require it.
#   equipment_mileage:    Only relevant for vehicle/trucking programs.
#
# A program that genuinely requires one of these fields will still
# enforce it because the borrower will have provided the value.
OPTIONAL_FIELDS = {"paynet_score", "comparable_credit_pct", "equipment_mileage"}

# endregion


# region ── 3. evaluate_rule() ────────────────────────────────

def evaluate_rule(rule: PolicyRule, context: dict) -> EvaluationResult:
    """
    Evaluate a single PolicyRule against an application context dict.

    Args:
        rule:    The PolicyRule ORM object (or mock with same attributes).
        context: Flat dict of application fields, built by
                 matching_engine.build_application_context().

    Returns:
        EvaluationResult with pass/fail and human-readable explanation.
    """
    field    = rule.field
    operator = rule.operator
    label    = rule.label or field.replace("_", " ").title()

    actual       = context.get(field)
    required_desc = _build_required_description(rule)

    # ── Handle missing value ──────────────────────────────────
    if actual is None:
        if rule.value_boolean is not None:
            # Boolean fields are False when not provided (e.g. has_bankruptcy)
            actual = False
        elif field in OPTIONAL_FIELDS:
            return EvaluationResult(
                passed=True,
                actual_value="Not provided",
                required_value=required_desc,
                explanation=f"{label}: Not provided — skipped (optional field)",
            )
        else:
            return EvaluationResult(
                passed=False,
                actual_value="Not provided",
                required_value=required_desc,
                explanation=f"{label}: Value not provided",
            )

    actual_str = str(actual)

    # ── Evaluate by operator ──────────────────────────────────

    if operator == RuleOperator.GTE:
        passed = float(actual) >= rule.value_numeric
        explanation = (
            f"{label}: ✓ {actual} meets minimum of {rule.value_numeric}"
            if passed else
            f"{label}: ✗ {actual} is below minimum required {rule.value_numeric}"
        )

    elif operator == RuleOperator.LTE:
        passed = float(actual) <= rule.value_numeric
        explanation = (
            f"{label}: ✓ {actual} is within maximum of {rule.value_numeric}"
            if passed else
            f"{label}: ✗ {actual} exceeds maximum of {rule.value_numeric}"
        )

    elif operator == RuleOperator.GT:
        passed = float(actual) > rule.value_numeric
        explanation = (
            f"{label}: ✓ {actual} exceeds {rule.value_numeric}"
            if passed else
            f"{label}: ✗ {actual} must be greater than {rule.value_numeric}"
        )

    elif operator == RuleOperator.LT:
        passed = float(actual) < rule.value_numeric
        explanation = (
            f"{label}: ✓ {actual} is below {rule.value_numeric}"
            if passed else
            f"{label}: ✗ {actual} must be less than {rule.value_numeric}"
        )

    elif operator == RuleOperator.EQ:
        target = rule.value_boolean if rule.value_boolean is not None else rule.value_text
        passed = str(actual).lower() == str(target).lower()
        explanation = (
            f"{label}: ✓ Value matches required '{target}'"
            if passed else
            f"{label}: ✗ Value is '{actual}', required '{target}'"
        )

    elif operator == RuleOperator.NEQ:
        target = rule.value_boolean if rule.value_boolean is not None else rule.value_text
        passed = str(actual).lower() != str(target).lower()
        explanation = (
            f"{label}: ✓ Value is not '{target}'"
            if passed else
            f"{label}: ✗ Value '{actual}' is not allowed"
        )

    elif operator == RuleOperator.IN:
        allowed = [v.strip().upper() for v in (rule.value_list or "").split(",")]
        passed  = str(actual).upper() in allowed
        explanation = (
            f"{label}: ✓ '{actual}' is an eligible value"
            if passed else
            f"{label}: ✗ '{actual}' is not in allowed values: {', '.join(allowed)}"
        )

    elif operator == RuleOperator.NOT_IN:
        excluded = [v.strip().upper() for v in (rule.value_list or "").split(",")]
        passed   = str(actual).upper() not in excluded
        explanation = (
            f"{label}: ✓ '{actual}' is not in excluded list"
            if passed else
            f"{label}: ✗ '{actual}' is excluded. Excluded values: {', '.join(excluded)}"
        )

    elif operator == RuleOperator.BETWEEN:
        val    = float(actual)
        passed = rule.value_numeric <= val <= rule.value_numeric_max
        explanation = (
            f"{label}: ✓ {actual} is within range {rule.value_numeric}–{rule.value_numeric_max}"
            if passed else
            f"{label}: ✗ {actual} is outside required range {rule.value_numeric}–{rule.value_numeric_max}"
        )

    else:
        passed      = False
        explanation = f"{label}: Unknown operator '{operator}'"

    return EvaluationResult(
        passed=passed,
        actual_value=actual_str,
        required_value=required_desc,
        explanation=explanation,
    )

# endregion


# region ── 4. _build_required_description() ──────────────────

def _build_required_description(rule: PolicyRule) -> str:
    """Build a short human-readable string of what the rule requires."""
    op = rule.operator
    if op == RuleOperator.GTE:     return f">= {rule.value_numeric}"
    if op == RuleOperator.LTE:     return f"<= {rule.value_numeric}"
    if op == RuleOperator.GT:      return f"> {rule.value_numeric}"
    if op == RuleOperator.LT:      return f"< {rule.value_numeric}"
    if op == RuleOperator.BETWEEN: return f"{rule.value_numeric} – {rule.value_numeric_max}"
    if op in (RuleOperator.EQ, RuleOperator.NEQ):
        val = rule.value_boolean if rule.value_boolean is not None else rule.value_text
        return f"{'=' if op == RuleOperator.EQ else '!='} {val}"
    if op == RuleOperator.IN:      return f"One of: {rule.value_list}"
    if op == RuleOperator.NOT_IN:  return f"Not in: {rule.value_list}"
    return "See policy"

# endregion