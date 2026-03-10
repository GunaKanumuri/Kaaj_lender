# ============================================================
# SEED DATA — All 5 lenders (v2, all corrections applied)
#
# FIXES vs v1:
#  FIX-1  Stearns:  Added Corp Only Tier 2+3 (only Tier 1 existed)
#                   Added PayNet-Only Tier 1/2/3 (Scenario C entirely missing)
#  FIX-2  Apex:     Removed paynet_score from C Rate (FICO-only at that tier)
#                   Added Medical B program (FICO 670+, 2yr licensed)
#                   Added Corp Only program ($3M+ revenue, full financials)
#  FIX-3  Citizens: Non-Homeowner had is_homeowner=True — flipped to False
#                   Added years_at_residence >= 5 rule (was missing entirely)
#                   Added Tier 3 ($75K–$1M, full financials) — completely absent
#                   Tier 2: added 5yr industry experience as soft rule
#  FIX-4  Advantage+: is_startup=True gate added to Startup program
#                     Added soft rules: 7yr trade history preference
#  FIX-5  Falcon:   Added Trucking-specific program (FICO 700, PayNet 680,
#                   5yr TIB, equipment ≤10yr) — trucking was completely unaddressed
#                   PayNet null handling moved to rule_evaluator.py (OPTIONAL_FIELDS)
# ============================================================

_STEARNS_EXCLUDED = (
    "Gaming,Gambling,Hazmat,Oil & Gas,MSB,Adult Entertainment,"
    "Weapons,Beauty Salon,Tanning Salon,Tattoo,Real Estate,Restaurant,Car Wash"
)
_APEX_EXCLUDED_STATES = "CA,NV,ND,VT"
_APEX_EXCLUDED_EQUIP = (
    "Aircraft,Boat,ATM,Audio Visual,Cannabis,Casino,Gambling,Church,"
    "Non-profit,Copier,Electric Vehicle,Furniture,Kiosk,Logging,"
    "Nail Salon,Oil Gas,Signage,Tanning Bed,Trucking"
)
_TRUCKING = "Trucking,OTR,Semi,Tractor Trailer,Class 8"


LENDERS_SEED = [

    # ============================================================
    # 1. STEARNS BANK
    # Three scenarios from the PDF:
    #   Scenario A — Full Credit (FICO + PayNet)          programs 1–3
    #   Scenario B — Corp Only  (FICO only, no PayNet)    programs 4–6  [FIX-1]
    #   Scenario C — PayNet Only (no FICO required)       programs 7–9  [FIX-1]
    # ============================================================
    {
        "name": "Stearns Bank",
        "description": (
            "Equipment Finance Credit Box. Three scenarios: "
            "Full Credit (FICO+PayNet), Corp Only (FICO only), PayNet Only (no FICO)."
        ),
        "contact_name": "Stearns Bank Equipment Finance",
        "programs": [

            # ── Scenario A: Full Credit ─────────────────────────────────
            {
                "name": "Tier 1 — Full Credit",
                "description": "FICO 725+, PayNet 685+, 3yr TIB",
                "priority": 1,
                "rules": [
                    {"field": "fico_score",                   "operator": "gte",    "value_numeric": 725,   "rule_type": "hard", "label": "Min FICO Score",                 "score_weight": 20},
                    {"field": "paynet_score",                  "operator": "gte",    "value_numeric": 685,   "rule_type": "hard", "label": "Min PayNet Score",               "score_weight": 20},
                    {"field": "time_in_business_years",        "operator": "gte",    "value_numeric": 3,     "rule_type": "hard", "label": "Min Time in Business (years)",   "score_weight": 15},
                    {"field": "has_bankruptcy",                "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (last 7 yrs)",     "score_weight": 25},
                    {"field": "revolving_debt",                "operator": "lte",    "value_numeric": 30000, "rule_type": "hard", "label": "Revolving Debt ≤ $30K",          "score_weight": 10},
                    {"field": "revolving_plus_unsecured_debt", "operator": "lte",    "value_numeric": 50000, "rule_type": "hard", "label": "Revolving + Unsecured ≤ $50K",   "score_weight": 10},
                    {"field": "industry",                      "operator": "not_in", "value_list": _STEARNS_EXCLUDED, "rule_type": "hard", "label": "Industry Not Excluded", "score_weight": 25},
                    {"field": "is_us_citizen",                 "operator": "eq",     "value_boolean": True,  "rule_type": "hard", "label": "US Resident Required",           "score_weight": 10},
                ],
            },
            {
                "name": "Tier 2 — Full Credit",
                "description": "FICO 710+, PayNet 675+, 3yr TIB",
                "priority": 2,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",    "value_numeric": 710,   "rule_type": "hard", "label": "Min FICO Score",                 "score_weight": 20},
                    {"field": "paynet_score",           "operator": "gte",    "value_numeric": 675,   "rule_type": "hard", "label": "Min PayNet Score",               "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 3,     "rule_type": "hard", "label": "Min Time in Business (years)",   "score_weight": 15},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (last 7 yrs)",     "score_weight": 25},
                    {"field": "revolving_debt",         "operator": "lte",    "value_numeric": 30000, "rule_type": "hard", "label": "Revolving Debt ≤ $30K",          "score_weight": 10},
                    {"field": "industry",               "operator": "not_in", "value_list": _STEARNS_EXCLUDED, "rule_type": "hard", "label": "Industry Not Excluded", "score_weight": 25},
                ],
            },
            {
                "name": "Tier 3 — Full Credit",
                "description": "FICO 700+, PayNet 665+, 2yr TIB",
                "priority": 3,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",    "value_numeric": 700,   "rule_type": "hard", "label": "Min FICO Score",                 "score_weight": 20},
                    {"field": "paynet_score",           "operator": "gte",    "value_numeric": 665,   "rule_type": "hard", "label": "Min PayNet Score",               "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 2,     "rule_type": "hard", "label": "Min Time in Business (years)",   "score_weight": 15},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (last 7 yrs)",     "score_weight": 25},
                    {"field": "revolving_debt",         "operator": "lte",    "value_numeric": 30000, "rule_type": "hard", "label": "Revolving Debt ≤ $30K",          "score_weight": 10},
                    {"field": "industry",               "operator": "not_in", "value_list": _STEARNS_EXCLUDED, "rule_type": "hard", "label": "Industry Not Excluded", "score_weight": 25},
                ],
            },

            # ── Scenario B: Corp Only — no PayNet required ──────────────
            # FIX-1: v1 only had Tier 1. PDF has Tier 1/2/3 for this scenario.
            {
                "name": "Corp Only — Tier 1 (No PayNet)",
                "description": "No PayNet. FICO 735+, 5yr TIB",
                "priority": 4,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",    "value_numeric": 735,   "rule_type": "hard", "label": "Min FICO Score (Corp Only)",    "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 5,     "rule_type": "hard", "label": "Min Time in Business (years)", "score_weight": 15},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (last 7 yrs)",   "score_weight": 25},
                    {"field": "industry",               "operator": "not_in", "value_list": _STEARNS_EXCLUDED, "rule_type": "hard", "label": "Industry Not Excluded", "score_weight": 25},
                ],
            },
            {
                "name": "Corp Only — Tier 2 (No PayNet)",
                "description": "No PayNet. FICO 720+, 3yr TIB",
                "priority": 5,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",    "value_numeric": 720,   "rule_type": "hard", "label": "Min FICO Score (Corp Only)",    "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 3,     "rule_type": "hard", "label": "Min Time in Business (years)", "score_weight": 15},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (last 7 yrs)",   "score_weight": 25},
                    {"field": "industry",               "operator": "not_in", "value_list": _STEARNS_EXCLUDED, "rule_type": "hard", "label": "Industry Not Excluded", "score_weight": 25},
                ],
            },
            {
                "name": "Corp Only — Tier 3 (No PayNet)",
                "description": "No PayNet. FICO 710+, 2yr TIB",
                "priority": 6,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",    "value_numeric": 710,   "rule_type": "hard", "label": "Min FICO Score (Corp Only)",    "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 2,     "rule_type": "hard", "label": "Min Time in Business (years)", "score_weight": 15},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (last 7 yrs)",   "score_weight": 25},
                    {"field": "industry",               "operator": "not_in", "value_list": _STEARNS_EXCLUDED, "rule_type": "hard", "label": "Industry Not Excluded", "score_weight": 25},
                ],
            },

            # ── Scenario C: PayNet Only — no FICO required ──────────────
            # FIX-1: Entire scenario was absent in v1.
            {
                "name": "PayNet Only — Tier 1",
                "description": "No FICO. PayNet 700+, 10yr TIB",
                "priority": 7,
                "rules": [
                    {"field": "paynet_score",           "operator": "gte",    "value_numeric": 700,   "rule_type": "hard", "label": "Min PayNet Score",             "score_weight": 30},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 10,    "rule_type": "hard", "label": "Min Time in Business (years)", "score_weight": 20},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (last 7 yrs)",   "score_weight": 25},
                    {"field": "industry",               "operator": "not_in", "value_list": _STEARNS_EXCLUDED, "rule_type": "hard", "label": "Industry Not Excluded", "score_weight": 25},
                ],
            },
            {
                "name": "PayNet Only — Tier 2",
                "description": "No FICO. PayNet 690+, 5yr TIB",
                "priority": 8,
                "rules": [
                    {"field": "paynet_score",           "operator": "gte",    "value_numeric": 690,   "rule_type": "hard", "label": "Min PayNet Score",             "score_weight": 30},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 5,     "rule_type": "hard", "label": "Min Time in Business (years)", "score_weight": 20},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (last 7 yrs)",   "score_weight": 25},
                    {"field": "industry",               "operator": "not_in", "value_list": _STEARNS_EXCLUDED, "rule_type": "hard", "label": "Industry Not Excluded", "score_weight": 25},
                ],
            },
            {
                "name": "PayNet Only — Tier 3",
                "description": "No FICO. PayNet 680+, 5yr TIB",
                "priority": 9,
                "rules": [
                    {"field": "paynet_score",           "operator": "gte",    "value_numeric": 680,   "rule_type": "hard", "label": "Min PayNet Score",             "score_weight": 30},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 5,     "rule_type": "hard", "label": "Min Time in Business (years)", "score_weight": 20},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (last 7 yrs)",   "score_weight": 25},
                    {"field": "industry",               "operator": "not_in", "value_list": _STEARNS_EXCLUDED, "rule_type": "hard", "label": "Industry Not Excluded", "score_weight": 25},
                ],
            },
        ],
    },

    # ============================================================
    # 2. APEX COMMERCIAL CAPITAL
    # FIX-2a: Removed paynet_score from C Rate — C is FICO-only per PDF
    #         Borrowers without PayNet now fall through to C Rate correctly
    # FIX-2b: Added Medical B (FICO 670+, 2yr licensed) — was missing entirely
    # FIX-2c: Added Corp Only ($3M+ revenue, full financials) — was missing
    # ============================================================
    {
        "name": "Apex Commercial Capital",
        "description": "Equipment Finance — A+/A/B/C tiers, Medical A/B, Corp Only. No CA/NV/ND/VT.",
        "contact_name": "Donald Wampler / Stephanie Costa",
        "contact_email": "credit@apexcommercial.com",
        "programs": [
            {
                "name": "A+ Rate",
                "description": "FICO 720+, PayNet 670+, 5yr TIB, equipment ≤5yr",
                "priority": 1,
                "min_rate": 6.50,
                "max_rate": 6.75,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",     "value_numeric": 720,   "rule_type": "hard", "label": "Min FICO Score",          "score_weight": 20},
                    {"field": "paynet_score",           "operator": "gte",     "value_numeric": 670,   "rule_type": "hard", "label": "Min PayNet Score",        "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",     "value_numeric": 5,     "rule_type": "hard", "label": "Min Time in Business",    "score_weight": 15},
                    {"field": "loan_amount",            "operator": "between", "value_numeric": 10000, "value_numeric_max": 500000, "rule_type": "hard", "label": "Loan Amount Range",  "score_weight": 10},
                    {"field": "equipment_age_years",    "operator": "lte",     "value_numeric": 5,     "rule_type": "hard", "label": "Max Equipment Age 5yr",   "score_weight": 10},
                    {"field": "is_private_party",       "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Private Party Sales",  "score_weight": 10},
                    {"field": "business_state",         "operator": "not_in",  "value_list": _APEX_EXCLUDED_STATES, "rule_type": "hard", "label": "State Not Excluded",      "score_weight": 15},
                    {"field": "equipment_type",         "operator": "not_in",  "value_list": _APEX_EXCLUDED_EQUIP,  "rule_type": "hard", "label": "Equipment Not Excluded",  "score_weight": 20},
                ],
            },
            {
                "name": "A Rate Standard",
                "description": "FICO 700+, PayNet 660+, 5yr TIB",
                "priority": 2,
                "min_rate": 7.25,
                "max_rate": 7.75,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",     "value_numeric": 700,   "rule_type": "hard", "label": "Min FICO Score",         "score_weight": 20},
                    {"field": "paynet_score",           "operator": "gte",     "value_numeric": 660,   "rule_type": "hard", "label": "Min PayNet Score",       "score_weight": 15},
                    {"field": "time_in_business_years", "operator": "gte",     "value_numeric": 5,     "rule_type": "hard", "label": "Min Time in Business",   "score_weight": 15},
                    {"field": "loan_amount",            "operator": "between", "value_numeric": 10000, "value_numeric_max": 500000, "rule_type": "hard", "label": "Loan Amount Range", "score_weight": 10},
                    {"field": "business_state",         "operator": "not_in",  "value_list": _APEX_EXCLUDED_STATES, "rule_type": "hard", "label": "State Not Excluded",     "score_weight": 15},
                    {"field": "equipment_type",         "operator": "not_in",  "value_list": _APEX_EXCLUDED_EQUIP,  "rule_type": "hard", "label": "Equipment Not Excluded", "score_weight": 20},
                ],
            },
            {
                "name": "B Rate Standard",
                "description": "FICO 670+, PayNet 650+, 3yr TIB",
                "priority": 3,
                "min_rate": 8.25,
                "max_rate": 8.75,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",     "value_numeric": 670,   "rule_type": "hard", "label": "Min FICO Score",         "score_weight": 20},
                    {"field": "paynet_score",           "operator": "gte",     "value_numeric": 650,   "rule_type": "hard", "label": "Min PayNet Score",       "score_weight": 15},
                    {"field": "time_in_business_years", "operator": "gte",     "value_numeric": 3,     "rule_type": "hard", "label": "Min Time in Business",   "score_weight": 15},
                    {"field": "loan_amount",            "operator": "between", "value_numeric": 10000, "value_numeric_max": 250000, "rule_type": "hard", "label": "Loan Amount Range", "score_weight": 10},
                    {"field": "business_state",         "operator": "not_in",  "value_list": _APEX_EXCLUDED_STATES, "rule_type": "hard", "label": "State Not Excluded",     "score_weight": 15},
                    {"field": "equipment_type",         "operator": "not_in",  "value_list": _APEX_EXCLUDED_EQUIP,  "rule_type": "hard", "label": "Equipment Not Excluded", "score_weight": 20},
                ],
            },
            {
                # FIX-2a: paynet_score rule removed.
                # Per Apex PDF, C Rate only requires FICO 640+ and 2yr TIB.
                # Borrowers without PayNet correctly reach this tier now.
                "name": "C Rate Standard",
                "description": "FICO 640+, 2yr TIB — no PayNet required at this tier",
                "priority": 4,
                "min_rate": 11.0,
                "max_rate": 12.0,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",     "value_numeric": 640,   "rule_type": "hard", "label": "Min FICO Score",         "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",     "value_numeric": 2,     "rule_type": "hard", "label": "Min Time in Business",   "score_weight": 15},
                    {"field": "loan_amount",            "operator": "between", "value_numeric": 10000, "value_numeric_max": 100000, "rule_type": "hard", "label": "Loan Amount Range", "score_weight": 10},
                    {"field": "business_state",         "operator": "not_in",  "value_list": _APEX_EXCLUDED_STATES, "rule_type": "hard", "label": "State Not Excluded",     "score_weight": 15},
                    {"field": "equipment_type",         "operator": "not_in",  "value_list": _APEX_EXCLUDED_EQUIP,  "rule_type": "hard", "label": "Equipment Not Excluded", "score_weight": 20},
                ],
            },
            {
                "name": "Medical A Rate",
                "description": "Healthcare: FICO 700+, 5yr licensed",
                "priority": 5,
                "min_rate": 7.00,
                "max_rate": 7.25,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",     "value_numeric": 700,   "rule_type": "hard", "label": "Min FICO Score",                     "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",     "value_numeric": 5,     "rule_type": "hard", "label": "Min Time Licensed",                 "score_weight": 15},
                    {"field": "loan_amount",            "operator": "between", "value_numeric": 10000, "value_numeric_max": 500000, "rule_type": "hard", "label": "Loan Amount Range",       "score_weight": 10},
                    {"field": "business_state",         "operator": "not_in",  "value_list": _APEX_EXCLUDED_STATES, "rule_type": "hard", "label": "State Not Excluded",                "score_weight": 15},
                    {"field": "industry",               "operator": "in",      "value_list": "Medical,Dental,Veterinary,Healthcare", "rule_type": "hard", "label": "Healthcare Industry Required", "score_weight": 25},
                ],
            },
            {
                # FIX-2b: Medical B was completely missing
                "name": "Medical B Rate",
                "description": "Healthcare: FICO 670+, 2yr licensed",
                "priority": 6,
                "min_rate": 8.00,
                "max_rate": 8.50,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",     "value_numeric": 670,   "rule_type": "hard", "label": "Min FICO Score",                     "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",     "value_numeric": 2,     "rule_type": "hard", "label": "Min Time Licensed",                 "score_weight": 15},
                    {"field": "loan_amount",            "operator": "between", "value_numeric": 10000, "value_numeric_max": 250000, "rule_type": "hard", "label": "Loan Amount Range",       "score_weight": 10},
                    {"field": "business_state",         "operator": "not_in",  "value_list": _APEX_EXCLUDED_STATES, "rule_type": "hard", "label": "State Not Excluded",                "score_weight": 15},
                    {"field": "industry",               "operator": "in",      "value_list": "Medical,Dental,Veterinary,Healthcare", "rule_type": "hard", "label": "Healthcare Industry Required", "score_weight": 25},
                ],
            },
            {
                # FIX-2c: Corp Only was completely missing
                "name": "Corp Only",
                "description": "No personal FICO. $3M+ revenue, 5yr TIB, 75% business credit",
                "priority": 7,
                "rules": [
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 5,       "rule_type": "hard", "label": "Min Time in Business",   "score_weight": 15},
                    {"field": "annual_revenue",          "operator": "gte",    "value_numeric": 3000000, "rule_type": "hard", "label": "Min Annual Revenue $3M", "score_weight": 25},
                    {"field": "comparable_credit_pct",   "operator": "gte",    "value_numeric": 75,      "rule_type": "hard", "label": "Business Credit 75%+",   "score_weight": 20},
                    {"field": "business_state",          "operator": "not_in", "value_list": _APEX_EXCLUDED_STATES, "rule_type": "hard", "label": "State Not Excluded",     "score_weight": 15},
                ],
            },
        ],
    },

    # ============================================================
    # 3. ADVANTAGE+ FINANCING
    # FIX-4a: Startup program now gates on is_startup=True
    #         Without this, any established business with FICO 700
    #         would match the Startup program instead of Standard
    # FIX-4b: Added soft rule: prefer 7yr trade history
    # ============================================================
    {
        "name": "Advantage+ Financing",
        "description": "Non-Trucking only, up to $75K, A to B- credit. US Citizens only.",
        "contact_email": "SalesSupport@advantageplusfinancing.com",
        "contact_phone": "(262) 439-7600",
        "programs": [
            {
                "name": "Standard (Non-Trucking)",
                "description": "A to B- credit, FICO 680+, 3yr TIB, max $75K, no trucking",
                "priority": 1,
                "rules": [
                    {"field": "fico_score",             "operator": "gte",     "value_numeric": 680,   "rule_type": "hard", "label": "Min FICO Score",                   "score_weight": 20},
                    {"field": "time_in_business_years",  "operator": "gte",     "value_numeric": 3,     "rule_type": "hard", "label": "Min Time in Business (years)",     "score_weight": 15},
                    {"field": "loan_amount",             "operator": "between", "value_numeric": 10000, "value_numeric_max": 75000, "rule_type": "hard", "label": "Loan Amount $10K–$75K",    "score_weight": 10},
                    {"field": "loan_term_months",        "operator": "lte",     "value_numeric": 60,    "rule_type": "hard", "label": "Max Loan Term 60 Months",          "score_weight": 5},
                    {"field": "has_bankruptcy",          "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy",                    "score_weight": 25},
                    {"field": "has_judgement",           "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Judgements",                    "score_weight": 15},
                    {"field": "has_foreclosure",         "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Foreclosures",                  "score_weight": 15},
                    {"field": "has_repossession",        "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Repossessions",                 "score_weight": 15},
                    {"field": "has_tax_lien",            "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Tax Liens",                     "score_weight": 15},
                    {"field": "has_collections_last_3y", "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Collections/Charge-offs (3yr)", "score_weight": 15},
                    {"field": "is_us_citizen",           "operator": "eq",      "value_boolean": True,  "rule_type": "hard", "label": "US Citizen Required",              "score_weight": 10},
                    {"field": "equipment_type",          "operator": "not_in",  "value_list": _TRUCKING,"rule_type": "hard", "label": "Non-Trucking Equipment Only",      "score_weight": 20},
                    # Soft rules — preferred, not disqualifying
                    {"field": "comparable_credit_pct",   "operator": "gte",     "value_numeric": 80,    "rule_type": "soft", "label": "Prefer 80% Comparable Credit",     "score_weight": 10},
                    {"field": "time_in_business_years",  "operator": "gte",     "value_numeric": 7,     "rule_type": "soft", "label": "Prefer 7yr Trade History",         "score_weight": 8},
                ],
            },
            {
                # FIX-4a: Added is_startup=True gate.
                "name": "Startup Program",
                "description": "Startups only: FICO 700+, 10%+10% security deposit required",
                "priority": 2,
                "rules": [
                    {"field": "fico_score",             "operator": "gte",     "value_numeric": 700,   "rule_type": "hard", "label": "Min FICO Score (Startup)",         "score_weight": 20},
                    {"field": "is_startup",             "operator": "eq",      "value_boolean": True,  "rule_type": "hard", "label": "Must Be Startup Business",         "score_weight": 5},
                    {"field": "loan_amount",             "operator": "between", "value_numeric": 10000, "value_numeric_max": 75000, "rule_type": "hard", "label": "Loan Amount $10K–$75K",    "score_weight": 10},
                    {"field": "has_bankruptcy",          "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy",                    "score_weight": 25},
                    {"field": "has_judgement",           "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Judgements",                    "score_weight": 15},
                    {"field": "has_foreclosure",         "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Foreclosures",                  "score_weight": 15},
                    {"field": "has_repossession",        "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Repossessions",                 "score_weight": 15},
                    {"field": "has_tax_lien",            "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Tax Liens",                     "score_weight": 15},
                    {"field": "has_collections_last_3y", "operator": "eq",      "value_boolean": False, "rule_type": "hard", "label": "No Collections/Charge-offs (3yr)", "score_weight": 15},
                    {"field": "is_us_citizen",           "operator": "eq",      "value_boolean": True,  "rule_type": "hard", "label": "US Citizen Required",              "score_weight": 10},
                    {"field": "equipment_type",          "operator": "not_in",  "value_list": _TRUCKING,"rule_type": "hard", "label": "Non-Trucking Equipment Only",      "score_weight": 20},
                ],
            },
        ],
    },

    # ============================================================
    # 4. CITIZENS BANK
    # FIX-3a: Non-Homeowner: is_homeowner was True (completely backwards)
    #         Fixed to False + added years_at_residence >= 5 (was missing)
    # FIX-3b: Tier 2: added 5yr industry experience as soft rule
    # FIX-3c: Tier 3 ($75K–$1M, full financials) was entirely absent
    # ============================================================
    {
        "name": "Citizens Bank",
        "description": "Equipment Finance 2025. No CA. US Citizens only. No cannabis.",
        "contact_name": "Joey Walter",
        "contact_email": "joey.walter@thecitizensbank.net",
        "contact_phone": "501-451-5113",
        "programs": [
            {
                "name": "Tier 1 — App Only (Up to $75K)",
                "description": "700+ TransUnion, 2yr TIB, homeowner required, max $75K",
                "priority": 1,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",    "value_numeric": 700,   "rule_type": "hard", "label": "Min Credit Score (TransUnion)",         "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 2,     "rule_type": "hard", "label": "Min Time in Business (years)",          "score_weight": 15},
                    {"field": "loan_amount",            "operator": "lte",    "value_numeric": 75000, "rule_type": "hard", "label": "Max Loan $75K (App Only)",              "score_weight": 10},
                    {"field": "is_homeowner",           "operator": "eq",     "value_boolean": True,  "rule_type": "hard", "label": "Homeownership Required",                "score_weight": 15},
                    {"field": "is_us_citizen",          "operator": "eq",     "value_boolean": True,  "rule_type": "hard", "label": "US Citizen Required",                   "score_weight": 10},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (or 5+ yrs discharged)",  "score_weight": 25},
                    {"field": "business_state",         "operator": "not_in", "value_list": "CA",     "rule_type": "hard", "label": "State Not Excluded (no CA)",            "score_weight": 15},
                    {"field": "equipment_type",         "operator": "not_in", "value_list": "Cannabis","rule_type": "hard","label": "No Cannabis Equipment",                 "score_weight": 20},
                ],
            },
            {
                # FIX-3b: Added industry experience as soft rule
                "name": "Tier 2 — App Only (Up to $50K)",
                "description": "700+ score, homeowner, 5yr industry exp preferred, max $50K",
                "priority": 2,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",    "value_numeric": 700,   "rule_type": "hard", "label": "Min Credit Score (TransUnion)",  "score_weight": 20},
                    {"field": "loan_amount",            "operator": "lte",    "value_numeric": 50000, "rule_type": "hard", "label": "Max Loan $50K",                  "score_weight": 10},
                    {"field": "is_homeowner",           "operator": "eq",     "value_boolean": True,  "rule_type": "hard", "label": "Homeownership Required",         "score_weight": 15},
                    {"field": "is_us_citizen",          "operator": "eq",     "value_boolean": True,  "rule_type": "hard", "label": "US Citizen Required",            "score_weight": 10},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Recent Bankruptcy",           "score_weight": 25},
                    {"field": "business_state",         "operator": "not_in", "value_list": "CA",     "rule_type": "hard", "label": "State Not Excluded (no CA)",     "score_weight": 15},
                    {"field": "equipment_type",         "operator": "not_in", "value_list": "Cannabis","rule_type": "hard","label": "No Cannabis Equipment",          "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 5,     "rule_type": "soft", "label": "Prefer 5yr Industry Experience", "score_weight": 12},
                ],
            },
            {
                # FIX-3a: Was is_homeowner=True — completely wrong.
                # This program IS FOR people who do NOT own their home.
                # Also added years_at_residence >= 5 which was missing entirely.
                "name": "Non-Homeowner Program",
                "description": "For non-homeowners: 700+, 5yr at residence, 2yr TIB, max $50K",
                "priority": 3,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",    "value_numeric": 700,   "rule_type": "hard", "label": "Min Credit Score (TransUnion)", "score_weight": 20},
                    {"field": "is_homeowner",           "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "Non-Homeowner (qualifier)",     "score_weight": 5},
                    {"field": "years_at_residence",     "operator": "gte",    "value_numeric": 5,     "rule_type": "hard", "label": "Min 5 Years at Residence",      "score_weight": 15},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 2,     "rule_type": "hard", "label": "Min Time in Business (years)",  "score_weight": 15},
                    {"field": "loan_amount",            "operator": "lte",    "value_numeric": 50000, "rule_type": "hard", "label": "Max Loan $50K",                 "score_weight": 10},
                    {"field": "is_us_citizen",          "operator": "eq",     "value_boolean": True,  "rule_type": "hard", "label": "US Citizen Required",           "score_weight": 10},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Recent Bankruptcy",          "score_weight": 25},
                    {"field": "business_state",         "operator": "not_in", "value_list": "CA",     "rule_type": "hard", "label": "State Not Excluded (no CA)",    "score_weight": 15},
                    {"field": "equipment_type",         "operator": "not_in", "value_list": "Cannabis","rule_type": "hard","label": "No Cannabis Equipment",         "score_weight": 20},
                ],
            },
            {
                # FIX-3c: Tier 3 was completely absent.
                # Covers loans $75K–$1M requiring full financials.
                "name": "Tier 3 — Full Financials ($75K–$1M)",
                "description": "Loans $75K–$1M, full financials required, 700+ score",
                "priority": 4,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",     "value_numeric": 700,    "rule_type": "hard", "label": "Min Credit Score (TransUnion)",        "score_weight": 20},
                    {"field": "loan_amount",            "operator": "between", "value_numeric": 75000,  "value_numeric_max": 1000000, "rule_type": "hard", "label": "Loan Amount $75K–$1M", "score_weight": 10},
                    {"field": "is_us_citizen",          "operator": "eq",      "value_boolean": True,   "rule_type": "hard", "label": "US Citizen Required",                 "score_weight": 10},
                    {"field": "has_bankruptcy",         "operator": "eq",      "value_boolean": False,  "rule_type": "hard", "label": "No Bankruptcy (or 5+ yrs discharged)", "score_weight": 25},
                    {"field": "business_state",         "operator": "not_in",  "value_list": "CA",      "rule_type": "hard", "label": "State Not Excluded (no CA)",           "score_weight": 15},
                    {"field": "equipment_type",         "operator": "not_in",  "value_list": "Cannabis","rule_type": "hard", "label": "No Cannabis Equipment",                "score_weight": 20},
                ],
            },
        ],
    },

    # ============================================================
    # 5. FALCON EQUIPMENT FINANCE
    # FIX-5: Added Trucking-specific program (FICO 700, PayNet 680,
    #        5yr TIB, equipment ≤10yr old) — trucking was completely
    #        unaddressed in v1 despite PDF explicitly stating A/B only.
    #        PayNet null is handled in rule_evaluator.py via OPTIONAL_FIELDS —
    #        borrowers without PayNet can still qualify for C/D/E tier.
    # NOTE:  A/B/C/D/E tier assignment is underwriter discretion per PDF.
    #        We determine eligible/ineligible + surface rate range only.
    #        See DECISIONS.md for full explanation.
    # ============================================================
    {
        "name": "Falcon Equipment Finance",
        "description": (
            "A Division of Falcon National Bank — A/B/C/D/E tiers. "
            "Trucking (Class 8) A/B only with stricter thresholds. "
            "Strictest bankruptcy rule across all lenders: 15+ years ago."
        ),
        "contact_name": "Emma Tickner",
        "contact_email": "ETickner@FalconEquipmentFinance.com",
        "contact_phone": "651-332-6517",
        "programs": [
            {
                "name": "A/B Credit — Standard",
                "description": "FICO 680+, PayNet 660+, 3yr TIB, 70% comparable credit",
                "priority": 1,
                "min_rate": 7.75,
                "max_rate": 9.75,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",    "value_numeric": 680,   "rule_type": "hard", "label": "Min FICO Score",               "score_weight": 20},
                    {"field": "paynet_score",           "operator": "gte",    "value_numeric": 660,   "rule_type": "hard", "label": "Min PayNet Score",             "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 3,     "rule_type": "hard", "label": "Min Time in Business (years)", "score_weight": 15},
                    {"field": "loan_amount",            "operator": "gte",    "value_numeric": 15000, "rule_type": "hard", "label": "Min Loan Amount $15K",         "score_weight": 10},
                    {"field": "comparable_credit_pct",  "operator": "gte",    "value_numeric": 70,    "rule_type": "hard", "label": "Comparable Credit ≥ 70%",      "score_weight": 15},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (last 15 yrs)",  "score_weight": 25},
                    # Soft nudge — trucking borrowers are routed to dedicated program
                    {"field": "equipment_type",         "operator": "not_in", "value_list": _TRUCKING,"rule_type": "soft", "label": "Trucking: use trucking program","score_weight": 5},
                ],
            },
            {
                # FIX-5: Brand new program — trucking was completely absent in v1.
                "name": "A/B Credit — Trucking (Class 8)",
                "description": "Class 8 only. FICO 700+, PayNet 680+, 5yr TIB, equipment ≤10yr",
                "priority": 2,
                "min_rate": 7.75,
                "max_rate": 9.75,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",    "value_numeric": 700,   "rule_type": "hard", "label": "Min FICO Score (Trucking)",         "score_weight": 20},
                    {"field": "paynet_score",           "operator": "gte",    "value_numeric": 680,   "rule_type": "hard", "label": "Min PayNet Score (Trucking)",       "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 5,     "rule_type": "hard", "label": "Min Time in Business (Trucking)",   "score_weight": 15},
                    {"field": "loan_amount",            "operator": "gte",    "value_numeric": 15000, "rule_type": "hard", "label": "Min Loan Amount $15K",             "score_weight": 10},
                    {"field": "comparable_credit_pct",  "operator": "gte",    "value_numeric": 70,    "rule_type": "hard", "label": "Comparable Credit ≥ 70%",          "score_weight": 15},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (last 15 yrs)",      "score_weight": 25},
                    {"field": "equipment_type",         "operator": "in",     "value_list": _TRUCKING,"rule_type": "hard", "label": "Trucking Equipment Required",      "score_weight": 10},
                    {"field": "equipment_age_years",    "operator": "lte",    "value_numeric": 10,    "rule_type": "hard", "label": "Max Equipment Age 10yr (Class 8)", "score_weight": 15},
                ],
            },
            {
                # No paynet_score rule here — rule_evaluator.py treats it as
                # optional so borrowers without PayNet still qualify for C/D/E.
                "name": "C/D/E Credit — Standard",
                "description": "FICO 640+, 3yr TIB — no PayNet required",
                "priority": 3,
                "min_rate": 9.00,
                "max_rate": 13.75,
                "rules": [
                    {"field": "fico_score",            "operator": "gte",    "value_numeric": 640,   "rule_type": "hard", "label": "Min FICO Score",                     "score_weight": 20},
                    {"field": "time_in_business_years", "operator": "gte",    "value_numeric": 3,     "rule_type": "hard", "label": "Min Time in Business (years)",       "score_weight": 15},
                    {"field": "loan_amount",            "operator": "gte",    "value_numeric": 15000, "rule_type": "hard", "label": "Min Loan Amount $15K",               "score_weight": 10},
                    {"field": "comparable_credit_pct",  "operator": "gte",    "value_numeric": 70,    "rule_type": "hard", "label": "Comparable Credit ≥ 70%",            "score_weight": 15},
                    {"field": "has_bankruptcy",         "operator": "eq",     "value_boolean": False, "rule_type": "hard", "label": "No Bankruptcy (last 15 yrs)",        "score_weight": 25},
                    {"field": "equipment_type",         "operator": "not_in", "value_list": _TRUCKING,"rule_type": "hard", "label": "Non-Trucking (use trucking program)", "score_weight": 20},
                ],
            },
        ],
    },
  
]