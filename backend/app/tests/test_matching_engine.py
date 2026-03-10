# ============================================================
# TESTS — Matching Engine & Rule Evaluator
#
# ZERO app imports — completely avoids the DB import chain
# (no psycopg2, no pydantic-settings, no live Postgres needed).
#
# We replicate the minimal types needed from models/enums
# and import ONLY pure-logic functions from services.
# ============================================================

import pytest
import sys
from unittest.mock import MagicMock
from dataclasses import dataclass

# ─────────────────────────────────────────────────────────────
# MOCK the entire import chain so no DB connection is attempted.
# This must happen BEFORE any app.* imports.
# ─────────────────────────────────────────────────────────────

# Fake database module — prevents create_engine from running
_fake_database = MagicMock()

class _FakeBase:
    """Stand-in for SQLAlchemy DeclarativeBase."""
    metadata = MagicMock()

_fake_database.Base = _FakeBase

# Fake config module
_fake_config = MagicMock()
_fake_config.settings = MagicMock(
    DATABASE_URL="sqlite:///:memory:",
    APP_TITLE="Test",
    APP_VERSION="0.0.0",
    DEBUG=False,
)

# Inject fakes BEFORE any app.* import triggers the real chain
sys.modules.setdefault("app.core.config", _fake_config)
sys.modules.setdefault("app.core.database", _fake_database)

# Now we can safely import the pieces we need
from app.models.lender import RuleType, RuleOperator
from app.models.results import MatchStatus
from app.services.rule_evaluator import evaluate_rule, EvaluationResult
from app.services.matching_engine import (
    build_application_context,
    evaluate_lender_pure,
    _eval_program,
    RuleSnapshot,
    ProgramSnapshot,
    LenderSnapshot,
    ProgramResult,
    LenderResult,
)


# ============================
# HELPERS
# ============================

def make_rule_snap(field, operator, **kw) -> RuleSnapshot:
    """Create a RuleSnapshot for testing."""
    return RuleSnapshot(
        id=kw.get("id", 1),
        field=field,
        operator=operator,
        value_text=kw.get("value_text"),
        value_numeric=kw.get("value_numeric"),
        value_numeric_max=kw.get("value_numeric_max"),
        value_list=kw.get("value_list"),
        value_boolean=kw.get("value_boolean"),
        rule_type=kw.get("rule_type", "hard"),
        score_weight=kw.get("score_weight", 10.0),
        label=kw.get("label", field),
    )


def make_fake_rule(field, operator, **kw):
    """Create a fake rule object compatible with evaluate_rule()."""
    class FakeRule:
        pass
    r = FakeRule()
    r.field = field
    r.operator = operator
    r.rule_type = kw.get("rule_type", "hard")
    r.label = kw.get("label", field)
    r.value_numeric = kw.get("value_numeric")
    r.value_numeric_max = kw.get("value_numeric_max")
    r.value_text = kw.get("value_text")
    r.value_list = kw.get("value_list")
    r.value_boolean = kw.get("value_boolean")
    r.score_weight = kw.get("score_weight", 10.0)
    return r


def make_program_snap(rules_config, name="Test Program", priority=1, prog_id=1):
    """Build a ProgramSnapshot from a list of rule kwarg dicts."""
    rules = [make_rule_snap(**r) for r in rules_config]
    return ProgramSnapshot(id=prog_id, name=name, priority=priority, rules=rules)


def make_lender_snap(programs, name="Test Lender", lender_id=1):
    """Build a LenderSnapshot from ProgramSnapshot list."""
    return LenderSnapshot(id=lender_id, name=name, programs=programs)


def make_full_application():
    """Mock Application with all sub-objects."""
    app = MagicMock()
    app.business.years_in_business = 5
    app.business.annual_revenue = 500000
    app.business.state = "TX"
    app.business.industry = "Construction"
    app.business.is_startup = False
    app.business.paynet_score = 680

    app.guarantor.fico_score = 720
    app.guarantor.is_homeowner = True
    app.guarantor.is_us_citizen = True
    app.guarantor.years_at_residence = 6
    app.guarantor.has_bankruptcy = False
    app.guarantor.years_since_bankruptcy = None
    app.guarantor.has_judgement = False
    app.guarantor.has_foreclosure = False
    app.guarantor.has_repossession = False
    app.guarantor.has_tax_lien = False
    app.guarantor.has_collections_last_3y = False
    app.guarantor.revolving_debt = 5000
    app.guarantor.revolving_plus_unsecured_debt = 8000
    app.guarantor.comparable_credit_pct = 85

    app.loan_request.amount = 50000
    app.loan_request.term_months = 60
    app.loan_request.equipment_type = "Forklift"
    app.loan_request.equipment_age_years = 3
    app.loan_request.equipment_mileage = 5000
    app.loan_request.is_private_party = False
    app.loan_request.is_titled_asset = False
    return app


# ============================
# 1. RULE EVALUATOR — GTE
# ============================

class TestRuleEvaluatorGTE:

    def test_gte_passes_above(self):
        r = make_fake_rule("fico_score", "gte", value_numeric=700)
        assert evaluate_rule(r, {"fico_score": 750}).passed is True

    def test_gte_passes_at_boundary(self):
        r = make_fake_rule("fico_score", "gte", value_numeric=700)
        assert evaluate_rule(r, {"fico_score": 700}).passed is True

    def test_gte_fails_below(self):
        r = make_fake_rule("fico_score", "gte", value_numeric=700)
        res = evaluate_rule(r, {"fico_score": 650})
        assert res.passed is False
        assert "650" in res.explanation
        assert "700" in res.explanation

    def test_gte_float_values(self):
        r = make_fake_rule("time_in_business_years", "gte", value_numeric=2.0)
        assert evaluate_rule(r, {"time_in_business_years": 2.5}).passed is True


# ============================
# 2. RULE EVALUATOR — LTE
# ============================

class TestRuleEvaluatorLTE:

    def test_lte_passes_below(self):
        r = make_fake_rule("loan_amount", "lte", value_numeric=100000)
        assert evaluate_rule(r, {"loan_amount": 50000}).passed is True

    def test_lte_passes_at_boundary(self):
        r = make_fake_rule("loan_amount", "lte", value_numeric=100000)
        assert evaluate_rule(r, {"loan_amount": 100000}).passed is True

    def test_lte_fails_above(self):
        r = make_fake_rule("loan_amount", "lte", value_numeric=100000)
        assert evaluate_rule(r, {"loan_amount": 150000}).passed is False


# ============================
# 3. RULE EVALUATOR — GT / LT
# ============================

class TestRuleEvaluatorGT:

    def test_gt_passes(self):
        r = make_fake_rule("annual_revenue", "gt", value_numeric=100000)
        assert evaluate_rule(r, {"annual_revenue": 200000}).passed is True

    def test_gt_fails_at_exact(self):
        r = make_fake_rule("annual_revenue", "gt", value_numeric=100000)
        assert evaluate_rule(r, {"annual_revenue": 100000}).passed is False


class TestRuleEvaluatorLT:

    def test_lt_passes(self):
        r = make_fake_rule("equipment_age_years", "lt", value_numeric=15)
        assert evaluate_rule(r, {"equipment_age_years": 5}).passed is True

    def test_lt_fails_at_exact(self):
        r = make_fake_rule("equipment_age_years", "lt", value_numeric=15)
        assert evaluate_rule(r, {"equipment_age_years": 15}).passed is False


# ============================
# 4. RULE EVALUATOR — EQ / NEQ
# ============================

class TestRuleEvaluatorEQ:

    def test_eq_boolean_true(self):
        r = make_fake_rule("is_us_citizen", "eq", value_boolean=True)
        assert evaluate_rule(r, {"is_us_citizen": True}).passed is True

    def test_eq_boolean_false_matches(self):
        r = make_fake_rule("has_bankruptcy", "eq", value_boolean=False)
        assert evaluate_rule(r, {"has_bankruptcy": False}).passed is True

    def test_eq_boolean_mismatch(self):
        r = make_fake_rule("has_bankruptcy", "eq", value_boolean=False)
        assert evaluate_rule(r, {"has_bankruptcy": True}).passed is False

    def test_eq_text_match(self):
        r = make_fake_rule("business_state", "eq", value_text="TX", value_boolean=None)
        assert evaluate_rule(r, {"business_state": "TX"}).passed is True

    def test_eq_text_case_insensitive(self):
        r = make_fake_rule("business_state", "eq", value_text="tx", value_boolean=None)
        assert evaluate_rule(r, {"business_state": "TX"}).passed is True


class TestRuleEvaluatorNEQ:

    def test_neq_passes_different(self):
        r = make_fake_rule("has_foreclosure", "neq", value_boolean=True)
        assert evaluate_rule(r, {"has_foreclosure": False}).passed is True

    def test_neq_fails_same(self):
        r = make_fake_rule("has_foreclosure", "neq", value_boolean=True)
        assert evaluate_rule(r, {"has_foreclosure": True}).passed is False


# ============================
# 5. RULE EVALUATOR — IN / NOT_IN
# ============================

class TestRuleEvaluatorIN:

    def test_in_passes(self):
        r = make_fake_rule("business_state", "in", value_list="TX,CA,NY,FL")
        assert evaluate_rule(r, {"business_state": "TX"}).passed is True

    def test_in_fails(self):
        r = make_fake_rule("business_state", "in", value_list="TX,CA,NY,FL")
        assert evaluate_rule(r, {"business_state": "MT"}).passed is False

    def test_in_case_insensitive(self):
        r = make_fake_rule("business_state", "in", value_list="TX,CA,NY")
        assert evaluate_rule(r, {"business_state": "tx"}).passed is True

    def test_in_whitespace(self):
        r = make_fake_rule("business_state", "in", value_list="TX, CA, NY")
        assert evaluate_rule(r, {"business_state": "CA"}).passed is True


class TestRuleEvaluatorNOTIN:

    def test_not_in_passes(self):
        r = make_fake_rule("business_state", "not_in", value_list="CA,NV,ND,VT")
        assert evaluate_rule(r, {"business_state": "TX"}).passed is True

    def test_not_in_fails(self):
        r = make_fake_rule("business_state", "not_in", value_list="CA,NV,ND,VT")
        assert evaluate_rule(r, {"business_state": "CA"}).passed is False

    def test_not_in_case_insensitive(self):
        r = make_fake_rule("business_state", "not_in", value_list="CA,NV")
        assert evaluate_rule(r, {"business_state": "ca"}).passed is False


# ============================
# 6. RULE EVALUATOR — BETWEEN
# ============================

class TestRuleEvaluatorBETWEEN:

    def test_between_in_range(self):
        r = make_fake_rule("loan_amount", "between", value_numeric=10000, value_numeric_max=75000)
        assert evaluate_rule(r, {"loan_amount": 50000}).passed is True

    def test_between_at_min(self):
        r = make_fake_rule("loan_amount", "between", value_numeric=10000, value_numeric_max=75000)
        assert evaluate_rule(r, {"loan_amount": 10000}).passed is True

    def test_between_at_max(self):
        r = make_fake_rule("loan_amount", "between", value_numeric=10000, value_numeric_max=75000)
        assert evaluate_rule(r, {"loan_amount": 75000}).passed is True

    def test_between_below_min(self):
        r = make_fake_rule("loan_amount", "between", value_numeric=10000, value_numeric_max=75000)
        assert evaluate_rule(r, {"loan_amount": 5000}).passed is False

    def test_between_above_max(self):
        r = make_fake_rule("loan_amount", "between", value_numeric=10000, value_numeric_max=75000)
        assert evaluate_rule(r, {"loan_amount": 100000}).passed is False


# ============================
# 7. RULE EVALUATOR — Missing / Optional values
# ============================

class TestRuleEvaluatorMissing:

    def test_missing_required_fails(self):
        r = make_fake_rule("fico_score", "gte", value_numeric=700)
        res = evaluate_rule(r, {})
        assert res.passed is False
        assert "Not provided" in res.actual_value

    def test_missing_boolean_defaults_false(self):
        r = make_fake_rule("has_bankruptcy", "eq", value_boolean=False)
        assert evaluate_rule(r, {}).passed is True

    def test_missing_boolean_fails_when_true_required(self):
        r = make_fake_rule("is_us_citizen", "eq", value_boolean=True)
        assert evaluate_rule(r, {}).passed is False

    def test_optional_paynet_skipped(self):
        r = make_fake_rule("paynet_score", "gte", value_numeric=660)
        res = evaluate_rule(r, {})
        assert res.passed is True
        assert "skipped" in res.explanation.lower()

    def test_optional_comparable_credit_skipped(self):
        r = make_fake_rule("comparable_credit_pct", "gte", value_numeric=80)
        assert evaluate_rule(r, {}).passed is True

    def test_optional_mileage_skipped(self):
        r = make_fake_rule("equipment_mileage", "lte", value_numeric=100000)
        assert evaluate_rule(r, {}).passed is True


# ============================
# 8. RULE EVALUATOR — Unknown operator
# ============================

class TestRuleEvaluatorUnknown:

    def test_unknown_operator_fails(self):
        r = make_fake_rule("fico_score", "regex", value_text=".*")
        res = evaluate_rule(r, {"fico_score": 700})
        assert res.passed is False
        assert "Unknown" in res.explanation


# ============================
# 9. RULE EVALUATOR — Explanations
# ============================

class TestRuleExplanations:

    def test_pass_has_checkmark(self):
        r = make_fake_rule("fico_score", "gte", value_numeric=700, label="Min FICO")
        assert "✓" in evaluate_rule(r, {"fico_score": 750}).explanation

    def test_fail_has_x(self):
        r = make_fake_rule("fico_score", "gte", value_numeric=700, label="Min FICO")
        assert "✗" in evaluate_rule(r, {"fico_score": 650}).explanation

    def test_uses_label(self):
        r = make_fake_rule("fico_score", "gte", value_numeric=700, label="Min FICO")
        assert "Min FICO" in evaluate_rule(r, {"fico_score": 750}).explanation

    def test_actual_required_populated(self):
        r = make_fake_rule("fico_score", "gte", value_numeric=700)
        res = evaluate_rule(r, {"fico_score": 650})
        assert res.actual_value == "650"
        assert ">= 700" in res.required_value


# ============================
# 10. PROGRAM EVALUATION via _eval_program
# ============================

class TestProgramEvaluation:

    def test_all_hard_pass_eligible(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700},
            {"field": "time_in_business_years", "operator": "gte", "value_numeric": 2},
        ])
        res = _eval_program(prog, {"fico_score": 750, "time_in_business_years": 5})
        assert res.eligible is True
        assert res.fit_score > 0

    def test_hard_failure_ineligible(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700, "rule_type": "hard"},
        ])
        res = _eval_program(prog, {"fico_score": 600})
        assert res.eligible is False
        assert res.fit_score == 0.0

    def test_soft_failure_still_eligible(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700, "rule_type": "hard"},
            {"field": "comparable_credit_pct", "operator": "gte", "value_numeric": 80,
             "rule_type": "soft", "score_weight": 10},
        ])
        res = _eval_program(prog, {"fico_score": 750, "comparable_credit_pct": 60})
        assert res.eligible is True
        assert res.fit_score < 100

    def test_multiple_hard_failures(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700},
            {"field": "time_in_business_years", "operator": "gte", "value_numeric": 3},
            {"field": "has_bankruptcy", "operator": "eq", "value_boolean": False},
        ])
        res = _eval_program(prog, {"fico_score": 600, "time_in_business_years": 1, "has_bankruptcy": True})
        assert res.eligible is False
        assert res.hard_fail_count == 3

    def test_no_rules_perfect_score(self):
        prog = make_program_snap([])
        res = _eval_program(prog, {})
        assert res.eligible is True
        assert res.fit_score == 100.0

    def test_all_soft_fail_still_eligible(self):
        prog = make_program_snap([
            {"field": "comparable_credit_pct", "operator": "gte", "value_numeric": 80,
             "rule_type": "soft", "score_weight": 10},
            {"field": "revolving_debt", "operator": "lte", "value_numeric": 5000,
             "rule_type": "soft", "score_weight": 10},
        ])
        res = _eval_program(prog, {"comparable_credit_pct": 30, "revolving_debt": 20000})
        assert res.eligible is True
        assert res.fit_score < 100

    def test_rule_evals_populated(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700},
            {"field": "loan_amount", "operator": "between", "value_numeric": 10000, "value_numeric_max": 100000},
        ])
        res = _eval_program(prog, {"fico_score": 750, "loan_amount": 50000})
        assert len(res.rule_evals) == 2

    def test_rules_passed_count(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700},
            {"field": "time_in_business_years", "operator": "gte", "value_numeric": 10},
        ])
        res = _eval_program(prog, {"fico_score": 750, "time_in_business_years": 3})
        assert res.rules_passed == 1  # only fico passes


# ============================
# 11. MARGIN BONUS
# ============================

class TestMarginBonus:

    def test_bonus_applied_when_exceeding(self):
        """With soft deductions, bonus partially recovers score."""
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 650},
            {"field": "comparable_credit_pct", "operator": "gte", "value_numeric": 80,
             "rule_type": "soft", "score_weight": 10},
        ])
        res_bonus = _eval_program(prog, {"fico_score": 750, "comparable_credit_pct": 50})
        res_no_bonus = _eval_program(prog, {"fico_score": 660, "comparable_credit_pct": 50})
        assert res_bonus.fit_score > res_no_bonus.fit_score

    def test_no_bonus_below_threshold(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700},
        ])
        res = _eval_program(prog, {"fico_score": 710})
        assert res.fit_score == 100.0  # margin ~1.4% < 15%

    def test_bonus_capped(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 300, "id": 1},
            {"field": "time_in_business_years", "operator": "gte", "value_numeric": 1, "id": 2},
            {"field": "annual_revenue", "operator": "gte", "value_numeric": 10000, "id": 3},
            {"field": "loan_amount", "operator": "gte", "value_numeric": 1000, "id": 4},
            {"field": "paynet_score", "operator": "gte", "value_numeric": 300, "id": 5},
            {"field": "revolving_debt", "operator": "gte", "value_numeric": 100, "id": 6},
        ])
        ctx = {
            "fico_score": 800, "time_in_business_years": 20,
            "annual_revenue": 5000000, "loan_amount": 50000,
            "paynet_score": 800, "revolving_debt": 50000,
        }
        res = _eval_program(prog, ctx)
        assert res.fit_score <= 105.0  # max 100 + 5


# ============================
# 12. LENDER EVALUATION via evaluate_lender_pure
# ============================

class TestLenderEvaluation:

    def test_eligible_best_program(self):
        p1 = make_program_snap(
            [{"field": "fico_score", "operator": "gte", "value_numeric": 750}],
            name="Tier A", priority=1, prog_id=1,
        )
        p2 = make_program_snap(
            [{"field": "fico_score", "operator": "gte", "value_numeric": 650}],
            name="Tier B", priority=2, prog_id=2,
        )
        lender = make_lender_snap([p1, p2], name="Apex")
        res = evaluate_lender_pure(lender, {"fico_score": 760})
        assert res.status == MatchStatus.ELIGIBLE
        assert res.fit_score > 0

    def test_ineligible_all_fail(self):
        p1 = make_program_snap(
            [{"field": "fico_score", "operator": "gte", "value_numeric": 750}],
            name="Tier A", priority=1, prog_id=1,
        )
        p2 = make_program_snap(
            [{"field": "fico_score", "operator": "gte", "value_numeric": 700}],
            name="Tier B", priority=2, prog_id=2,
        )
        lender = make_lender_snap([p1, p2])
        res = evaluate_lender_pure(lender, {"fico_score": 600})
        assert res.status == MatchStatus.INELIGIBLE
        assert res.fit_score == 0.0

    def test_no_active_programs(self):
        lender = make_lender_snap([])
        res = evaluate_lender_pure(lender, {"fico_score": 750})
        assert res.status == MatchStatus.INELIGIBLE
        assert "No active programs" in res.summary

    def test_closest_attempt_fewest_hard_failures(self):
        p1 = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 800},
        ], name="Tier A", priority=1, prog_id=1)
        p2 = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 800, "id": 10},
            {"field": "time_in_business_years", "operator": "gte", "value_numeric": 10, "id": 11},
        ], name="Tier B", priority=2, prog_id=2)
        lender = make_lender_snap([p1, p2])
        res = evaluate_lender_pure(lender, {"fico_score": 700, "time_in_business_years": 2})
        assert res.status == MatchStatus.INELIGIBLE
        assert res.program_name == "Tier A"  # 1 hard fail vs 2

    def test_ineligible_summary_has_reasons(self):
        p1 = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 800, "label": "Min FICO"},
        ], name="Strict", priority=1, prog_id=1)
        lender = make_lender_snap([p1])
        res = evaluate_lender_pure(lender, {"fico_score": 600})
        assert res.status == MatchStatus.INELIGIBLE
        assert "Ineligible" in res.summary

    def test_result_contains_rule_evals(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700},
            {"field": "has_bankruptcy", "operator": "eq", "value_boolean": False},
        ], prog_id=1)
        lender = make_lender_snap([prog])
        res = evaluate_lender_pure(lender, {"fico_score": 750, "has_bankruptcy": False})
        assert len(res.rule_evals) == 2

    def test_programs_sorted_by_priority(self):
        p3 = make_program_snap(
            [{"field": "fico_score", "operator": "gte", "value_numeric": 600}],
            name="Tier C", priority=3, prog_id=3,
        )
        p1 = make_program_snap(
            [{"field": "fico_score", "operator": "gte", "value_numeric": 750}],
            name="Tier A", priority=1, prog_id=1,
        )
        lender = make_lender_snap([p3, p1])
        res = evaluate_lender_pure(lender, {"fico_score": 760})
        assert res.status == MatchStatus.ELIGIBLE

    def test_summary_max_3_failure_labels(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 800, "label": "FICO", "id": 1},
            {"field": "time_in_business_years", "operator": "gte", "value_numeric": 20, "label": "TIB", "id": 2},
            {"field": "annual_revenue", "operator": "gte", "value_numeric": 10000000, "label": "Revenue", "id": 3},
            {"field": "paynet_score", "operator": "gte", "value_numeric": 900, "label": "PayNet", "id": 4},
        ], prog_id=1)
        lender = make_lender_snap([prog])
        ctx = {"fico_score": 600, "time_in_business_years": 1, "annual_revenue": 100000, "paynet_score": 500}
        res = evaluate_lender_pure(lender, ctx)
        # summary truncates to 3 failure explanations
        parts = res.summary.replace("Ineligible: ", "").split(", ")
        assert len(parts) <= 3


# ============================
# 13. CONTEXT BUILDING
# ============================

class TestContextBuilding:

    def test_full_context(self):
        app = make_full_application()
        ctx = build_application_context(app)
        assert ctx["fico_score"] == 720
        assert ctx["time_in_business_years"] == 5
        assert ctx["business_state"] == "TX"
        assert ctx["loan_amount"] == 50000
        assert ctx["has_bankruptcy"] is False
        assert ctx["comparable_credit_pct"] == 85
        assert ctx["equipment_type"] == "Forklift"

    def test_missing_all_no_crash(self):
        app = MagicMock()
        app.business = None
        app.guarantor = None
        app.loan_request = None
        assert build_application_context(app) == {}

    def test_partial_business_only(self):
        app = MagicMock()
        app.business.years_in_business = 3
        app.business.annual_revenue = 200000
        app.business.state = "CA"
        app.business.industry = "Tech"
        app.business.is_startup = True
        app.business.paynet_score = None
        app.guarantor = None
        app.loan_request = None
        ctx = build_application_context(app)
        assert ctx["time_in_business_years"] == 3
        assert "fico_score" not in ctx
        assert "loan_amount" not in ctx

    def test_full_context_field_count(self):
        app = make_full_application()
        ctx = build_application_context(app)
        assert len(ctx) == 27


# ============================
# 14. REALISTIC SCENARIOS
# ============================

class TestRealisticScenarios:

    def _strong_ctx(self):
        return {
            "fico_score": 780, "time_in_business_years": 10,
            "annual_revenue": 2000000, "business_state": "TX",
            "industry": "Manufacturing", "is_startup": False,
            "paynet_score": 720, "loan_amount": 50000,
            "loan_term_months": 60, "equipment_type": "CNC Machine",
            "equipment_age_years": 2, "is_private_party": False,
            "is_titled_asset": False, "is_homeowner": True,
            "is_us_citizen": True, "has_bankruptcy": False,
            "has_judgement": False, "has_foreclosure": False,
            "has_repossession": False, "has_tax_lien": False,
            "has_collections_last_3y": False, "revolving_debt": 3000,
            "comparable_credit_pct": 90,
        }

    def _weak_ctx(self):
        return {
            "fico_score": 580, "time_in_business_years": 0.5,
            "annual_revenue": 50000, "business_state": "CA",
            "industry": "Restaurant", "is_startup": True,
            "loan_amount": 200000, "has_bankruptcy": True,
            "has_judgement": True, "has_tax_lien": True,
            "has_collections_last_3y": True, "is_homeowner": False,
            "is_us_citizen": True, "revolving_debt": 45000,
            "comparable_credit_pct": 20,
        }

    def test_strong_applicant_eligible(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700},
            {"field": "time_in_business_years", "operator": "gte", "value_numeric": 2},
            {"field": "loan_amount", "operator": "between", "value_numeric": 5000, "value_numeric_max": 250000},
            {"field": "has_bankruptcy", "operator": "eq", "value_boolean": False},
            {"field": "business_state", "operator": "not_in", "value_list": "ND,VT"},
        ], prog_id=1)
        lender = make_lender_snap([prog])
        res = evaluate_lender_pure(lender, self._strong_ctx())
        assert res.status == MatchStatus.ELIGIBLE
        assert res.fit_score > 80

    def test_weak_applicant_rejected(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700},
            {"field": "has_bankruptcy", "operator": "eq", "value_boolean": False},
            {"field": "has_tax_lien", "operator": "eq", "value_boolean": False},
        ], prog_id=1)
        lender = make_lender_snap([prog])
        res = evaluate_lender_pure(lender, self._weak_ctx())
        assert res.status == MatchStatus.INELIGIBLE

    def test_weak_falls_to_lower_tier(self):
        p_strict = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700},
            {"field": "has_bankruptcy", "operator": "eq", "value_boolean": False},
        ], name="Tier A", priority=1, prog_id=1)
        p_lenient = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 550},
        ], name="Tier C", priority=3, prog_id=2)
        lender = make_lender_snap([p_strict, p_lenient])
        res = evaluate_lender_pure(lender, self._weak_ctx())
        assert res.status == MatchStatus.ELIGIBLE
        assert "Tier C" in res.summary

    def test_geographic_restriction(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 650},
            {"field": "business_state", "operator": "not_in", "value_list": "TX,CA,NY"},
        ], prog_id=1)
        lender = make_lender_snap([prog])
        res = evaluate_lender_pure(lender, self._strong_ctx())
        assert res.status == MatchStatus.INELIGIBLE

    def test_industry_exclusion(self):
        prog = make_program_snap([
            {"field": "industry", "operator": "not_in", "value_list": "Cannabis,Gambling"},
        ], prog_id=1)
        lender = make_lender_snap([prog])
        res = evaluate_lender_pure(lender, {"industry": "Cannabis"})
        assert res.status == MatchStatus.INELIGIBLE

    def test_equipment_age_too_old(self):
        prog = make_program_snap([
            {"field": "equipment_age_years", "operator": "lte", "value_numeric": 10},
        ], prog_id=1)
        lender = make_lender_snap([prog])
        res = evaluate_lender_pure(lender, {"equipment_age_years": 15})
        assert res.status == MatchStatus.INELIGIBLE

    def test_loan_too_small(self):
        prog = make_program_snap([
            {"field": "loan_amount", "operator": "between", "value_numeric": 25000, "value_numeric_max": 500000},
        ], prog_id=1)
        lender = make_lender_snap([prog])
        res = evaluate_lender_pure(lender, {"loan_amount": 5000})
        assert res.status == MatchStatus.INELIGIBLE

    def test_startup_exclusion(self):
        prog = make_program_snap([
            {"field": "is_startup", "operator": "eq", "value_boolean": False},
        ], prog_id=1)
        lender = make_lender_snap([prog])
        res = evaluate_lender_pure(lender, {"is_startup": True})
        assert res.status == MatchStatus.INELIGIBLE

    def test_non_citizen_blocked(self):
        prog = make_program_snap([
            {"field": "is_us_citizen", "operator": "eq", "value_boolean": True},
        ], prog_id=1)
        lender = make_lender_snap([prog])
        res = evaluate_lender_pure(lender, {"is_us_citizen": False})
        assert res.status == MatchStatus.INELIGIBLE

    def test_mixed_hard_soft_scoring(self):
        prog = make_program_snap([
            {"field": "fico_score", "operator": "gte", "value_numeric": 650, "rule_type": "hard"},
            {"field": "is_homeowner", "operator": "eq", "value_boolean": True,
             "rule_type": "soft", "score_weight": 15},
            {"field": "comparable_credit_pct", "operator": "gte", "value_numeric": 75,
             "rule_type": "soft", "score_weight": 10},
        ], prog_id=1)
        lender = make_lender_snap([prog])
        res = evaluate_lender_pure(lender, {"fico_score": 700, "is_homeowner": False, "comparable_credit_pct": 50})
        assert res.status == MatchStatus.ELIGIBLE
        assert 0 < res.fit_score < 100

    def test_multi_lender_comparison(self):
        lender_a = make_lender_snap([
            make_program_snap(
                [{"field": "fico_score", "operator": "gte", "value_numeric": 750}],
                prog_id=1,
            )
        ], name="Lender A", lender_id=1)
        lender_b = make_lender_snap([
            make_program_snap(
                [{"field": "fico_score", "operator": "gte", "value_numeric": 650}],
                prog_id=2,
            )
        ], name="Lender B", lender_id=2)

        ctx = self._strong_ctx()
        res_a = evaluate_lender_pure(lender_a, ctx)
        res_b = evaluate_lender_pure(lender_b, ctx)
        assert res_a.status == MatchStatus.ELIGIBLE
        assert res_b.status == MatchStatus.ELIGIBLE