# Architecture & Design Decisions

## 1. Data-Driven Rule Engine (Most Important Decision)

**Decision**: Store lender policy rules as rows in a `policy_rules` table with `field`, `operator`, and `value` columns — not hardcoded Python logic.

**Why**: The assignment explicitly requires extensibility. A hardcoded approach like:
```python
if lender_name == "Stearns":
    if fico < 700: reject()
```
...would require code changes for every edit. With the rule engine:
- Adding a lender = inserting rows into the DB (API call or seed data)
- Editing a minimum FICO = updating one row
- The matching engine code never changes

**Trade-off**: More complex initial setup. Worth it entirely for the stated requirements.

---

## 2. Program → Tier Architecture

**Decision**: Model each lender as having multiple `LenderProgram` records (tiers), evaluated in priority order.

**Why**: Lenders like Apex have A+, A, B, C, Medical-A, and Corp tiers. A borrower might not qualify for A but qualify for B. The engine tries programs in priority order and returns the best match.

---

## 3. asyncio.gather for Parallelism

**Decision**: Use `asyncio.gather()` to evaluate all lenders concurrently.

**Why**: All lender evaluations are independent — there's no reason to run them sequentially. This is the Hatchet parallelization pattern implemented natively in FastAPI. Runs 5 lenders in ~parallel instead of serially.

**What Hatchet would add**: Persistent job state, retry with exponential backoff, dead letter queues, observability UI. Documented as a V2 enhancement.

---

## 4. Fit Score Formula

**Decision**: Start at 100, subtract proportionally for failing soft rules. Hard failures = 0.

**Formula**:
- Eligible (no hard failures): `100 - (soft_failures_weight / total_soft_weight * 40)` + up to 5pt margin bonus
- Ineligible (any hard failure): `0`

**Why**: Simple, explainable, and maps to business intuition. A score of 85 means "strong match, slight soft rule misses." A score of 0 means "disqualified."

---

## 5. Lender Policy Prioritizations from PDFs

### Stearns Bank
- Modeled all 3 tiers (full credit) + Corp Only tier
- Revolver utilization as a hard rule (>$30K revolving = fail)
- Industry exclusions as `not_in` rule

### Apex Commercial Capital
- Modeled A+, A, B, C tiers + Medical-A program
- Geographic exclusion (CA, NV, ND, VT) as hard rule
- Equipment exclusions as `not_in` rule on equipment_type
- A+ max collateral age = 5 years modeled as equipment_age_years rule

### Advantage+ Financing
- Non-trucking only — modeled as `not_in` rule on equipment_type
- All derogatory flags (bankruptcy, judgement, foreclosure, repo, tax lien, collections) as hard rules
- 80% comparable credit as a **soft** rule (preferred but not disqualifying)
- Startup program as separate program requiring is_startup=true

### Citizens Bank
- 3 tiers based on homeownership and loan amount
- TransUnion score mapped to FICO field (same numeric concept)
- Complex vehicle/mileage matrix simplified: mileage check only for app-only tier

### Falcon Equipment Finance
- A/B/C credit tiers based on FICO thresholds
- 15-year bankruptcy lookback (stricter than others)
- Comparable credit 70% threshold as hard rule
- Trucking-specific rules documented but not fully modeled in V1 (see V2)

---

## 6. Simplifications Made

- **Citizens Bank vehicle age/mileage matrix**: The PDF has a complex matrix (e.g. Class 8 trucks: 0-200K mi = 60 months, 200K-400K = 48 months). V1 captures high-level eligibility. V2 would model term determination.
- **Falcon trucking special requirements**: "5+ trucks operating" requires operational data not in the loan app form. V1 checks base credit requirements only.
- **Comparable debt (Stearns)**: "3+ contracts $10K+ in last 12 months" is a complex bureau check. Modeled as comparable_credit_pct percentage instead.
- **Apex revolving utilization**: "50% revolving available" simplified to revolving_debt check.

---

## 7. What I Would Add With More Time

### V2 Features
1. **PDF Auto-Parsing**: Use Claude/GPT to extract structured rules from uploaded PDF guidelines automatically — no manual data entry for new lenders
2. **Hatchet Integration**: Replace `asyncio.gather` with Hatchet for production-grade workflow management (retry, observability, dead letter queues)
3. **Full Mileage/Age Matrix**: Model Citizens Bank's vehicle age × mileage → term matrix
4. **Authentication**: JWT-based auth, broker vs admin roles
5. **Audit Trail**: Track every policy rule change with timestamp and user
6. **Rate Calculation**: Display estimated rates alongside eligibility (Falcon, Apex already have rate tables)
7. **Bulk Import**: CSV/JSON upload for adding multiple lenders at once
8. **Analytics Dashboard**: Approval rates by lender, common rejection reasons
