Architecture & Design Decisions
1. Data-Driven Rule Engine
Decision: Store every lender policy as rows in policy_rules with three columns — field, operator, and one of value_numeric, value_list, or value_boolean — rather than writing conditional Python per lender.
Why: The assignment requires the system to be extensible. A naïve approach would look like:
pythonif lender == "Stearns":
    if fico < 700: reject()
    if state in ["CA"]: reject()
Every new lender or policy change means touching code, redeploying, and re-testing. With the rule engine, adding a lender is inserting rows — the matching engine never changes. The rule_evaluator.py supports nine operators (gte, lte, gt, lt, eq, neq, in, not_in, between) which cover every condition across all five PDFs. Adding a tenth operator is a single elif block in evaluate_rule().
Trade-off: More upfront complexity in the data model. Entirely worth it for the stated requirements.

2. Program Tier Architecture
Decision: Each lender owns multiple LenderProgram records, evaluated in priority order. The engine returns the best-qualifying program.
Why: Several lenders have tiered programs that serve different borrower profiles. Apex has A+, A, B, C, Medical-A, Medical-B, and Corp Only — a borrower who doesn't qualify for A+ might still qualify for B. Stearns has three distinct credit scenarios (Full Credit, Corp Only, PayNet Only). Without programs, you'd have to duplicate lender-level rules across every tier or build special-case logic. With programs, each tier is independent and the engine just walks down the priority list until it finds a match.

3. asyncio.gather for Parallelism
Decision: Fan out lender evaluations using asyncio.gather() with a ThreadPoolExecutor, so all five lenders are evaluated concurrently.
Why: Each lender's evaluation is completely independent — there are no shared writes, no cross-lender dependencies. Running them sequentially would be wasted latency. The pure-logic evaluate_lender() function is CPU-bound so it's safe to run in threads. Five lenders with ~10 rules each is fast anyway, but the pattern scales if the lender count grows.
What Hatchet would add over this: persistent job state, retry with backoff, dead letter queues, an observability UI. That's a reasonable V2 addition documented below.

4. Fit Score Formula
Decision: Eligible applications start at 100 and lose points proportionally for failing soft rules. Hard failures immediately return 0. A margin bonus of up to 5 points rewards applicants who significantly exceed minimums.
if hard_failures:
    fit_score = 0
else:
    fit_score = 100 - (soft_deduction_weight / total_soft_weight * 40)
    fit_score += margin_bonus  # up to +5, capped at 100
Why: The formula is simple enough to explain to a broker. A score of 90 means "strong match, minor soft rule misses." A score of 0 means "disqualified." The 40-point soft deduction ceiling means even an applicant who fails every soft rule still shows a score of 60, distinguishing them from a hard-fail at 0.
The margin bonus rewards applicants who meaningfully exceed numeric minimums (more than 15% above the threshold). This surfaces the genuinely strong applicants at the top of the eligible list.

5. Seeder Behavior
Decision: On every backend startup, seeder.py syncs the DB to lenders_data.py. Lenders in the file but not in the DB are inserted. Lenders in the DB but not in the file are deleted (with FK-safe cascade: rule evaluation results → match results → rules → programs → lender). Existing lenders are left alone.
Why: This keeps a single source of truth. During development you edit lenders_data.py and restart — the DB reflects it immediately. In production you'd switch to migration-based management, but for this use case the seeder is the right trade-off.

6. Lender Policy Modeling Decisions
Stearns Bank
Three separate credit scenarios from the PDF are modeled as nine programs: Tiers 1/2/3 under Full Credit (FICO + PayNet), Tiers 1/2/3 under Corp Only (FICO only, no PayNet required), and Tiers 1/2/3 under PayNet Only (no FICO required, stricter TIB). The revolving debt ceiling ($30K) and the industry exclusion list are both hard rules. Bankruptcy lookback is enforced via has_bankruptcy = false (hard rule) with an advisory years_since_bankruptcy field on the application form.
Apex Commercial Capital
Seven programs: A+, A, B, C, Medical A, Medical B, and Corp Only. The C Rate program intentionally omits the PayNet rule — the PDF specifies C is FICO-only. Geographic exclusion (CA, NV, ND, VT) and equipment exclusion (Aircraft, ATM, Cannabis, Trucking, etc.) are not_in hard rules. Equipment age is capped at 5 years for A+ via equipment_age_years lte 5.
Advantage+ Financing
Non-trucking only — enforced as a not_in hard rule on equipment_type. All six derogatory flags (bankruptcy, judgement, foreclosure, repossession, tax lien, collections) are hard disqualifiers per the PDF. The comparable credit requirement (80%) is modeled as a soft rule — the PDF describes it as a preference, not an absolute cutoff. The startup program is a separate program gated by is_startup eq true plus a higher FICO floor (700 vs 680).
Citizens Bank
Three programs covering the homeowner/non-homeowner split and the Tier 3 full-financials bracket. TransUnion score is mapped to the fico_score field — they're the same numeric concept for rule evaluation purposes. The vehicle age/mileage matrix in the PDF (which determines loan term, not eligibility) is documented as a V2 feature; V1 captures eligibility only.
Falcon Equipment Finance
Three programs: A/B Standard, A/B Trucking (Class 8), and C/D/E Standard. The strictest bankruptcy lookback across all five lenders — 15 years — is modeled as a hard rule. Comparable credit threshold (70%) is a hard rule, not soft. The C/D/E program intentionally omits the PayNet rule because the PDF states lower tiers are FICO-only; paynet_score is listed in OPTIONAL_FIELDS in rule_evaluator.py so missing PayNet data skips the rule rather than hard-failing.
Falcon tier assignment note: The PDF describes A, B, C, D, E tiers as underwriter-assigned based on the full credit package. This system determines whether an applicant is eligible for Falcon at all and which program bucket they fall into (A/B standard, A/B trucking, or C/D/E). The specific letter grade within that bucket — i.e. whether a qualifying A/B borrower gets A pricing or B pricing — is an underwriter decision that requires reviewing the full credit file. The system surfaces the rate range (e.g. 7.75–9.75%) for the qualifying program so the broker knows what to expect, but the final tier letter is not automated. This is an intentional simplification: modeling underwriter discretion as rules would require fabricating criteria not stated in the PDF.

7. Simplifications Made
Citizens Bank vehicle matrix: The PDF has a detailed matrix mapping equipment class × mileage range → loan term. V1 captures eligibility (can this borrower get financing?). V2 would model term determination.
Stearns comparable debt requirement: "3+ contracts $10K+ in the last 12 months" is a bureau-level check. Approximated as comparable_credit_pct — the percentage of the requested loan amount covered by comparable prior credits.
Advantage+ 7-year trade history: The preference for 7+ years of trade history is modeled as a soft rule rather than a hard one. The PDF describes it as a scoring factor, not a cutoff.
Falcon "5+ trucks operating": This requires operational data (fleet count) that isn't part of a standard loan application form. The trucking program enforces the credit-side requirements (FICO, PayNet, TIB, equipment age) and leaves fleet verification to the underwriter.

8. What I Would Add With More Time
PDF auto-parsing: Use an LLM to extract LENDERS_SEED-format Python from an uploaded PDF. The seed schema is simple enough that a well-prompted model could produce it with high accuracy — a human reviews the output before committing. This directly addresses the "adding lenders from PDFs" workflow.
Hatchet integration: Replace asyncio.gather with Hatchet for production-grade orchestration — retry with backoff, persistent job state, dead letter queues, an observability UI showing which lender evaluation failed and why.
Citizens Bank term matrix: Model the full vehicle age × mileage → term determination so the results page can show the recommended loan term, not just eligibility.
JWT auth with broker/admin roles: Brokers submit applications and see results. Admins manage lender policies. Currently there's no auth at all.
Audit trail on policy rules: Every rule edit recorded with timestamp and user. Important for compliance — a broker needs to know which version of a policy was active when their application was evaluated.
Analytics: Approval rates by lender, most common hard-fail reasons across all applications. Useful for brokers to understand where their deal flow is getting stuck.