# Kaaj Lender Matching Platform

A full-stack loan underwriting and lender matching system. You submit a business loan application and it instantly evaluates eligibility across all active lenders, ranks the matches by fit score, and shows exactly which rules passed or failed for each one.

## Architecture Overview

```
Frontend (React + TypeScript + Tailwind)
    ↓ REST API via Axios
Backend (Python + FastAPI)
    ↓ SQLAlchemy ORM
Database (PostgreSQL)
```

The core idea is a data-driven rule engine. Lender policies live in a `policy_rules` table as structured rows — not Python conditionals. Each rule has a `field` (e.g. `fico_score`), an `operator` (e.g. `gte`), and a `value`. The matching engine reads rules from the database and evaluates them; it never needs to change when you add or edit a lender.

```
Lender
  └── LenderProgram  (e.g. "A+ Rate", "Tier 1 — Full Credit", "Trucking A/B")
        └── PolicyRule  (field / operator / value)
```

### Project Structure

```
kaaj-lender-matching/
├── backend/
│   └── app/
│       ├── api/          # Route handlers — thin wrappers, no business logic
│       ├── core/         # Config, DB session factory
│       ├── models/       # SQLAlchemy models (application, lender, results)
│       ├── schemas/      # Pydantic request/response schemas
│       ├── services/
│       │   ├── rule_evaluator.py   # Evaluates one PolicyRule against a context dict
│       │   └── matching_engine.py  # Orchestrates all lenders concurrently
│       ├── seed/
│       │   ├── lenders_data.py     # Source of truth for all lender policies
│       │   └── seeder.py           # Syncs DB to lenders_data.py on startup
│       └── tests/
└── frontend/
    └── src/
        ├── api/          # Axios calls, one file per domain
        ├── components/
        │   ├── ui/       # Button, Card, Badge, Input, Select, PageTOC
        │   └── domain/   # LenderMatchCard, RuleResultRow
        ├── pages/        # Route-level components
        └── types/        # TypeScript interfaces
```

## Local Setup

### Prerequisites

Python 3.10+, Node.js 18+, PostgreSQL 14+

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt

# Copy and edit the env file with your Postgres credentials
cp .env.example .env

# Create the database
createdb kaaj_lender_matching

# Start the server — tables are auto-created and lenders are auto-seeded on startup
uvicorn app.main:app --reload --port 8000
```

API runs at `http://localhost:8000`. Interactive docs at `http://localhost:8000/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at `http://localhost:5173`.

### Tests

```bash
cd backend
pytest app/tests/ -v
```

---

## Adding a New Lender from a PDF

The system is designed so that adding a lender never requires touching the matching engine or any API code. The entire workflow is:

**1. Read the PDF and identify the credit box**

Look for the key criteria the lender uses to approve or reject a deal. For each lender you need to extract:

- Minimum FICO score (sometimes per tier)
- Minimum PayNet or business credit score (if required)
- Minimum time in business
- Loan amount range (min/max)
- Any geographic restrictions (states they won't do)
- Industry or equipment exclusions
- Derogatory flag rules (bankruptcy lookback, tax liens, judgements, etc.)
- Whether homeownership is required
- Any program-specific conditions (startup program, medical, trucking, etc.)

**2. Map each criterion to a rule**

Every criterion becomes one `PolicyRule` with three fields:

| PDF says | field | operator | value |
|---|---|---|---|
| "Min FICO 700" | `fico_score` | `gte` | `700` |
| "No CA, NV" | `business_state` | `not_in` | `"CA,NV"` |
| "No bankruptcy last 7 years" | `has_bankruptcy` | `eq` | `False` |
| "Loan $10K–$500K" | `loan_amount` | `between` | `10000 / 500000` |
| "No trucking" | `equipment_type` | `not_in` | `"Trucking,OTR,Semi"` |

If a criterion is a hard disqualifier — any violation means instant rejection — set `rule_type` to `"hard"`. If it's a preference or scoring factor, set it to `"soft"`. Soft failures reduce the fit score but don't disqualify.

The full set of available fields is in `app/models/lender.py` under `RuleField`. Available operators are `gte`, `lte`, `gt`, `lt`, `eq`, `neq`, `in`, `not_in`, `between`.

**3. Add the lender to lenders_data.py**

Open `backend/app/seed/lenders_data.py` and add an entry to the `LENDERS_SEED` list. Follow the existing structure — each lender has a name, optional description and contact info, and a list of programs. Each program has a name, priority (lower number = tried first), optional rate range, and a list of rules.

```python
{
    "name": "Your New Lender",
    "description": "Short description from the PDF",
    "contact_name": "John Smith",
    "contact_email": "credit@yourlender.com",
    "programs": [
        {
            "name": "Standard",
            "description": "FICO 700+, 3yr TIB",
            "priority": 1,
            "min_rate": 7.50,
            "max_rate": 9.00,
            "rules": [
                {"field": "fico_score", "operator": "gte", "value_numeric": 700,
                 "rule_type": "hard", "label": "Min FICO Score", "score_weight": 20},
                {"field": "time_in_business_years", "operator": "gte", "value_numeric": 3,
                 "rule_type": "hard", "label": "Min Time in Business (years)", "score_weight": 15},
                {"field": "has_bankruptcy", "operator": "eq", "value_boolean": False,
                 "rule_type": "hard", "label": "No Bankruptcy", "score_weight": 25},
            ],
        },
    ],
},
```

If the lender has multiple tiers (like Apex with A+/A/B/C), add one program per tier. Set `priority` so the best/strictest program is tried first.

**4. Restart the backend**

The seeder runs on startup and syncs the database to `lenders_data.py`. New lenders are inserted, removed ones are deleted, existing ones are left alone. You'll see a log line like:

```
✅ Lender sync: added 1.
```

The new lender will appear in the UI immediately and will be evaluated on every subsequent underwriting run. No other changes needed — the matching engine queries all active lenders from the database dynamically.

**5. Alternatively, use the API or UI**

If you'd rather not edit Python:

- In the UI: go to Lenders, click "Add New Lender", and use the wizard to enter the lender details and programs. Rules can be added to each program from the same page.
- Via API: `POST /api/v1/lenders/` with the full lender JSON (including programs and rules nested). See the API docs below or visit `/docs` for the interactive schema.

The seed file approach is better for onboarding a lender with many rules (it's easier to review a dict than fill out a form 30 times). The UI approach is better for quick edits to existing lenders — adding a rule, adjusting a threshold, or toggling a program off.

---

## API Reference

### Applications

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/applications/` | List all applications |
| POST | `/api/v1/applications/` | Create new application |
| GET | `/api/v1/applications/{id}` | Get application by ID |
| PUT | `/api/v1/applications/{id}` | Update application |
| DELETE | `/api/v1/applications/{id}` | Delete application |

### Lenders

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/v1/lenders/` | List all lenders with programs and rules |
| POST | `/api/v1/lenders/` | Create lender (with programs and rules) |
| GET | `/api/v1/lenders/{id}` | Get lender by ID |
| PUT | `/api/v1/lenders/{id}` | Update lender fields |
| DELETE | `/api/v1/lenders/{id}` | Delete lender |
| POST | `/api/v1/lenders/{id}/programs` | Add program to lender |
| PUT | `/api/v1/lenders/programs/{id}` | Update program |
| DELETE | `/api/v1/lenders/programs/{id}` | Delete program |
| POST | `/api/v1/lenders/programs/{id}/rules` | Add rule to program |
| PUT | `/api/v1/lenders/rules/{id}` | Update rule |
| DELETE | `/api/v1/lenders/rules/{id}` | Delete rule |

### Underwriting

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/v1/underwriting/run/{application_id}` | Run the matching engine |
| GET | `/api/v1/underwriting/results/{application_id}` | Fetch stored results |

---

## How the Matching Engine Works

1. Load the application and flatten it into a flat context dict — every field the rules reference lives at the top level (e.g. `{"fico_score": 720, "business_state": "TX", ...}`).
2. Load all active lenders and their programs and rules from the database.
3. Fan out: evaluate all lenders concurrently using `asyncio.gather()` with a thread pool. Each lender's evaluation is pure CPU-bound logic with no shared state, so threads are safe.
4. Per lender: walk programs in priority order. For each program, evaluate every rule using `rule_evaluator.py`. If any hard rule fails, the program is ineligible. Find the highest-scoring eligible program.
5. Calculate fit score: start at 100, subtract proportionally for failing soft rules (max deduction 40 points), add up to 5 points margin bonus for applicants who significantly exceed minimums.
6. For ineligible lenders: show the "closest attempt" — the program with the fewest hard failures, so the broker can see exactly what needs to change.
7. Persist one `MatchResult` per lender and one `RuleEvaluationResult` per rule to the database.
8. Return results sorted by eligibility first, then fit score descending.
