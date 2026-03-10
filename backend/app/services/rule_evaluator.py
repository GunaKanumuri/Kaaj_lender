# ============================================================
# RULE EVALUATOR
# Given one PolicyRule + one ApplicationContext, returns pass/fail + explanation.
#
# This is pure logic — no DB calls, easily unit-tested.
# Adding a new operator = add one elif block here, nothing else changes.
#
# FIX: Added OPTIONAL_FIELDS set. paynet_score, comparable_credit_pct, and
#      equipment_mileage are genuinely optional — a missing value means
#      "not provided" (skip), not a hard fail. This lets borrowers without
#      PayNet fall through to programs that don't require it.
# ============================================================

from dataclasses import dataclass
from app.models.lender import PolicyRule, RuleOperator


@dataclass
class EvaluationResult:
    passed: bool
    actual_value: str
    required_value: str
    explanation: str


# Fields where None means "not applicable — skip this rule"
# rather than "missing required data — hard fail".
# Rule programs that genuinely require these fields will still enforce them
# because the borrower will have provided the value.
OPTIONAL_FIELDS = {"paynet_score", "comparable_credit_pct", "equipment_mileage"}


def evaluate_rule(rule: PolicyRule, context: dict) -> EvaluationResult:
    """
    Evaluate a single PolicyRule against an application context dict.
    Returns structured result with pass/fail and human-readable explanation.
    """
    field = rule.field
    operator = rule.operator
    label = rule.label or field.replace("_", " ").title()

    actual = context.get(field)
    required_desc = _build_required_description(rule)

    # Handle missing value
    if actual is None:
        if rule.value_boolean is not None:
            # Boolean fields default to False when missing
            actual = False
        elif field in OPTIONAL_FIELDS:
            # Optional numeric field — skip rule, do not penalise borrower
            return EvaluationResult(
                passed=True,
                actual_value="Not provided",
                required_value=required_desc,
                explanation=f"{label}: Not provided — skipped (optional field)"
            )
        else:
            return EvaluationResult(
                passed=False,
                actual_value="Not provided",
                required_value=required_desc,
                explanation=f"{label}: Value not provided"
            )

    actual_str = str(actual)

    # ---- Evaluate by operator ----

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
            f"{label}: ✓ Value matches required {target}"
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
        passed = str(actual).upper() in allowed
        explanation = (
            f"{label}: ✓ '{actual}' is an eligible value"
            if passed else
            f"{label}: ✗ '{actual}' is not in allowed values: {', '.join(allowed)}"
        )

    elif operator == RuleOperator.NOT_IN:
        excluded = [v.strip().upper() for v in (rule.value_list or "").split(",")]
        passed = str(actual).upper() not in excluded
        explanation = (
            f"{label}: ✓ '{actual}' is not in excluded list"
            if passed else
            f"{label}: ✗ '{actual}' is excluded. Excluded values: {', '.join(excluded)}"
        )

    elif operator == RuleOperator.BETWEEN:
        val = float(actual)
        passed = rule.value_numeric <= val <= rule.value_numeric_max
        explanation = (
            f"{label}: ✓ {actual} is within range {rule.value_numeric}–{rule.value_numeric_max}"
            if passed else
            f"{label}: ✗ {actual} is outside required range {rule.value_numeric}–{rule.value_numeric_max}"
        )

    else:
        passed = False
        explanation = f"{label}: Unknown operator '{operator}'"

    return EvaluationResult(
        passed=passed,
        actual_value=actual_str,
        required_value=required_desc,
        explanation=explanation
    )


def _build_required_description(rule: PolicyRule) -> str:
    """Build a human-readable description of what the rule requires."""
    op = rule.operator
    if op == RuleOperator.GTE:
        return f">= {rule.value_numeric}"
    elif op == RuleOperator.LTE:
        return f"<= {rule.value_numeric}"
    elif op == RuleOperator.GT:
        return f"> {rule.value_numeric}"
    elif op == RuleOperator.LT:
        return f"< {rule.value_numeric}"
    elif op == RuleOperator.BETWEEN:
        return f"{rule.value_numeric} – {rule.value_numeric_max}"
    elif op in (RuleOperator.EQ, RuleOperator.NEQ):
        val = rule.value_boolean if rule.value_boolean is not None else rule.value_text
        return f"{'=' if op == RuleOperator.EQ else '!='} {val}"
    elif op == RuleOperator.IN:
        return f"One of: {rule.value_list}"
    elif op == RuleOperator.NOT_IN:
        return f"Not in: {rule.value_list}"
    return "See policy"