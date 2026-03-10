# ============================================================
# MATCHING ENGINE
# Core orchestrator: takes an Application, evaluates all active
# lenders concurrently, returns ranked MatchResults.
#
# Flow per lender:
#   1. Build context dict from application fields
#   2. Try each program in priority order
#   3. For best matching program: evaluate all rules
#   4. Calculate fit score (0-100)
#   5. Persist MatchResult + RuleEvaluationResults to DB
#
# FIX-1: "Closest attempt" logic now ranks by fewest hard failures
#        (not most rules passed). A program with 1 hard failure is
#        closer than one with 5 hard failures even if it has fewer
#        total rules. Tiebreak: most rules passed.
# FIX-2: Re-run cascade delete — must delete child rule_evaluation_results
#        before deleting match_results to avoid FK violation.
# ============================================================

import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field

from sqlalchemy.orm import Session, joinedload

from app.models.application import Application, ApplicationStatus
from app.models.lender import Lender, LenderProgram, PolicyRule, RuleType
from app.models.results import MatchResult, MatchStatus, RuleEvaluationResult
from app.services.rule_evaluator import evaluate_rule, EvaluationResult


# ------------------------------------
# Build flat context dict from Application object
# Rule fields map directly to keys in this dict
# ------------------------------------

def build_application_context(application: Application) -> dict:
    ctx = {}
    b = application.business
    g = application.guarantor
    lr = application.loan_request

    if b:
        ctx["time_in_business_years"] = b.years_in_business
        ctx["annual_revenue"] = b.annual_revenue
        ctx["business_state"] = b.state
        ctx["industry"] = b.industry
        ctx["is_startup"] = b.is_startup
        ctx["paynet_score"] = b.paynet_score

    if g:
        ctx["fico_score"] = g.fico_score
        ctx["is_homeowner"] = g.is_homeowner
        ctx["is_us_citizen"] = g.is_us_citizen
        ctx["years_at_residence"] = g.years_at_residence
        ctx["has_bankruptcy"] = g.has_bankruptcy
        ctx["years_since_bankruptcy"] = g.years_since_bankruptcy
        ctx["has_judgement"] = g.has_judgement
        ctx["has_foreclosure"] = g.has_foreclosure
        ctx["has_repossession"] = g.has_repossession
        ctx["has_tax_lien"] = g.has_tax_lien
        ctx["has_collections_last_3y"] = g.has_collections_last_3y
        ctx["revolving_debt"] = g.revolving_debt
        ctx["revolving_plus_unsecured_debt"] = g.revolving_plus_unsecured_debt
        ctx["comparable_credit_pct"] = g.comparable_credit_pct

    if lr:
        ctx["loan_amount"] = lr.amount
        ctx["loan_term_months"] = lr.term_months
        ctx["equipment_type"] = lr.equipment_type
        ctx["equipment_age_years"] = lr.equipment_age_years
        ctx["equipment_mileage"] = lr.equipment_mileage
        ctx["is_private_party"] = lr.is_private_party
        ctx["is_titled_asset"] = lr.is_titled_asset

    return ctx


# ------------------------------------
# Evaluate a single program against context
# ------------------------------------

@dataclass
class ProgramEvaluation:
    program: LenderProgram
    eligible: bool
    fit_score: float
    rule_results: list[tuple[PolicyRule, EvaluationResult]] = field(default_factory=list)
    hard_failures: list[tuple[PolicyRule, EvaluationResult]] = field(default_factory=list)


def evaluate_program(program: LenderProgram, context: dict) -> ProgramEvaluation:
    rule_results = []
    hard_failures = []
    soft_deductions = 0.0

    for rule in program.rules:
        result = evaluate_rule(rule, context)
        rule_results.append((rule, result))
        if not result.passed:
            if rule.rule_type == RuleType.HARD:
                hard_failures.append((rule, result))
            else:
                soft_deductions += rule.score_weight

    eligible = len(hard_failures) == 0

    if not eligible:
        fit_score = 0.0
    else:
        total_soft_weight = sum(r.score_weight for r in program.rules if r.rule_type == RuleType.SOFT)
        if total_soft_weight > 0:
            fit_score = max(0.0, 100.0 - (soft_deductions / total_soft_weight) * 40.0)
        else:
            fit_score = 100.0
        fit_score = _apply_margin_bonus(context, program, fit_score)

    return ProgramEvaluation(
        program=program,
        eligible=eligible,
        fit_score=round(fit_score, 1),
        rule_results=rule_results,
        hard_failures=hard_failures,
    )


def _apply_margin_bonus(context: dict, program: LenderProgram, base_score: float) -> float:
    """Small bonus for applicants significantly exceeding minimums (max +5 pts)."""
    bonus = 0.0
    for rule in program.rules:
        if rule.operator == "gte" and rule.value_numeric:
            actual = context.get(rule.field)
            if actual is not None:
                try:
                    margin = (float(actual) - rule.value_numeric) / rule.value_numeric
                    if margin > 0.15:
                        bonus += 1.0
                except (TypeError, ZeroDivisionError):
                    pass
    return min(100.0, base_score + min(5.0, bonus))


# ------------------------------------
# Evaluate one lender — tries all programs, returns best match
# ------------------------------------

def evaluate_lender(lender: Lender, context: dict) -> dict:
    active_programs = sorted(
        [p for p in lender.programs if p.is_active],
        key=lambda p: p.priority,
    )

    if not active_programs:
        return {
            "lender": lender,
            "status": MatchStatus.INELIGIBLE,
            "fit_score": 0.0,
            "best_program": None,
            "rule_results": [],
            "summary": "No active programs available",
        }

    best_eligible: ProgramEvaluation | None = None
    all_evals: list[ProgramEvaluation] = []

    for program in active_programs:
        ev = evaluate_program(program, context)
        all_evals.append(ev)
        if ev.eligible:
            if best_eligible is None or ev.fit_score > best_eligible.fit_score:
                best_eligible = ev

    if best_eligible:
        return {
            "lender": lender,
            "status": MatchStatus.ELIGIBLE,
            "fit_score": best_eligible.fit_score,
            "best_program": best_eligible.program,
            "rule_results": best_eligible.rule_results,
            "summary": f"Eligible under {best_eligible.program.name} program",
        }

    # Ineligible — show the closest attempt.
    # FIX-1: rank by fewest hard failures first, most rules passed as tiebreak.
    best_attempt = min(
        all_evals,
        key=lambda e: (len(e.hard_failures), -sum(1 for _, r in e.rule_results if r.passed))
    )
    failure_labels = [rule.label or rule.field for rule, _ in best_attempt.hard_failures[:3]]
    return {
        "lender": lender,
        "status": MatchStatus.INELIGIBLE,
        "fit_score": 0.0,
        "best_program": best_attempt.program,
        "rule_results": best_attempt.rule_results,
        "summary": f"Ineligible: {', '.join(failure_labels)}",
    }


# ------------------------------------
# Main entry point — async, runs all lenders concurrently
# ------------------------------------

async def run_underwriting(application_id: int, db: Session) -> list[MatchResult]:
    """
    Run underwriting for all active lenders concurrently.
    Uses ThreadPoolExecutor + asyncio.gather for parallelism.

    Adding a new lender requires zero changes here — this function
    queries ALL active lenders from the DB, so new seed data is
    automatically picked up on the next run.
    """
    application = (
        db.query(Application)
        .options(
            joinedload(Application.business),
            joinedload(Application.guarantor),
            joinedload(Application.loan_request),
        )
        .filter(Application.id == application_id)
        .first()
    )
    if not application:
        raise ValueError(f"Application {application_id} not found")

    # All active lenders — scales automatically to N lenders
    lenders = (
        db.query(Lender)
        .options(joinedload(Lender.programs).joinedload(LenderProgram.rules))
        .filter(Lender.is_active == True)  # noqa: E712
        .all()
    )

    # Flatten application into context dict once — shared across all lenders
    context = build_application_context(application)

    # FIX-2: Delete previous results safely.
    # Must delete child rule_evaluation_results first to avoid FK violation
    # when re-running underwriting on an application that already has results.
    existing_matches = (
        db.query(MatchResult)
        .filter(MatchResult.application_id == application_id)
        .all()
    )
    for match in existing_matches:
        db.query(RuleEvaluationResult).filter(
            RuleEvaluationResult.match_result_id == match.id
        ).delete()
    db.query(MatchResult).filter(
        MatchResult.application_id == application_id
    ).delete()
    db.commit()

    # Fan out — evaluate all lenders concurrently via thread pool
    # evaluate_lender() is CPU-bound pure logic, safe to run in threads
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as pool:
        tasks = [
            loop.run_in_executor(pool, evaluate_lender, lender, context)
            for lender in lenders
        ]
        lender_results = await asyncio.gather(*tasks)

    # Persist results
    saved: list[MatchResult] = []
    for result in lender_results:
        match = MatchResult(
            application_id=application_id,
            lender_id=result["lender"].id,
            program_id=result["best_program"].id if result["best_program"] else None,
            status=result["status"],
            fit_score=result["fit_score"],
            summary=result["summary"],
        )
        db.add(match)
        db.flush()

        for rule, eval_result in result["rule_results"]:
            db.add(RuleEvaluationResult(
                match_result_id=match.id,
                rule_id=rule.id,
                passed=eval_result.passed,
                actual_value=eval_result.actual_value,
                required_value=eval_result.required_value,
                explanation=eval_result.explanation,
            ))

        saved.append(match)

    application.status = ApplicationStatus.COMPLETED
    db.commit()

    for r in saved:
        db.refresh(r)

    return saved