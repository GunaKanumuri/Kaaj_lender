# ============================================================
# seed/seeder.py — Lender Database Sync
#
# TABLE OF CONTENTS
#   1. Imports
#   2. seed_lenders()            — main entry point
#   3. _remove_stale()           — delete lenders no longer in file
#   4. _insert_new()             — insert lenders new to the file
#   5. _delete_lender_fk_safe()  — FK-ordered delete for one lender
#
# BEHAVIOR (runs on every backend startup via main.py):
#   - Lender in file but NOT in DB  → inserted (programs + rules)
#   - Lender in DB but NOT in file  → deleted  (FK-safe cascade)
#   - Lender in both                → skipped  (no update)
#
# WHY THIS APPROACH:
#   The DB always mirrors lenders_data.py exactly.
#   Adding a lender = edit the file + restart backend.
#   Removing a lender = remove from file + restart backend.
#   No manual SQL or migration scripts required.
#
# FK DELETE ORDER (critical — violating this causes IntegrityError):
#   rule_evaluation_results → match_results → policy_rules → lender_programs → lenders
# ============================================================

# region ── 1. Imports ────────────────────────────────────────
import copy

from sqlalchemy.orm import Session

from app.models.lender import Lender, LenderProgram, PolicyRule
from app.models.results import MatchResult, RuleEvaluationResult
from app.seed.lenders_data import LENDERS_SEED
# endregion


# region ── 2. seed_lenders() ─────────────────────────────────

def seed_lenders(db: Session) -> None:
    """
    Sync the lenders table with LENDERS_SEED on startup.

    Uses deepcopy so that .pop() calls during insertion don't
    mutate the module-level LENDERS_SEED constant.
    """
    seed_data  = copy.deepcopy(LENDERS_SEED)
    seed_names = {ld["name"] for ld in seed_data}
    existing   = {name: lender_id for lender_id, name in db.query(Lender.id, Lender.name).all()}

    removed = _remove_stale(db, existing, seed_names)
    added   = _insert_new(db, seed_data, existing)

    if added > 0 or removed > 0:
        db.commit()
        parts = []
        if added:   parts.append(f"added {added}")
        if removed: parts.append(f"removed {removed}")
        print(f"✅ Lender sync: {', '.join(parts)}.")
    else:
        print("✅ Lenders in sync. Nothing to do.")

# endregion


# region ── 3. _remove_stale() ────────────────────────────────

def _remove_stale(db: Session, existing: dict[str, int], seed_names: set[str]) -> int:
    """
    Delete any lender in the DB whose name is no longer in the seed file.
    Returns the number of lenders removed.
    """
    removed = 0
    for name, lender_id in existing.items():
        if name not in seed_names:
            _delete_lender_fk_safe(db, lender_id)
            removed += 1
    return removed

# endregion


# region ── 4. _insert_new() ──────────────────────────────────

def _insert_new(db: Session, seed_data: list[dict], existing: dict[str, int]) -> int:
    """
    Insert any lender in the seed file that is not yet in the DB.
    Inserts the lender, then its programs, then each program's rules.
    Returns the number of lenders inserted.
    """
    added = 0
    for lender_data in seed_data:
        if lender_data["name"] in existing:
            continue  # already in DB — skip

        programs_data = lender_data.pop("programs", [])
        lender = Lender(**lender_data)
        db.add(lender)
        db.flush()  # get lender.id before inserting children

        for prog_data in programs_data:
            rules_data = prog_data.pop("rules", [])
            program = LenderProgram(lender_id=lender.id, **prog_data)
            db.add(program)
            db.flush()  # get program.id before inserting rules

            for rule_data in rules_data:
                db.add(PolicyRule(program_id=program.id, **rule_data))

        added += 1
    return added

# endregion


# region ── 5. _delete_lender_fk_safe() ───────────────────────

def _delete_lender_fk_safe(db: Session, lender_id: int) -> None:
    """
    Delete one lender and all its dependent records in FK-safe order.

    Deletion order (child → parent to avoid IntegrityError):
      1. rule_evaluation_results  (references match_results)
      2. match_results            (references lenders)
      3. policy_rules             (references lender_programs)
      4. lender_programs          (references lenders)
      5. lender
    """
    # ── Step 1 & 2: underwriting results ─────────────────────
    match_ids = [
        mid for (mid,) in
        db.query(MatchResult.id)
          .filter(MatchResult.lender_id == lender_id)
          .all()
    ]
    if match_ids:
        db.query(RuleEvaluationResult).filter(
            RuleEvaluationResult.match_result_id.in_(match_ids)
        ).delete(synchronize_session=False)

        db.query(MatchResult).filter(
            MatchResult.lender_id == lender_id
        ).delete(synchronize_session=False)

    # ── Step 3 & 4: programs and their rules ─────────────────
    prog_ids = [
        pid for (pid,) in
        db.query(LenderProgram.id)
          .filter(LenderProgram.lender_id == lender_id)
          .all()
    ]
    if prog_ids:
        db.query(PolicyRule).filter(
            PolicyRule.program_id.in_(prog_ids)
        ).delete(synchronize_session=False)

        db.query(LenderProgram).filter(
            LenderProgram.lender_id == lender_id
        ).delete(synchronize_session=False)

    # ── Step 5: the lender itself ─────────────────────────────
    db.query(Lender).filter(Lender.id == lender_id).delete()

# endregion