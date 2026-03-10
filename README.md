# Kaaj Lender Matching Platform

A full-stack loan underwriting and lender matching system that evaluates business loan applications against multiple lenders' credit policies.

## Architecture Overview

```
Frontend (React + TypeScript + Tailwind)
    ↓ REST API calls via Axios
Backend (Python + FastAPI)
    ↓ SQLAlchemy ORM
Database (PostgreSQL)
```

### Key Design Decision: Data-Driven Rule Engine

Lender policies are stored as structured rows in a `policy_rules` table, NOT hardcoded in Python. Each rule has:
- `field` — what to check (e.g. `fico_score`)
- `operator` — how to compare (`gte`, `lte`, `not_in`, etc.)
- `value` — the threshold

**Adding a new lender = inserting DB rows. No code changes required.**

### Folder Structure

```
kaaj-lender-matching/
├── backend/
│   └── app/
│       ├── api/          # Route handlers (thin, no business logic)
│       ├── core/         # Config, DB session
│       ├── models/       # SQLAlchemy models
│       ├── schemas/      # Pydantic request/response models
│       ├── services/     # Business logic
│       │   ├── rule_evaluator.py    # Single rule evaluation
│       │   └── matching_engine.py  # Orchestrates all lenders
│       ├── seed/         # Seeder + lender data from PDFs
│       └── tests/        # Pytest unit tests
└── frontend/
    └── src/
        ├── api/          # Axios API calls (one file per domain)
        ├── components/
        │   ├── ui/       # Generic: Button, Card, Badge, Input, Select
        │   └── domain/   # LenderMatchCard, RuleResultRow
        ├── pages/        # Route-level page components
        └── types/        # TypeScript interfaces
```

## Local Development Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL 14+

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure database
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# Create the database
createdb kaaj_lender_matching

# Run the server (tables are auto-created + lenders auto-seeded on startup)
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`
Auto-generated docs at `http://localhost:8000/docs`

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

The frontend will be available at `http://localhost:5173`

### Run Tests

```bash
cd backend
pytest app/tests/ -v
```

## API Documentation

### Applications

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/applications/` | List all applications |
| `POST` | `/api/v1/applications/` | Create new application |
| `GET` | `/api/v1/applications/{id}` | Get application by ID |
| `PUT` | `/api/v1/applications/{id}` | Update application |
| `DELETE` | `/api/v1/applications/{id}` | Delete application |

### Lenders

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/lenders/` | List all lenders with programs + rules |
| `POST` | `/api/v1/lenders/` | Create lender |
| `GET` | `/api/v1/lenders/{id}` | Get lender by ID |
| `PUT` | `/api/v1/lenders/{id}` | Update lender |
| `DELETE` | `/api/v1/lenders/{id}` | Delete lender |
| `POST` | `/api/v1/lenders/{id}/programs` | Add program to lender |
| `PUT` | `/api/v1/lenders/programs/{id}` | Update program |
| `DELETE` | `/api/v1/lenders/programs/{id}` | Delete program |
| `POST` | `/api/v1/lenders/programs/{id}/rules` | Add rule to program |
| `PUT` | `/api/v1/lenders/rules/{id}` | Update rule |
| `DELETE` | `/api/v1/lenders/rules/{id}` | Delete rule |

### Underwriting

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/underwriting/run/{application_id}` | Run matching engine |
| `GET` | `/api/v1/underwriting/results/{application_id}` | Get stored results |

## How the Matching Engine Works

1. Load application → flatten into context dict
2. Load all active lenders + programs + rules from DB
3. Run all lenders **concurrently** via `asyncio.gather()`
4. Per lender: try programs in priority order, find best eligible match
5. Per program: evaluate every rule using `rule_evaluator.py`
6. Calculate fit score (0–100): starts at 100, soft failures deduct points
7. Persist `MatchResult` + `RuleEvaluationResult` per rule to DB
8. Return ranked results (eligible first, sorted by fit score)

## Adding a New Lender

Two options:
1. **Via API**: `POST /api/v1/lenders/` with programs and rules in the request body
2. **Via seed data**: Add entry to `backend/app/seed/lenders_data.py` and re-seed

No code changes to the matching engine are needed.
