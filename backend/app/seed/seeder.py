# ============================================================
# SEEDER — Syncs DB with lenders_data.py on every backend startup
#
# BEHAVIOR:
#   - Lender in file but NOT in DB  → inserted
#   - Lender in DB but NOT in file  → deleted (with its programs + rules)
#   - Lender in both                → skipped (no update)
#
# This means DB always mirrors lenders_data.py exactly.
# Add a lender to the file + restart = appears in UI.
# Remove a lender from the file + restart = gone from UI.
# ============================================================

import copy
from sqlalchemy.orm import Session
from app.models.lender import Lender, LenderProgram, PolicyRule
from app.models.results import MatchResult, RuleEvaluationResult
from app.seed.lenders_data import LENDERS_SEED


def seed_lenders(db: Session) -> None:
    seed_data = copy.deepcopy(LENDERS_SEED)
    seed_names = {ld["name"] for ld in seed_data}
    existing = {name: id for id, name in db.query(Lender.id, Lender.name).all()}

    added = 0
    removed = 0

    # ── Remove lenders that are no longer in the file ──────────
    for name, lender_id in existing.items():
        if name not in seed_names:
            # Delete in FK-safe order: rule_evals → match_results → rules → programs → lender
            match_ids = [
                mid for (mid,) in
                db.query(MatchResult.id).filter(MatchResult.lender_id == lender_id).all()
            ]
            if match_ids:
                db.query(RuleEvaluationResult).filter(
                    RuleEvaluationResult.match_result_id.in_(match_ids)
                ).delete(synchronize_session=False)
                db.query(MatchResult).filter(
                    MatchResult.lender_id == lender_id
                ).delete(synchronize_session=False)

            prog_ids = [
                pid for (pid,) in
                db.query(LenderProgram.id).filter(LenderProgram.lender_id == lender_id).all()
            ]
            if prog_ids:
                db.query(PolicyRule).filter(
                    PolicyRule.program_id.in_(prog_ids)
                ).delete(synchronize_session=False)
                db.query(LenderProgram).filter(
                    LenderProgram.lender_id == lender_id
                ).delete(synchronize_session=False)

            db.query(Lender).filter(Lender.id == lender_id).delete()
            removed += 1

    # ── Insert lenders that are new in the file ─────────────────
    for lender_data in seed_data:
        if lender_data["name"] in existing:
            continue  # already in DB, skip

        programs_data = lender_data.pop("programs", [])
        lender = Lender(**lender_data)
        db.add(lender)
        db.flush()

        for prog_data in programs_data:
            rules_data = prog_data.pop("rules", [])
            program = LenderProgram(lender_id=lender.id, **prog_data)
            db.add(program)
            db.flush()

            for rule_data in rules_data:
                rule = PolicyRule(program_id=program.id, **rule_data)
                db.add(rule)

        added += 1

    # ── Commit + report ─────────────────────────────────────────
    if added > 0 or removed > 0:
        db.commit()
        parts = []
        if added:
            parts.append(f"added {added}")
        if removed:
            parts.append(f"removed {removed}")
        print(f"✅ Lender sync: {', '.join(parts)}.")
    else:
        print(f"✅ Lenders in sync. Nothing to do.")