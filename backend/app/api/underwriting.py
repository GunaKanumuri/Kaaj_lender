# ============================================================
# api/underwriting.py — Underwriting REST API
#
# TABLE OF CONTENTS
#   1. Router Setup
#   2. POST /underwriting/run/{id}      — Run matching engine
#   3. GET  /underwriting/results/{id}  — Retrieve saved results
#   4. _serialize_results()             — ORM → response schema
# ============================================================

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.lender import Lender, LenderProgram
from app.models.results import MatchResult, RuleEvaluationResult
from app.schemas.results import MatchResultOut, RuleEvaluationResultOut, UnderwritingRunResponse
from app.services.matching_engine import run_underwriting


# region ── 1. Router Setup ───────────────────────────────────
router = APIRouter(prefix="/underwriting", tags=["Underwriting"])


def _build_response(application_id: int, results: list[MatchResult], db: Session) -> UnderwritingRunResponse:
    """Build the standard UnderwritingRunResponse from a list of MatchResults."""
    serialized = _serialize_results(results, db)
    eligible   = [r for r in serialized if r.status == "eligible"]
    ineligible = [r for r in serialized if r.status != "eligible"]
    return UnderwritingRunResponse(
        application_id=application_id,
        status="completed",
        total_lenders_checked=len(serialized),
        eligible_count=len(eligible),
        ineligible_count=len(ineligible),
        results=serialized,
    )
# endregion


# region ── 2. POST /underwriting/run/{id} ────────────────────

@router.post("/run/{application_id}", response_model=UnderwritingRunResponse)
async def run_underwriting_endpoint(application_id: int, db: Session = Depends(get_db)):
    """
    Run the matching engine for a given application.

    Evaluates all active lenders concurrently using asyncio + ThreadPoolExecutor.
    Existing results are deleted and replaced on each run (re-run safe).
    Application status is set to COMPLETED after a successful run.
    """
    try:
        results = await run_underwriting(application_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Underwriting failed: {str(e)}")

    return _build_response(application_id, results, db)

# endregion


# region ── 3. GET /underwriting/results/{id} ─────────────────

@router.get("/results/{application_id}", response_model=UnderwritingRunResponse)
def get_results(application_id: int, db: Session = Depends(get_db)):
    """
    Retrieve previously computed underwriting results.
    Returns 404 if underwriting has not been run yet for this application.
    """
    results = (
        db.query(MatchResult)
        .options(
            joinedload(MatchResult.lender),
            joinedload(MatchResult.program),
            joinedload(MatchResult.rule_results).joinedload(RuleEvaluationResult.rule),
        )
        .filter(MatchResult.application_id == application_id)
        .all()
    )
    if not results:
        raise HTTPException(
            status_code=404,
            detail="No underwriting results found. Run underwriting first.",
        )
    return _build_response(application_id, results, db)

# endregion


# region ── 4. _serialize_results() ───────────────────────────

def _serialize_results(results: list[MatchResult], db: Session) -> list[MatchResultOut]:
    """
    Convert MatchResult ORM objects into response schema objects.

    Handles lazy-loaded relationships and ensures all lender/program
    names are available for the UI without requiring deep joins.
    Results are sorted: eligible first, then by fit_score descending.
    """
    output: list[MatchResultOut] = []

    for r in results:
        # Ensure lender and program are loaded (may be lazy if not eagerly joined)
        if not r.lender:
            r.lender = db.query(Lender).filter(Lender.id == r.lender_id).first()
        if r.program_id and not r.program:
            r.program = db.query(LenderProgram).filter(LenderProgram.id == r.program_id).first()

        rule_results = (
            db.query(RuleEvaluationResult)
            .options(joinedload(RuleEvaluationResult.rule))
            .filter(RuleEvaluationResult.match_result_id == r.id)
            .all()
        )

        rr_out: list[RuleEvaluationResultOut] = []
        for rr in rule_results:
            rule_dict = None
            if rr.rule:
                rule_dict = {
                    "id":        rr.rule.id,
                    "field":     rr.rule.field,
                    "operator":  rr.rule.operator,
                    "label":     rr.rule.label,
                    "rule_type": rr.rule.rule_type,
                }
            rr_out.append(RuleEvaluationResultOut(
                id=rr.id,
                rule_id=rr.rule_id,
                passed=rr.passed,
                actual_value=rr.actual_value,
                required_value=rr.required_value,
                explanation=rr.explanation,
                rule=rule_dict,
            ))

        output.append(MatchResultOut(
            id=r.id,
            application_id=r.application_id,
            lender_id=r.lender_id,
            program_id=r.program_id,
            status=r.status,
            fit_score=r.fit_score,
            summary=r.summary,
            created_at=r.created_at,
            lender_name=r.lender.name if r.lender else None,
            program_name=r.program.name if r.program else None,
            rule_results=rr_out,
        ))

    # Eligible first, then ranked by fit_score descending
    output.sort(key=lambda x: (x.status != "eligible", -x.fit_score))
    return output

# endregion