# ============================================================
# api/lenders.py — Lenders REST API
#
# TABLE OF CONTENTS
#   1. Router Setup
#   2. Lender CRUD        GET / POST / GET {id} / PUT {id} / DELETE {id}
#   3. Program CRUD       POST {lender_id}/programs / PUT programs/{id} / DELETE programs/{id}
#   4. Policy Rule CRUD   POST programs/{id}/rules / PUT rules/{id} / DELETE rules/{id}
# ============================================================

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.database import get_db
from app.models.lender import Lender, LenderProgram, PolicyRule
from app.schemas.lender import (
    LenderCreate, LenderOut, LenderUpdate,
    LenderProgramCreate, LenderProgramOut, LenderProgramUpdate,
    PolicyRuleCreate, PolicyRuleOut, PolicyRuleUpdate,
)


# region ── 1. Router Setup ───────────────────────────────────
router = APIRouter(prefix="/lenders", tags=["Lenders"])


def _load_lender_with_programs(lender_id: int, db: Session) -> Lender:
    """Reusable loader — raises 404 if not found."""
    lender = (
        db.query(Lender)
        .options(joinedload(Lender.programs).joinedload(LenderProgram.rules))
        .filter(Lender.id == lender_id)
        .first()
    )
    if not lender:
        raise HTTPException(status_code=404, detail="Lender not found")
    return lender
# endregion


# region ── 2. Lender CRUD ────────────────────────────────────

@router.get("/", response_model=list[LenderOut])
def list_lenders(db: Session = Depends(get_db)):
    """List all lenders with their programs and rules."""
    return (
        db.query(Lender)
        .options(joinedload(Lender.programs).joinedload(LenderProgram.rules))
        .all()
    )


@router.post("/", response_model=LenderOut, status_code=201)
def create_lender(payload: LenderCreate, db: Session = Depends(get_db)):
    """Create a lender with programs and rules in a single request."""
    lender = Lender(**payload.model_dump(exclude={"programs"}))
    db.add(lender)
    db.flush()

    for prog_data in payload.programs:
        program = LenderProgram(lender_id=lender.id, **prog_data.model_dump(exclude={"rules"}))
        db.add(program)
        db.flush()
        for rule_data in prog_data.rules:
            db.add(PolicyRule(program_id=program.id, **rule_data.model_dump()))

    db.commit()
    db.refresh(lender)
    return lender


@router.get("/{lender_id}", response_model=LenderOut)
def get_lender(lender_id: int, db: Session = Depends(get_db)):
    """Get a single lender with all programs and rules."""
    return _load_lender_with_programs(lender_id, db)


@router.put("/{lender_id}", response_model=LenderOut)
def update_lender(lender_id: int, payload: LenderUpdate, db: Session = Depends(get_db)):
    """Update lender-level fields (name, description, is_active, contacts)."""
    lender = db.query(Lender).filter(Lender.id == lender_id).first()
    if not lender:
        raise HTTPException(status_code=404, detail="Lender not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(lender, k, v)
    db.commit()
    db.refresh(lender)
    return lender


@router.delete("/{lender_id}", status_code=204)
def delete_lender(lender_id: int, db: Session = Depends(get_db)):
    """Delete a lender and all its programs and rules (cascades)."""
    lender = db.query(Lender).filter(Lender.id == lender_id).first()
    if not lender:
        raise HTTPException(status_code=404, detail="Lender not found")
    db.delete(lender)
    db.commit()

# endregion


# region ── 3. Program CRUD ───────────────────────────────────

@router.post("/{lender_id}/programs", response_model=LenderProgramOut, status_code=201)
def add_program(lender_id: int, payload: LenderProgramCreate, db: Session = Depends(get_db)):
    """Add a new program (with optional rules) to an existing lender."""
    if not db.query(Lender).filter(Lender.id == lender_id).first():
        raise HTTPException(status_code=404, detail="Lender not found")

    program = LenderProgram(lender_id=lender_id, **payload.model_dump(exclude={"rules"}))
    db.add(program)
    db.flush()

    for rule_data in payload.rules:
        db.add(PolicyRule(program_id=program.id, **rule_data.model_dump()))

    db.commit()
    db.refresh(program)
    return program


@router.put("/programs/{program_id}", response_model=LenderProgramOut)
def update_program(program_id: int, payload: LenderProgramUpdate, db: Session = Depends(get_db)):
    """Update program-level fields (name, rate, priority, is_active)."""
    program = db.query(LenderProgram).filter(LenderProgram.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(program, k, v)
    db.commit()
    db.refresh(program)
    return program


@router.delete("/programs/{program_id}", status_code=204)
def delete_program(program_id: int, db: Session = Depends(get_db)):
    """Delete a program and all its rules (cascades)."""
    program = db.query(LenderProgram).filter(LenderProgram.id == program_id).first()
    if not program:
        raise HTTPException(status_code=404, detail="Program not found")
    db.delete(program)
    db.commit()

# endregion


# region ── 4. Policy Rule CRUD ───────────────────────────────

@router.post("/programs/{program_id}/rules", response_model=PolicyRuleOut, status_code=201)
def add_rule(program_id: int, payload: PolicyRuleCreate, db: Session = Depends(get_db)):
    """Add a new policy rule to an existing program."""
    if not db.query(LenderProgram).filter(LenderProgram.id == program_id).first():
        raise HTTPException(status_code=404, detail="Program not found")
    rule = PolicyRule(program_id=program_id, **payload.model_dump())
    db.add(rule)
    db.commit()
    db.refresh(rule)
    return rule


@router.put("/rules/{rule_id}", response_model=PolicyRuleOut)
def update_rule(rule_id: int, payload: PolicyRuleUpdate, db: Session = Depends(get_db)):
    """Update a policy rule's value, label, or type."""
    rule = db.query(PolicyRule).filter(PolicyRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    for k, v in payload.model_dump(exclude_unset=True).items():
        setattr(rule, k, v)
    db.commit()
    db.refresh(rule)
    return rule


@router.delete("/rules/{rule_id}", status_code=204)
def delete_rule(rule_id: int, db: Session = Depends(get_db)):
    """Delete a single policy rule."""
    rule = db.query(PolicyRule).filter(PolicyRule.id == rule_id).first()
    if not rule:
        raise HTTPException(status_code=404, detail="Rule not found")
    db.delete(rule)
    db.commit()

# endregion