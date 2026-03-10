# ============================================================
# app/services/matching_engine.py
#
# Matching Engine — evaluates all active lenders concurrently,
# persists results, returns ranked MatchResults.
#
# FIX-THREAD-SAFETY:
#   The original implementation passed a single SQLAlchemy Session
#   into ThreadPoolExecutor workers. SQLAlchemy sessions are NOT
#   thread-safe — concurrent access caused silent data loss and
#   FK violations, producing 0 match_results rows for some runs.
#
#   Fix: each worker receives only serialisable Python data
#   (application context dict + plain lender/program/rule dicts).
#   The main thread holds the one DB session and does all writes
#   after workers return.
#
# FIX-1: "Closest attempt" — rank ineligible programs by fewest
#         hard failures, most rules passed as tiebreak.
# FIX-2: Re-run cascade — delete rule_evaluation_results before
#         match_results to avoid FK violation.
# ============================================================

import asyncio
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy.orm import Session, joinedload

from app.models.application import Application, ApplicationStatus
from app.models.lender import Lender, LenderProgram, PolicyRule, RuleType
from app.models.results import MatchResult, MatchStatus, RuleEvaluationResult
from app.services.rule_evaluator import evaluate_rule, EvaluationResult


# ─────────────────────────────────────────────────────────────
# Serialisable snapshots  (passed into thread workers — no ORM)
# ─────────────────────────────────────────────────────────────

@dataclass
class RuleSnapshot:
    id:                int
    field:             str
    operator:          str
    value_text:        str | None
    value_numeric:     float | None
    value_numeric_max: float | None   # used by BETWEEN operator
    value_list:        str | None
    value_boolean:     bool | None    # used by EQ/NEQ on boolean fields
    rule_type:         str            # 'hard' | 'soft'
    score_weight:      float
    label:             str | None


@dataclass
class ProgramSnapshot:
    id:       int
    name:     str
    priority: int
    rules:    list[RuleSnapshot]


@dataclass
class LenderSnapshot:
    id:       int
    name:     str
    programs: list[ProgramSnapshot]


def _snapshot_lenders(lenders: list[Lender]) -> list[LenderSnapshot]:
    """Convert ORM objects → plain dataclasses before handing to threads."""
    snaps = []
    for l in lenders:
        progs = []
        for p in l.programs:
            if not p.is_active:
                continue
            rules = [
                RuleSnapshot(
                    id=r.id, field=r.field, operator=r.operator,
                    value_text=r.value_text,
                    value_numeric=r.value_numeric,
                    value_numeric_max=r.value_numeric_max,
                    value_list=r.value_list,
                    value_boolean=r.value_boolean,
                    rule_type=r.rule_type.value if hasattr(r.rule_type, 'value') else r.rule_type,
                    score_weight=r.score_weight or 1.0,
                    label=r.label,
                )
                for r in p.rules
            ]
            progs.append(ProgramSnapshot(id=p.id, name=p.name, priority=p.priority, rules=rules))
        progs.sort(key=lambda p: p.priority)
        snaps.append(LenderSnapshot(id=l.id, name=l.name, programs=progs))
    return snaps


# ─────────────────────────────────────────────────────────────
# Build application context dict
# ─────────────────────────────────────────────────────────────

def build_application_context(application: Application) -> dict:
    ctx: dict = {}
    b  = application.business
    g  = application.guarantor
    lr = application.loan_request

    if b:
        ctx["time_in_business_years"] = b.years_in_business
        ctx["annual_revenue"]         = b.annual_revenue
        ctx["business_state"]         = b.state
        ctx["industry"]               = b.industry
        ctx["is_startup"]             = b.is_startup
        ctx["paynet_score"]           = b.paynet_score

    if g:
        ctx["fico_score"]                   = g.fico_score
        ctx["is_homeowner"]                 = g.is_homeowner
        ctx["is_us_citizen"]                = g.is_us_citizen
        ctx["years_at_residence"]           = g.years_at_residence
        ctx["has_bankruptcy"]               = g.has_bankruptcy
        ctx["years_since_bankruptcy"]       = g.years_since_bankruptcy
        ctx["has_judgement"]                = g.has_judgement
        ctx["has_foreclosure"]              = g.has_foreclosure
        ctx["has_repossession"]             = g.has_repossession
        ctx["has_tax_lien"]                 = g.has_tax_lien
        ctx["has_collections_last_3y"]      = g.has_collections_last_3y
        ctx["revolving_debt"]               = g.revolving_debt
        ctx["revolving_plus_unsecured_debt"]= g.revolving_plus_unsecured_debt
        ctx["comparable_credit_pct"]        = g.comparable_credit_pct

    if lr:
        ctx["loan_amount"]        = lr.amount
        ctx["loan_term_months"]   = lr.term_months
        ctx["equipment_type"]     = lr.equipment_type
        ctx["equipment_age_years"]= lr.equipment_age_years
        ctx["equipment_mileage"]  = lr.equipment_mileage
        ctx["is_private_party"]   = lr.is_private_party
        ctx["is_titled_asset"]    = lr.is_titled_asset

    return ctx


# ─────────────────────────────────────────────────────────────
# Rule / program evaluation  (pure Python — no DB access)
# ─────────────────────────────────────────────────────────────

@dataclass
class RuleEvalSnapshot:
    rule_id:        int
    passed:         bool
    actual_value:   str | None
    required_value: str | None
    explanation:    str | None


@dataclass
class ProgramResult:
    program_id:     int
    program_name:   str
    eligible:       bool
    fit_score:      float
    rule_evals:     list[RuleEvalSnapshot] = field(default_factory=list)
    hard_fail_count:int = 0
    rules_passed:   int = 0


def _eval_program(prog: ProgramSnapshot, ctx: dict) -> ProgramResult:
    """Evaluate a program's rules against the context dict.
    All logic is pure Python — safe to run in any thread."""

    # Build a minimal mock rule object that rule_evaluator can use
    class _FakeRule:
        def __init__(self, snap: RuleSnapshot):
            self.id                = snap.id
            self.field             = snap.field
            self.operator          = snap.operator
            self.value_text        = snap.value_text
            self.value_numeric     = snap.value_numeric
            self.value_numeric_max = snap.value_numeric_max
            self.value_list        = snap.value_list
            self.value_boolean     = snap.value_boolean
            self.rule_type         = snap.rule_type
            self.score_weight      = snap.score_weight
            self.label             = snap.label

    rule_evals: list[RuleEvalSnapshot]       = []
    hard_failures: list[tuple[RuleSnapshot, EvaluationResult]] = []
    soft_deductions = 0.0

    for snap in prog.rules:
        fake = _FakeRule(snap)
        result: EvaluationResult = evaluate_rule(fake, ctx)
        rule_evals.append(RuleEvalSnapshot(
            rule_id        = snap.id,
            passed         = result.passed,
            actual_value   = result.actual_value,
            required_value = result.required_value,
            explanation    = result.explanation,
        ))
        if not result.passed:
            if snap.rule_type in ("hard", RuleType.HARD):
                hard_failures.append((snap, result))
            else:
                soft_deductions += snap.score_weight

    eligible = len(hard_failures) == 0
    rules_passed = sum(1 for e in rule_evals if e.passed)

    if not eligible:
        fit_score = 0.0
    else:
        total_soft = sum(s.score_weight for s in prog.rules if s.rule_type not in ("hard", RuleType.HARD))
        if total_soft > 0:
            fit_score = max(0.0, 100.0 - (soft_deductions / total_soft) * 40.0)
        else:
            fit_score = 100.0
        # Margin bonus
        bonus = 0.0
        for snap in prog.rules:
            if snap.operator == "gte" and snap.value_numeric:
                actual = ctx.get(snap.field)
                if actual is not None:
                    try:
                        margin = (float(actual) - snap.value_numeric) / snap.value_numeric
                        if margin > 0.15:
                            bonus += 1.0
                    except (TypeError, ZeroDivisionError):
                        pass
        fit_score = min(100.0, fit_score + min(5.0, bonus))

    return ProgramResult(
        program_id      = prog.id,
        program_name    = prog.name,
        eligible        = eligible,
        fit_score       = round(fit_score, 1),
        rule_evals      = rule_evals,
        hard_fail_count = len(hard_failures),
        rules_passed    = rules_passed,
    )


# ─────────────────────────────────────────────────────────────
# Lender evaluation  (pure — safe for ThreadPoolExecutor)
# ─────────────────────────────────────────────────────────────

@dataclass
class LenderResult:
    lender_id:    int
    lender_name:  str
    status:       str          # 'eligible' | 'ineligible'
    fit_score:    float
    program_id:   int | None
    program_name: str | None
    rule_evals:   list[RuleEvalSnapshot]
    summary:      str


def evaluate_lender_pure(lender: LenderSnapshot, ctx: dict) -> LenderResult:
    """Evaluate one lender — no DB access, no ORM objects."""
    if not lender.programs:
        return LenderResult(
            lender_id=lender.id, lender_name=lender.name,
            status=MatchStatus.INELIGIBLE, fit_score=0.0,
            program_id=None, program_name=None, rule_evals=[],
            summary="No active programs available",
        )

    all_results: list[ProgramResult] = []
    best_eligible: ProgramResult | None = None

    for prog in lender.programs:
        pr = _eval_program(prog, ctx)
        all_results.append(pr)
        if pr.eligible and (best_eligible is None or pr.fit_score > best_eligible.fit_score):
            best_eligible = pr

    if best_eligible:
        return LenderResult(
            lender_id    = lender.id,
            lender_name  = lender.name,
            status       = MatchStatus.ELIGIBLE,
            fit_score    = best_eligible.fit_score,
            program_id   = best_eligible.program_id,
            program_name = best_eligible.program_name,
            rule_evals   = best_eligible.rule_evals,
            summary      = f"Eligible under {best_eligible.program_name} program",
        )

    # FIX-1: closest attempt = fewest hard failures, most rules passed as tiebreak
    closest = min(all_results, key=lambda r: (r.hard_fail_count, -r.rules_passed))
    failure_labels = [
        e.explanation or f"rule {e.rule_id}"
        for e in closest.rule_evals
        if not e.passed
    ][:3]

    return LenderResult(
        lender_id    = lender.id,
        lender_name  = lender.name,
        status       = MatchStatus.INELIGIBLE,
        fit_score    = 0.0,
        program_id   = closest.program_id,
        program_name = closest.program_name,
        rule_evals   = closest.rule_evals,
        summary      = f"Ineligible: {', '.join(failure_labels)}" if failure_labels else "Ineligible",
    )


# ─────────────────────────────────────────────────────────────
# Main entry point
# ─────────────────────────────────────────────────────────────

async def run_underwriting(application_id: int, db: Session) -> list[MatchResult]:
    """
    Run underwriting for all active lenders concurrently.

    Thread-safety fix: ORM objects are snapshotted to plain dataclasses
    BEFORE being handed to ThreadPoolExecutor workers. Workers do zero
    DB access — all writes happen on the main thread after gather().
    """
    # ── Load application ─────────────────────────────────────
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

    # ── Load all active lenders with rules ───────────────────
    lenders = (
        db.query(Lender)
        .options(joinedload(Lender.programs).joinedload(LenderProgram.rules))
        .filter(Lender.is_active == True)  # noqa: E712
        .all()
    )

    if not lenders:
        raise ValueError("No active lenders found in database. Run seeder first.")

    # ── Build context + snapshot lenders (before thread hand-off) ──
    context          = build_application_context(application)
    lender_snapshots = _snapshot_lenders(lenders)

    # ── FIX-2: Clear previous results (cascade-safe) ─────────
    existing = db.query(MatchResult).filter(
        MatchResult.application_id == application_id
    ).all()
    for m in existing:
        db.query(RuleEvaluationResult).filter(
            RuleEvaluationResult.match_result_id == m.id
        ).delete(synchronize_session=False)
    db.query(MatchResult).filter(
        MatchResult.application_id == application_id
    ).delete(synchronize_session=False)
    db.commit()

    # ── Fan-out: evaluate all lenders concurrently ───────────
    # Workers receive only plain Python objects — no DB sessions
    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as pool:
        tasks = [
            loop.run_in_executor(pool, evaluate_lender_pure, snap, context)
            for snap in lender_snapshots
        ]
        lender_results: list[LenderResult] = await asyncio.gather(*tasks)

    # ── Persist all results on the main thread ───────────────
    saved: list[MatchResult] = []

    for lr in lender_results:
        match = MatchResult(
            application_id = application_id,
            lender_id      = lr.lender_id,
            program_id     = lr.program_id,
            status         = lr.status,
            fit_score      = lr.fit_score,
            summary        = lr.summary,
        )
        db.add(match)
        db.flush()  # get match.id

        for re in lr.rule_evals:
            db.add(RuleEvaluationResult(
                match_result_id = match.id,
                rule_id         = re.rule_id,
                passed          = re.passed,
                actual_value    = re.actual_value,
                required_value  = re.required_value,
                explanation     = re.explanation,
            ))

        saved.append(match)

    application.status = ApplicationStatus.COMPLETED
    db.commit()

    # Refresh to load relationships for serialization in the POST response
    for m in saved:
        db.refresh(m)

    return saved