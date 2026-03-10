// ============================================================
// TYPES — TypeScript interfaces mirroring backend schemas
// ============================================================

// ------------------------------------
// Lender / Policy
// ------------------------------------

export interface PolicyRule {
  id: number;
  program_id: number;
  field: string;
  operator: string;
  rule_type: 'hard' | 'soft';
  value_numeric?: number;
  value_numeric_max?: number;
  value_text?: string;
  value_list?: string;
  value_boolean?: boolean;
  label?: string;
  description?: string;
  score_weight: number;
}

export interface LenderProgram {
  id: number;
  lender_id: number;
  name: string;
  description?: string;
  priority: number;
  is_active: boolean;
  min_rate?: number;
  max_rate?: number;
  rules: PolicyRule[];
}

export interface Lender {
  id: number;
  name: string;
  description?: string;
  is_active: boolean;
  contact_name?: string;
  contact_email?: string;
  contact_phone?: string;
  programs: LenderProgram[];
}

// ------------------------------------
// Application
// ------------------------------------

export interface Business {
  id?: number;
  business_name: string;
  business_type?: string;
  industry?: string;
  state?: string;
  years_in_business?: number;
  annual_revenue?: number;
  is_startup: boolean;
  paynet_score?: number;
}

export interface PersonalGuarantor {
  id?: number;
  first_name: string;
  last_name: string;
  fico_score?: number;
  is_homeowner: boolean;
  is_us_citizen: boolean;
  years_at_residence?: number;
  has_bankruptcy: boolean;
  years_since_bankruptcy?: number;
  has_judgement: boolean;
  has_foreclosure: boolean;
  has_repossession: boolean;
  has_tax_lien: boolean;
  has_collections_last_3y: boolean;
  revolving_debt?: number;
  revolving_plus_unsecured_debt?: number;
  comparable_credit_pct?: number;
}

export interface LoanRequest {
  id?: number;
  amount: number;
  term_months?: number;
  equipment_type?: string;
  equipment_year?: number;
  equipment_age_years?: number;
  equipment_mileage?: number;
  is_private_party: boolean;
  is_titled_asset: boolean;
}

export interface Application {
  id: number;
  status: string;
  created_at: string;
  updated_at: string;
  business?: Business;
  guarantor?: PersonalGuarantor;
  loan_request?: LoanRequest;
}

// ------------------------------------
// Results
// ------------------------------------

export interface RuleEvaluationResult {
  id: number;
  rule_id: number;
  passed: boolean;
  actual_value?: string;
  required_value?: string;
  explanation?: string;
  rule?: {
    id: number;
    field: string;
    operator: string;
    label?: string;
    rule_type: string;
  };
}

export interface MatchResult {
  id: number;
  application_id: number;
  lender_id: number;
  program_id?: number;
  status: 'eligible' | 'ineligible' | 'pending';
  fit_score: number;
  summary?: string;
  created_at: string;
  lender_name?: string;
  program_name?: string;
  rule_results: RuleEvaluationResult[];
}

export interface UnderwritingRunResponse {
  application_id: number;
  status: string;
  total_lenders_checked: number;
  eligible_count: number;
  ineligible_count: number;
  results: MatchResult[];
}

// ------------------------------------
// Form types
// ------------------------------------

export interface ApplicationFormData {
  business: Business;
  guarantor: PersonalGuarantor;
  loan_request: LoanRequest;
}
