# ============================================================
# TESTS — Matching Engine and Rule Evaluator
# Tests critical business logic with no DB dependency.
# ============================================================

import pytest
from app.models.lender import PolicyRule, RuleOperator, RuleType
from app.services.rule_evaluator import evaluate_rule
from app.services.matching_engine import build_application_context, evaluate_program
from unittest.mock import MagicMock


# ------------------------------------
# Rule Evaluator Tests
# ------------------------------------

def make_rule(field, operator, **kwargs) -> PolicyRule:
    rule = MagicMock(spec=PolicyRule)
    rule.field = field
    rule.operator = operator
    rule.rule_type = kwargs.get("rule_type", RuleType.HARD)
    rule.label = kwargs.get("label", field)
    rule.value_numeric = kwargs.get("value_numeric")
    rule.value_numeric_max = kwargs.get("value_numeric_max")
    rule.value_text = kwargs.get("value_text")
    rule.value_list = kwargs.get("value_list")
    rule.value_boolean = kwargs.get("value_boolean")
    rule.score_weight = kwargs.get("score_weight", 10.0)
    return rule


class TestRuleEvaluator:

    def test_fico_gte_passes(self):
        rule = make_rule("fico_score", "gte", value_numeric=700)
        result = evaluate_rule(rule, {"fico_score": 750})
        assert result.passed is True

    def test_fico_gte_fails(self):
        rule = make_rule("fico_score", "gte", value_numeric=700)
        result = evaluate_rule(rule, {"fico_score": 650})
        assert result.passed is False
        assert "650" in result.explanation
        assert "700" in result.explanation

    def test_loan_amount_between_passes(self):
        rule = make_rule("loan_amount", "between", value_numeric=10000, value_numeric_max=75000)
        result = evaluate_rule(rule, {"loan_amount": 50000})
        assert result.passed is True

    def test_loan_amount_between_fails_too_high(self):
        rule = make_rule("loan_amount", "between", value_numeric=10000, value_numeric_max=75000)
        result = evaluate_rule(rule, {"loan_amount": 100000})
        assert result.passed is False

    def test_state_not_in_passes(self):
        rule = make_rule("business_state", "not_in", value_list="CA,NV,ND,VT")
        result = evaluate_rule(rule, {"business_state": "TX"})
        assert result.passed is True

    def test_state_not_in_fails(self):
        rule = make_rule("business_state", "not_in", value_list="CA,NV,ND,VT")
        result = evaluate_rule(rule, {"business_state": "CA"})
        assert result.passed is False

    def test_has_bankruptcy_eq_false_passes(self):
        rule = make_rule("has_bankruptcy", "eq", value_boolean=False)
        result = evaluate_rule(rule, {"has_bankruptcy": False})
        assert result.passed is True

    def test_has_bankruptcy_eq_false_fails(self):
        rule = make_rule("has_bankruptcy", "eq", value_boolean=False)
        result = evaluate_rule(rule, {"has_bankruptcy": True})
        assert result.passed is False

    def test_missing_value_fails(self):
        rule = make_rule("fico_score", "gte", value_numeric=700)
        result = evaluate_rule(rule, {})
        assert result.passed is False
        assert "Not provided" in result.actual_value

    def test_is_us_citizen_required(self):
        rule = make_rule("is_us_citizen", "eq", value_boolean=True)
        result = evaluate_rule(rule, {"is_us_citizen": False})
        assert result.passed is False

    def test_paynet_lte_passes(self):
        rule = make_rule("paynet_score", "gte", value_numeric=660)
        result = evaluate_rule(rule, {"paynet_score": 700})
        assert result.passed is True


# ------------------------------------
# Program Evaluation Tests
# ------------------------------------

class TestProgramEvaluation:

    def _make_program(self, rules_config):
        program = MagicMock()
        program.rules = [make_rule(**r) for r in rules_config]
        program.name = "Test Program"
        return program

    def test_all_rules_pass_gives_100_score(self):
        program = self._make_program([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700},
        ])
        ctx = {"fico_score": 750}
        result = evaluate_program(program, ctx)
        assert result.eligible is True
        assert result.fit_score > 0

    def test_hard_failure_gives_ineligible(self):
        program = self._make_program([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700, "rule_type": "hard"},
        ])
        ctx = {"fico_score": 600}
        result = evaluate_program(program, ctx)
        assert result.eligible is False
        assert result.fit_score == 0.0

    def test_soft_failure_still_eligible(self):
        program = self._make_program([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700, "rule_type": "hard"},
            {"field": "comparable_credit_pct", "operator": "gte", "value_numeric": 80, "rule_type": "soft", "score_weight": 10},
        ])
        ctx = {"fico_score": 750, "comparable_credit_pct": 60}
        result = evaluate_program(program, ctx)
        assert result.eligible is True
        assert result.fit_score < 100

    def test_multiple_hard_failures(self):
        program = self._make_program([
            {"field": "fico_score", "operator": "gte", "value_numeric": 700},
            {"field": "time_in_business_years", "operator": "gte", "value_numeric": 3},
            {"field": "has_bankruptcy", "operator": "eq", "value_boolean": False},
        ])
        ctx = {"fico_score": 600, "time_in_business_years": 1, "has_bankruptcy": True}
        result = evaluate_program(program, ctx)
        assert result.eligible is False
        assert len(result.hard_failures) == 3


# ------------------------------------
# Context Building Tests
# ------------------------------------

class TestContextBuilding:

    def test_context_includes_all_fields(self):
        app = MagicMock()
        app.business.years_in_business = 5
        app.business.state = "TX"
        app.business.industry = "Construction"
        app.business.is_startup = False
        app.business.paynet_score = 680
        app.business.annual_revenue = 500000

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

        ctx = build_application_context(app)

        assert ctx["fico_score"] == 720
        assert ctx["time_in_business_years"] == 5
        assert ctx["business_state"] == "TX"
        assert ctx["loan_amount"] == 50000
        assert ctx["has_bankruptcy"] is False
