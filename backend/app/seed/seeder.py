# ============================================================
# SEEDER — Inserts lender data from lenders_data.py into DB
# ============================================================

from sqlalchemy.orm import Session
from app.models.lender import Lender, LenderProgram, PolicyRule
from app.seed.lenders_data import LENDERS_SEED


def seed_lenders(db: Session) -> None:
    existing_names = {name for (name,) in db.query(Lender.name).all()}
    added = 0

    for lender_data in LENDERS_SEED:
        if lender_data["name"] in existing_names:
            continue  # already exists, skip

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

    if added > 0:
        db.commit()
        print(f"✅ Seeded {added} new lenders.")
    else:
        print(f"✅ All lenders already seeded. Skipping.")

    db.commit()
    print(f"✅ Seeded {len(LENDERS_SEED)} lenders successfully.")
