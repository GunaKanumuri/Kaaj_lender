// ============================================================
// TYPES — TypeScript interfaces mirroring backend Pydantic schemas
//
// TABLE OF CONTENTS
//   1.  Lender / Policy      — PolicyRule, LenderProgram, Lender
//   2.  Application          — Business, PersonalGuarantor, LoanRequest, Application
//   3.  Underwriting Results — RuleEvaluationResult, MatchResult, UnderwritingRunResponse
//   4.  Form Types           — ApplicationFormData (used by react-hook-form)
//
// NAMING CONVENTION
//   All field names match the backend schema 1:1 so JSON deserialization
//   requires no transformation — no camelCase conversion middleware needed.
// ============================================================


// region ── 1. Lender / Policy ────────────────────────────────

/** A single underwriting rule attached to a LenderProgram.
 *
 *  Exactly one of the value_* columns will be non-null depending on
 *  the operator:
 *    - gte / lte / gt / lt / between → value_numeric (+ value_numeric_max for between)
 *    - in / not_in                   → value_list  (comma-separated string)
 *    - eq / neq (text)               → value_text
 *    - eq / neq (boolean)            → value_boolean
 */
export interface PolicyRule {
  id:                number;
  program_id:        number;
  field:             string;           // maps to a key in the application context dict
  operator:          string;           // gte | lte | gt | lt | eq | neq | in | not_in | between
  rule_type:         'hard' | 'soft';  // hard = disqualifier; soft = score penalty only
  value_numeric?:    number;
  value_numeric_max?: number;          // upper bound for 'between' operator
  value_text?:       string;
  value_list?:       string;           // comma-separated, e.g. "CA,NV,ND,VT"
  value_boolean?:    boolean;
  label?:            string;           // human-readable rule name shown to broker
  description?:      string;
  score_weight:      number;           // points deducted from fit_score on soft failure
}

/** A named underwriting tier within a lender (e.g. "A Rate", "Tier 1 App Only"). */
export interface LenderProgram {
  id:           number;
  lender_id:    number;
  name:         string;
  description?: string;
  priority:     number;   // lower = evaluated first; first eligible program wins
  is_active:    boolean;
  min_rate?:    number;
  max_rate?:    number;
  rules:        PolicyRule[];
}

/** A lending institution with one or more underwriting programs. */
export interface Lender {
  id:             number;
  name:           string;
  description?:   string;
  is_active:      boolean;
  contact_name?:  string;
  contact_email?: string;
  contact_phone?: string;
  programs:       LenderProgram[];
}

// endregion


// region ── 2. Application ────────────────────────────────────

/** Business entity seeking financing. */
export interface Business {
  id?:               number;
  business_name:     string;
  business_type?:    string;   // LLC | Corporation | Sole Proprietorship | Partnership
  industry?:         string;
  state?:            string;   // two-letter US state code
  years_in_business?: number;
  annual_revenue?:   number;
  is_startup:        boolean;  // gates the Advantage+ Startup program
  paynet_score?:     number;   // optional — absence triggers OPTIONAL_FIELDS skip logic
}

/** Personal guarantor — the individual whose credit is assessed.
 *
 *  Derogatory flags default to false (clean record).
 *  years_since_bankruptcy only applies when has_bankruptcy = true.
 */
export interface PersonalGuarantor {
  id?:                          number;
  first_name:                   string;
  last_name:                    string;
  fico_score?:                  number;
  is_homeowner:                 boolean;
  is_us_citizen:                boolean;
  years_at_residence?:          number;
  // ── Derogatory flags ──────────────────────────────────────
  has_bankruptcy:               boolean;
  years_since_bankruptcy?:      number;
  has_judgement:                boolean;
  has_foreclosure:              boolean;
  has_repossession:             boolean;
  has_tax_lien:                 boolean;
  has_collections_last_3y:      boolean;
  // ── Debt load ─────────────────────────────────────────────
  revolving_debt?:              number;
  revolving_plus_unsecured_debt?: number;
  // ── Credit profile ────────────────────────────────────────
  comparable_credit_pct?:       number;   // optional — absence skips the rule
}

/** Equipment financing request details.
 *
 *  equipment_age_years is derived from equipment_year on the backend;
 *  it may also be sent directly from the form.
 */
export interface LoanRequest {
  id?:                number;
  amount:             number;
  term_months?:       number;
  equipment_type?:    string;
  equipment_year?:    number;
  equipment_age_years?: number;           // derived: current_year - equipment_year
  equipment_mileage?: number;             // optional — absence skips the rule
  is_private_party:   boolean;
  is_titled_asset:    boolean;
}

/** Top-level application record — wraps Business + Guarantor + LoanRequest. */
export interface Application {
  id:           number;
  status:       string;          // draft | processing | completed
  created_at:   string;          // ISO datetime string
  updated_at:   string;
  business?:    Business;
  guarantor?:   PersonalGuarantor;
  loan_request?: LoanRequest;
}

// endregion


// region ── 3. Underwriting Results ───────────────────────────

/** Pass/fail result for a single PolicyRule within a MatchResult.
 *
 *  The nested `rule` object is a lightweight snapshot of the rule at
 *  evaluation time — avoids a separate API call to /lenders/rules/:id.
 */
export interface RuleEvaluationResult {
  id:             number;
  rule_id:        number;
  passed:         boolean;
  actual_value?:  string;    // stringified actual value, e.g. "650"
  required_value?: string;   // stringified threshold, e.g. ">= 700"
  explanation?:   string;    // human-readable pass/fail reason
  rule?: {
    id:        number;
    field:     string;
    operator:  string;
    label?:    string;
    rule_type: string;       // 'hard' | 'soft'
  };
}

/** Outcome for one lender against one application.
 *
 *  eligible   → program_name = the winning program (highest fit_score)
 *  ineligible → program_name = the closest-attempt program (fewest hard failures)
 */
export interface MatchResult {
  id:             number;
  application_id: number;
  lender_id:      number;
  program_id?:    number;
  status:         'eligible' | 'ineligible' | 'pending';
  fit_score:      number;    // 0–100 + up to +5 margin bonus, then capped at 100
  summary?:       string;
  created_at:     string;
  lender_name?:   string;    // denormalized for display — avoids N+1
  program_name?:  string;
  rule_results:   RuleEvaluationResult[];
}

/** Full response from POST /underwriting/run/:id or GET /underwriting/results/:id. */
export interface UnderwritingRunResponse {
  application_id:       number;
  status:               string;
  total_lenders_checked: number;
  eligible_count:       number;
  ineligible_count:     number;
  results:              MatchResult[];   // sorted: eligible first, then ineligible
}

// endregion


// region ── 4. Form Types ──────────────────────────────────────

/** Shape passed to react-hook-form on the ApplicationFormPage.
 *  Submitted to POST /applications/ then immediately run through underwriting.
 */
export interface ApplicationFormData {
  business:     Business;
  guarantor:    PersonalGuarantor;
  loan_request: LoanRequest;
}

// endregion