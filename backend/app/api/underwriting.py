# ============================================================
# UNDERWRITING API — Run matching engine + retrieve results
# ============================================================

from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.results import MatchResult, RuleEvaluationResult
from app.models.lender import Lender, LenderProgram, PolicyRule
from app.schemas.results import UnderwritingRunResponse, MatchResultOut, RuleEvaluationResultOut
from app.services.matching_engine import run_underwriting

router = APIRouter(prefix="/underwriting", tags=["Underwriting"])


@router.post("/run/{application_id}", response_model=UnderwritingRunResponse)
async def run_underwriting_endpoint(application_id: int, db: Session = Depends(get_db)):
    """
    Run the matching engine for a given application.
    Evaluates all active lenders concurrently and persists results.
    """
    try:
        results = await run_underwriting(application_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Underwriting failed: {str(e)}")

    eligible = [r for r in results if r.status == "eligible"]
    ineligible = [r for r in results if r.status != "eligible"]

    return UnderwritingRunResponse(
        application_id=application_id,
        status="completed",
        total_lenders_checked=len(results),
        eligible_count=len(eligible),
        ineligible_count=len(ineligible),
        results=_serialize_results(results, db)
    )


@router.get("/results/{application_id}", response_model=UnderwritingRunResponse)
def get_results(application_id: int, db: Session = Depends(get_db)):
    """Retrieve previously run underwriting results for an application."""
    results = db.query(MatchResult).options(
        joinedload(MatchResult.lender),
        joinedload(MatchResult.program),
        joinedload(MatchResult.rule_results).joinedload(RuleEvaluationResult.rule)
    ).filter(MatchResult.application_id == application_id).all()

    if not results:
        raise HTTPException(status_code=404, detail="No underwriting results found. Run underwriting first.")

    eligible = [r for r in results if r.status == "eligible"]
    ineligible = [r for r in results if r.status != "eligible"]

    return UnderwritingRunResponse(
        application_id=application_id,
        status="completed",
        total_lenders_checked=len(results),
        eligible_count=len(eligible),
        ineligible_count=len(ineligible),
        results=_serialize_results(results, db)
    )


def _serialize_results(results: list[MatchResult], db: Session) -> list[MatchResultOut]:
    output = []
    for r in results:
        # Ensure lender and program are loaded
        if not r.lender:
            r.lender = db.query(Lender).filter(Lender.id == r.lender_id).first()
        if r.program_id and not r.program:
            r.program = db.query(LenderProgram).filter(LenderProgram.id == r.program_id).first()

        rule_results = db.query(RuleEvaluationResult).options(
            joinedload(RuleEvaluationResult.rule)
        ).filter(RuleEvaluationResult.match_result_id == r.id).all()

        rr_out = []
        for rr in rule_results:
            rule_dict = None
            if rr.rule:
                rule_dict = {
                    "id": rr.rule.id,
                    "field": rr.rule.field,
                    "operator": rr.rule.operator,
                    "label": rr.rule.label,
                    "rule_type": rr.rule.rule_type,
                }
            rr_out.append(RuleEvaluationResultOut(
                id=rr.id,
                rule_id=rr.rule_id,
                passed=rr.passed,
                actual_value=rr.actual_value,
                required_value=rr.required_value,
                explanation=rr.explanation,
                rule=rule_dict
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
            rule_results=rr_out
        ))

    # Sort: eligible first, then by fit_score desc
    output.sort(key=lambda x: (x.status != "eligible", -x.fit_score))
    return output
