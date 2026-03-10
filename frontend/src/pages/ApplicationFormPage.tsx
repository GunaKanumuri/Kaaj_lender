// ============================================================
// src/pages/ApplicationFormPage.tsx
//
// Multi-step loan application form — 4 pages, wizard navigation
//
// TABLE OF CONTENTS
//   1.  Constants        — options arrays, STEPS config, colour tokens
//   2.  Sidebar          — desktop left rail with brand card + step nav
//   3.  MobileBar        — sticky mobile top stepper
//   4.  FieldGrid        — responsive 2-col grid helper
//   5.  SectionDivider   — labelled horizontal rule between field groups
//   6.  CheckCard        — full-width checkbox-as-card
//   7.  AmountInput      — big $ loan amount input
//   8.  StepBusiness     — Step 1: entity, state, revenue, PayNet, startup
//   9.  StepGuarantor    — Step 2: name, FICO, debt load, residence
//  10.  StepDerogatory   — Step 3: 6 derogatory flags + bankruptcy detail
//  11.  StepLoan         — Step 4: amount, term, equipment, flags
//  12.  ApplicationFormPage — root: state machine, form, submit
// ============================================================

import { useState, useRef }    from 'react';
import { useNavigate }         from 'react-router-dom';
import { useForm }             from 'react-hook-form';
import {
  Building2, User, ShieldAlert, DollarSign,
  ChevronRight, ChevronLeft, Check, AlertTriangle,
  CircleCheck, Loader2, ArrowRight, Info,
} from 'lucide-react';

import { applicationsApi }         from '../api/applications';
import { underwritingApi }         from '../api/underwriting';
import { Input }                   from '../components/ui/Input';
import { Select }                  from '../components/ui/Select';
import type { ApplicationFormData} from '../types';


// ─────────────────────────────────────────────────────────────
// region 1 ── Constants
// ─────────────────────────────────────────────────────────────

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
].map(s => ({ value: s, label: s }));

const INDUSTRIES = [
  'Construction','Medical','Dental','Veterinary','Healthcare',
  'Transportation','Trucking','Manufacturing','Agriculture',
  'Food Service','Restaurant','Retail','Technology',
  'Automotive Repair','Landscaping','Janitorial','Logistics',
  'Oil & Gas','Cannabis','Gaming','Gambling','Real Estate','Other',
].map(v => ({ value: v, label: v }));

const EQUIPMENT_TYPES = [
  'Construction Equipment','Forklift','Medical Equipment','Dental Equipment',
  'Trucking / OTR','Semi Truck','Trailer','Agricultural Equipment',
  'Machine Tools','Industrial Machinery','Vocational Trucks',
  'Automotive Repair Equipment','Janitorial Equipment','Lawn Equipment',
  'Restaurant Equipment','Audio Visual','Office Equipment','Other',
].map(v => ({ value: v, label: v }));

const BUSINESS_TYPES = [
  { value: 'LLC',                 label: 'LLC'                  },
  { value: 'Corporation',         label: 'Corporation (C / S)'  },
  { value: 'Sole Proprietorship', label: 'Sole Proprietorship'  },
  { value: 'Partnership',         label: 'Partnership'          },
];

const LOAN_TERMS = [
  { value: '24', label: '24 months  (2 yr)' },
  { value: '36', label: '36 months  (3 yr)' },
  { value: '48', label: '48 months  (4 yr)' },
  { value: '60', label: '60 months  (5 yr)' },
  { value: '72', label: '72 months  (6 yr)' },
  { value: '84', label: '84 months  (7 yr)' },
];

// Step metadata — drives sidebar, mobile bar, header strip
const STEPS = [
  {
    id: 1, key: 'business',
    label: 'Business Info',    short: 'Business',
    sublabel: 'Entity, state & financials',
    icon: Building2,
    // Tailwind class fragments (kept static so purge can detect them)
    accent:      'emerald',
    accentHex:   '#059669',
    accentLight: '#ecfdf5',
    accentText:  '#065f46',
    accentBorder:'#6ee7b7',
  },
  {
    id: 2, key: 'guarantor',
    label: 'Guarantor',        short: 'Guarantor',
    sublabel: 'Credit profile & residence',
    icon: User,
    accent:      'blue',
    accentHex:   '#2563eb',
    accentLight: '#eff6ff',
    accentText:  '#1e3a8a',
    accentBorder:'#93c5fd',
  },
  {
    id: 3, key: 'derogatory',
    label: 'Credit History',   short: 'History',
    sublabel: 'Derogatory marks',
    icon: ShieldAlert,
    accent:      'rose',
    accentHex:   '#e11d48',
    accentLight: '#fff1f2',
    accentText:  '#881337',
    accentBorder:'#fda4af',
  },
  {
    id: 4, key: 'loan',
    label: 'Loan Request',     short: 'Loan',
    sublabel: 'Amount, term & equipment',
    icon: DollarSign,
    accent:      'amber',
    accentHex:   '#d97706',
    accentLight: '#fffbeb',
    accentText:  '#78350f',
    accentBorder:'#fcd34d',
  },
] as const;

type StepId = 1 | 2 | 3 | 4;

// Required fields per step — validated before advancing
const STEP_FIELDS: Record<StepId, string[]> = {
  1: ['business.business_name'],
  2: ['guarantor.first_name', 'guarantor.last_name', 'guarantor.fico_score'],
  3: [],
  4: ['loan_request.amount'],
};

// endregion


// ─────────────────────────────────────────────────────────────
// region 2 ── Sidebar  (desktop, left rail)
// ─────────────────────────────────────────────────────────────

function Sidebar({
  current,
  completed,
  onGo,
}: {
  current:   StepId;
  completed: Set<StepId>;
  onGo:      (n: StepId) => void;
}) {
  const pct = Math.round((completed.size / 4) * 100);

  return (
    <aside className="hidden lg:flex flex-col gap-3 w-[220px] flex-shrink-0 sticky top-24 self-start">

      {/* ── Brand / progress card ─────────────────────────── */}
      <div className="rounded-2xl p-5 text-white" style={{ background: 'linear-gradient(160deg,#111827 0%,#1f2937 100%)' }}>
        {/* Logo row */}
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-black"
            style={{ background: 'linear-gradient(135deg,#34d399,#059669)' }}>
            K
          </div>
          <span className="text-sm font-bold tracking-tight">Kaaj AI</span>
        </div>

        {/* Title */}
        <p className="text-xs text-zinc-400 mb-0.5 uppercase tracking-widest font-semibold">Application</p>
        <h2 className="text-base font-bold leading-snug mb-4">New Loan Request</h2>

        {/* Progress bar */}
        <div className="mb-1 flex justify-between items-center">
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest">Progress</span>
          <span className="text-xs font-bold tabular-nums text-emerald-400">{pct}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-zinc-700 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700 ease-out"
            style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#34d399,#059669)' }}
          />
        </div>
        <p className="text-[10px] text-zinc-600 mt-1.5">{completed.size} of 4 sections complete</p>
      </div>

      {/* ── Step list ─────────────────────────────────────── */}
      <nav className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
        {STEPS.map((s, idx) => {
          const isCurrent   = current === s.id;
          const isDone      = completed.has(s.id as StepId);
          const canClick    = isDone || current >= s.id;
          const Icon        = s.icon;

          return (
            <button
              key={s.id}
              type="button"
              onClick={() => canClick && onGo(s.id as StepId)}
              disabled={!canClick}
              className={[
                'w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors',
                idx > 0 ? 'border-t border-zinc-100' : '',
                isCurrent ? '' : canClick ? 'hover:bg-zinc-50 cursor-pointer' : 'cursor-not-allowed opacity-40',
              ].join(' ')}
              style={ isCurrent ? { backgroundColor: s.accentLight } : {} }
            >
              {/* Icon bubble */}
              <div
                className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 transition-all"
                style={{
                  background: isDone || isCurrent ? s.accentHex : '#f4f4f5',
                }}
              >
                {isDone
                  ? <Check className="w-3.5 h-3.5 text-white" />
                  : <Icon className="w-3.5 h-3.5" style={{ color: isCurrent ? '#fff' : '#a1a1aa' }} />
                }
              </div>

              {/* Labels */}
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-none truncate"
                  style={{ color: isCurrent ? s.accentText : isDone ? '#374151' : '#9ca3af' }}>
                  {s.short}
                </p>
                <p className="text-[11px] text-zinc-400 mt-0.5 truncate">{s.sublabel}</p>
              </div>

              {/* Right pip */}
              {isCurrent && (
                <div className="w-1.5 h-5 rounded-full ml-auto flex-shrink-0"
                  style={{ background: s.accentHex }} />
              )}
              {isDone && !isCurrent && (
                <CircleCheck className="w-3.5 h-3.5 ml-auto flex-shrink-0" style={{ color: s.accentHex }} />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Hint ──────────────────────────────────────────── */}
      <div className="flex items-start gap-2 px-3 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl">
        <Info className="w-3.5 h-3.5 text-zinc-400 flex-shrink-0 mt-px" />
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          <span className="text-red-500 font-bold">*</span> Required.
          Optional fields improve match accuracy.
        </p>
      </div>
    </aside>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 3 ── MobileBar
// ─────────────────────────────────────────────────────────────

function MobileBar({
  current,
  completed,
  onGo,
}: {
  current:   StepId;
  completed: Set<StepId>;
  onGo:      (n: StepId) => void;
}) {
  return (
    <div className="lg:hidden sticky top-14 z-30 bg-white border-b border-zinc-200 px-4 pt-3 pb-2"
      style={{ boxShadow: '0 2px 12px rgba(0,0,0,.06)' }}>
      {/* Steps row */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => {
          const active  = current === s.id;
          const done    = completed.has(s.id as StepId);
          const canGo   = done || current >= s.id;
          const Icon    = s.icon;
          return (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              <button
                type="button"
                onClick={() => canGo && onGo(s.id as StepId)}
                disabled={!canGo}
                className="flex flex-col items-center gap-1 flex-shrink-0 disabled:cursor-not-allowed"
              >
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300"
                  style={{
                    borderColor:     active ? s.accentHex : done ? s.accentHex : '#e4e4e7',
                    background:      active || done ? s.accentHex : '#fff',
                    boxShadow:       active ? `0 0 0 3px ${s.accentLight}` : 'none',
                  }}
                >
                  {done && !active
                    ? <Check className="w-3.5 h-3.5 text-white" />
                    : <Icon className="w-3.5 h-3.5" style={{ color: active || done ? '#fff' : '#a1a1aa' }} />
                  }
                </div>
                <span className="text-[10px] font-semibold hidden sm:block"
                  style={{ color: active ? s.accentText : done ? '#374151' : '#a1a1aa' }}>
                  {s.short}
                </span>
              </button>
              {i < 3 && (
                <div className="flex-1 h-px mx-1.5 relative overflow-hidden rounded-full bg-zinc-200">
                  <div className="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
                    style={{ width: done ? '100%' : '0%', background: s.accentHex }} />
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Overall progress micro-bar */}
      <div className="mt-2.5 h-0.5 bg-zinc-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${(completed.size / 4) * 100}%`,
            background: 'linear-gradient(90deg,#34d399,#059669)',
          }} />
      </div>
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 4 ── FieldGrid
// ─────────────────────────────────────────────────────────────

function FieldGrid({ cols = 2, children }: { cols?: 1 | 2 | 3; children: React.ReactNode }) {
  const c = { 1: 'grid-cols-1', 2: 'grid-cols-1 sm:grid-cols-2', 3: 'grid-cols-1 sm:grid-cols-3' }[cols];
  return <div className={`grid ${c} gap-4`}>{children}</div>;
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 5 ── SectionDivider
// ─────────────────────────────────────────────────────────────

function SectionDivider({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="pt-2 pb-1">
      <div className="flex items-center gap-3 mb-1">
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-zinc-400 whitespace-nowrap">
          {label}
        </p>
        <div className="flex-1 h-px bg-zinc-100" />
      </div>
      {hint && <p className="text-xs text-zinc-400 leading-relaxed">{hint}</p>}
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 6 ── CheckCard
// ─────────────────────────────────────────────────────────────

function CheckCard({
  id, name, label, sublabel,
  register: reg,
  mode = 'default',
  accentHex = '#059669',
}: {
  id:        string;
  name:      string;
  label:     string;
  sublabel?: string;
  register:  any;
  mode?:     'default' | 'danger' | 'info';
  accentHex?: string;
}) {
  const hoverCls =
    mode === 'danger'
      ? 'hover:border-rose-300 hover:bg-rose-50/60'
      : 'hover:border-zinc-300 hover:bg-white hover:shadow-sm';

  return (
    <label
      htmlFor={id}
      className={`flex items-start gap-3 px-4 py-3.5 rounded-xl border border-zinc-200 bg-zinc-50 cursor-pointer transition-all duration-150 ${hoverCls}`}
    >
      <input
        type="checkbox"
        id={id}
        className="mt-0.5 w-4 h-4 rounded flex-shrink-0"
        style={{ accentColor: accentHex } as React.CSSProperties}
        {...reg(name)}
      />
      <div className="min-w-0">
        <p className="text-sm font-semibold text-zinc-800 leading-snug">{label}</p>
        {sublabel && (
          <p className="text-xs text-zinc-500 mt-0.5 leading-snug">{sublabel}</p>
        )}
      </div>
    </label>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 7 ── AmountInput  (big $ field for step 4)
// ─────────────────────────────────────────────────────────────

function AmountInput({
  register: reg,
  error,
}: {
  register: any;
  error?:   string;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
        Loan Amount <span className="text-red-500">*</span>
      </label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 text-2xl font-black pointer-events-none select-none">
          $
        </span>
        <input
          type="number"
          min="1"
          placeholder="0"
          className={[
            'w-full pl-10 pr-5 py-4 text-3xl font-black bg-white rounded-2xl border-2 transition-all',
            'focus:outline-none focus:ring-0 placeholder:text-zinc-200',
            error
              ? 'border-red-400 focus:border-red-500'
              : 'border-zinc-200 hover:border-zinc-300 focus:border-amber-400',
          ].join(' ')}
          {...reg('loan_request.amount', {
            required:      'Loan amount is required',
            valueAsNumber: true,
            min: { value: 1, message: 'Must be at least $1' },
          })}
        />
      </div>
      {error ? (
        <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />{error}
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-400">
          <span className="font-semibold text-zinc-500">$10K – $75K</span> app-only ·{' '}
          <span className="font-semibold text-zinc-500">$75K – $1M</span> full financials required
        </p>
      )}
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 8 ── Step 1: Business
// ─────────────────────────────────────────────────────────────

function StepBusiness({ register, errors, watch }: any) {
  const isStartup = watch('business.is_startup');

  return (
    <div className="space-y-6">
      <SectionDivider label="Legal Identity" />
      <Input
        label="Legal Business Name *"
        placeholder="e.g. Acme Equipment LLC"
        error={errors.business?.business_name?.message}
        {...register('business.business_name', { required: 'Business name is required' })}
      />
      <FieldGrid cols={2}>
        <Select label="Business Type" placeholder="Select type" options={BUSINESS_TYPES}
          {...register('business.business_type')} />
        <Select label="Industry" placeholder="Select industry" options={INDUSTRIES}
          {...register('business.industry')} />
      </FieldGrid>

      <SectionDivider label="Location & Revenue" />
      <FieldGrid cols={2}>
        <Select label="Business State" placeholder="Select state" options={US_STATES}
          {...register('business.state')} />
        <Input label="Annual Revenue ($)" type="number" min="0" placeholder="e.g. 500,000"
          hint="Most recent fiscal year"
          {...register('business.annual_revenue', { valueAsNumber: true })} />
      </FieldGrid>

      <SectionDivider label="Operating History"
        hint="Both fields affect which lender programs are available." />
      <FieldGrid cols={2}>
        <Input
          label="Time in Business (years)" type="number" step="0.5" min="0"
          placeholder="e.g. 3.5"
          hint={isStartup ? '⚠ Startup flag active, routes to startup programs' : 'Years since founding'}
          {...register('business.years_in_business', { valueAsNumber: true })}
        />
        <Input label="PayNet Score" type="number" min="0" max="999" placeholder="e.g. 680"
          hint="Optional business credit score (0 – 999)"
          {...register('business.paynet_score', { valueAsNumber: true })} />
      </FieldGrid>

      <SectionDivider label="Classification" />
      <CheckCard
        id="is_startup" name="business.is_startup" register={register}
        accentHex="#059669"
        label="This is a startup"
        sublabel="Operating less than 2 years, enables Advantage+ Startup program"
      />
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 9 ── Step 2: Guarantor
// ─────────────────────────────────────────────────────────────

function StepGuarantor({ register, errors }: any) {
  return (
    <div className="space-y-6">
      <SectionDivider label="Identity" />
      <FieldGrid cols={2}>
        <Input label="First Name *" placeholder="John"
          error={errors.guarantor?.first_name?.message}
          {...register('guarantor.first_name', { required: 'Required' })} />
        <Input label="Last Name *" placeholder="Smith"
          error={errors.guarantor?.last_name?.message}
          {...register('guarantor.last_name', { required: 'Required' })} />
      </FieldGrid>

      <SectionDivider label="Credit Scores"
        hint="Used directly in lender program eligibility rules, FICO is required." />
      <FieldGrid cols={2}>
        <Input
          label="FICO Score *" type="number" min="300" max="850"
          placeholder="e.g. 720" hint="Range: 300 – 850"
          error={errors.guarantor?.fico_score?.message}
          {...register('guarantor.fico_score', {
            required: 'FICO score is required',
            valueAsNumber: true,
            min: { value: 300, message: 'Min is 300' },
            max: { value: 850, message: 'Max is 850' },
          })}
        />
        <Input label="Comparable Credit %" type="number" min="0" max="100"
          placeholder="e.g. 85"
          hint="% of loan amount covered by comparable prior financing"
          {...register('guarantor.comparable_credit_pct', { valueAsNumber: true })} />
      </FieldGrid>

      <SectionDivider label="Debt Exposure"
        hint="Stearns Bank enforces a $30K revolving debt cap, be precise." />
      <FieldGrid cols={2}>
        <Input label="Revolving Debt ($)" type="number" min="0"
          placeholder="e.g. 5,000" hint="Credit cards + revolving lines"
          {...register('guarantor.revolving_debt', { valueAsNumber: true })} />
        <Input label="Revolving + Unsecured ($)" type="number" min="0"
          placeholder="e.g. 12,000" hint="Revolving + any unsecured personal loans"
          {...register('guarantor.revolving_plus_unsecured_debt', { valueAsNumber: true })} />
      </FieldGrid>

      <SectionDivider label="Residence & Status" />
      <FieldGrid cols={2}>
        <Input label="Years at Current Address" type="number" min="0"
          placeholder="e.g. 6"
          hint="Citizens Bank Non-Homeowner program requires 5+"
          {...register('guarantor.years_at_residence', { valueAsNumber: true })} />
        <div className="flex flex-col gap-2.5 sm:pt-6">
          <CheckCard id="is_homeowner" name="guarantor.is_homeowner" register={register}
            accentHex="#2563eb"
            label="Homeowner"
            sublabel="Currently owns their primary residence" />
          <CheckCard id="is_us_citizen" name="guarantor.is_us_citizen" register={register}
            accentHex="#2563eb"
            label="US Citizen / Permanent Resident"
            sublabel="Required by Citizens Bank & Advantage+ programs" />
        </div>
      </FieldGrid>
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 10 ── Step 3: Credit History
// ─────────────────────────────────────────────────────────────

const DEROG_FLAGS = [
  { id: 'has_bankruptcy',          label: 'Bankruptcy',              sublabel: 'Prior filing, Falcon requires 15-yr lookback' },
  { id: 'has_judgement',           label: 'Judgement',               sublabel: 'Court-ordered monetary judgement on record' },
  { id: 'has_foreclosure',         label: 'Foreclosure',             sublabel: 'Prior property foreclosure on record' },
  { id: 'has_repossession',        label: 'Repossession',            sublabel: 'Prior asset repossession on record' },
  { id: 'has_tax_lien',            label: 'Tax Lien',                sublabel: 'Federal or state tax lien on record' },
  { id: 'has_collections_last_3y', label: 'Collections (Last 3 Yrs)',sublabel: 'Any account sent to collections in past 3 years' },
];

function StepDerogatory({ register, watch }: any) {
  const hasBankruptcy = watch('guarantor.has_bankruptcy');

  return (
    <div className="space-y-6">
      {/* Impact warning */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-amber-200 bg-amber-50">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <div className="text-xs text-amber-800 space-y-1">
          <p className="font-bold text-amber-900">
            These marks are hard disqualifiers for most lenders.
          </p>
          <p className="leading-relaxed">
            Leave all unchecked if the guarantor has a clean record. Each checked
            item routes the application away from lenders that cannot accommodate it.
          </p>
        </div>
      </div>

      <SectionDivider label="Check All That Apply" />
      <FieldGrid cols={2}>
        {DEROG_FLAGS.map(f => (
          <CheckCard
            key={f.id}
            id={f.id}
            name={`guarantor.${f.id}`}
            register={register}
            label={f.label}
            sublabel={f.sublabel}
            mode="danger"
            accentHex="#e11d48"
          />
        ))}
      </FieldGrid>

      {/* Conditional: bankruptcy discharge years */}
      {hasBankruptcy && (
        <>
          <SectionDivider label="Bankruptcy Detail" />
          <div className="max-w-xs">
            <Input
              label="Years Since Discharge"
              type="number" min="0" max="30" placeholder="e.g. 8"
              hint="Falcon Equipment: 15+ yrs · Most lenders: 7+ yrs"
              {...register('guarantor.years_since_bankruptcy', { valueAsNumber: true })}
            />
          </div>
        </>
      )}

      {/* Clean record notice */}
      <div className="flex items-start gap-3 p-4 rounded-xl border border-emerald-200 bg-emerald-50">
        <Check className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-emerald-800 leading-relaxed">
          If none apply, leave all boxes unchecked, the guarantor will be treated
          as having a <strong>clean derogatory record</strong> across all lender evaluations.
        </p>
      </div>
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 11 ── Step 4: Loan Request
// ─────────────────────────────────────────────────────────────

function StepLoan({ register, errors }: any) {
  const year = new Date().getFullYear();

  return (
    <div className="space-y-6">
      <SectionDivider label="Financing Amount" />
      <AmountInput register={register} error={errors.loan_request?.amount?.message} />

      <SectionDivider label="Loan Term" />
      <div className="max-w-sm">
        <Select label="Repayment Period" placeholder="Select term length" options={LOAN_TERMS}
          {...register('loan_request.term_months', { valueAsNumber: true })} />
      </div>

      <SectionDivider label="Equipment Details"
        hint="Type and age drive program eligibility, Class 8 trucks need Falcon's trucking program." />
      <FieldGrid cols={2}>
        <Select label="Equipment Type" placeholder="Select type" options={EQUIPMENT_TYPES}
          {...register('loan_request.equipment_type')} />
        <Input
          label="Equipment Year" type="number" min="1980" max={year}
          placeholder={`e.g. ${year - 3}`}
          hint={`Equipment age = ${year} − entered year`}
          {...register('loan_request.equipment_year', { valueAsNumber: true })}
        />
        <Input label="Equipment Mileage" type="number" min="0"
          placeholder="e.g. 45,000"
          hint="Optional, trucks and titled assets only"
          {...register('loan_request.equipment_mileage', { valueAsNumber: true })} />
      </FieldGrid>

      <SectionDivider label="Transaction Flags" />
      <FieldGrid cols={2}>
        <CheckCard id="is_private_party" name="loan_request.is_private_party"
          register={register} accentHex="#d97706"
          label="Private Party Sale"
          sublabel="Equipment purchased from an individual, not a dealer" />
        <CheckCard id="is_titled_asset" name="loan_request.is_titled_asset"
          register={register} accentHex="#d97706"
          label="Titled Asset"
          sublabel="Vehicle or asset requiring DMV title transfer" />
      </FieldGrid>
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 12 ── ApplicationFormPage  (root)
// ─────────────────────────────────────────────────────────────

export default function ApplicationFormPage() {
  const [step,       setStep]       = useState<StepId>(1);
  const [completed,  setCompleted]  = useState<Set<StepId>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [submitErr,  setSubmitErr]  = useState('');
  const navigate  = useNavigate();
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    register, handleSubmit, watch, trigger,
    formState: { errors },
  } = useForm<ApplicationFormData>({
    mode: 'onChange',
    defaultValues: {
      business:     { is_startup: false },
      guarantor:    {
        is_homeowner: false, is_us_citizen: true,
        has_bankruptcy: false, has_judgement: false,
        has_foreclosure: false, has_repossession: false,
        has_tax_lien: false, has_collections_last_3y: false,
      },
      loan_request: { is_private_party: false, is_titled_asset: false },
    },
  });

  const meta = STEPS[step - 1];

  const scrollTop = () =>
    contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' });

  const goNext = async () => {
    const fields = STEP_FIELDS[step];
    if (fields.length && !(await trigger(fields as any))) return;
    setCompleted(prev => new Set([...prev, step]));
    setStep(s => Math.min(s + 1, 4) as StepId);
    scrollTop();
  };

  const goBack = () => {
    setStep(s => Math.max(s - 1, 1) as StepId);
    scrollTop();
  };

  const goTo = (n: StepId) => { setStep(n); scrollTop(); };

  const onSubmit = async (data: ApplicationFormData) => {
    setSubmitting(true);
    setSubmitErr('');
    try {
      const app    = await applicationsApi.create(data);
      const result = await underwritingApi.run(app.id);
      // Pass result through nav state — ResultsPage uses it directly,
      // skipping the redundant GET /underwriting/results/:id call.
      navigate(`/results/${app.id}`, { state: { runResult: result } });
    } catch (e: any) {
      setSubmitErr(e?.message ?? 'Submission failed. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100/60">

      {/* Mobile stepper */}
      <MobileBar current={step} completed={completed} onGo={goTo} />

      {/* Page layout */}
      <div className="max-w-5xl mx-auto px-4 py-8 flex gap-6 items-start">

        {/* Sidebar */}
        <Sidebar current={step} completed={completed} onGo={goTo} />

        {/* Main card */}
        <div className="flex-1 min-w-0" ref={contentRef}>
          <form onSubmit={handleSubmit(onSubmit)} noValidate>

            {/* ── Card ────────────────────────────────────── */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,.08)]">

              {/* Coloured header band */}
              <div
                className="px-7 py-5 flex items-center gap-4 relative overflow-hidden"
                style={{ background: `linear-gradient(135deg, ${meta.accentHex}18 0%, ${meta.accentHex}08 100%)` }}
              >
                {/* Decorative orb */}
                <div
                  className="absolute -right-8 -top-8 w-32 h-32 rounded-full opacity-10 pointer-events-none"
                  style={{ background: meta.accentHex }}
                />

                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${meta.accentHex}, ${meta.accentHex}cc)` }}
                >
                  <meta.icon className="w-6 h-6 text-white" />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-[0.15em] mb-0.5"
                    style={{ color: meta.accentHex }}>
                    Step {step} of 4
                  </p>
                  <h1 className="text-xl font-black text-zinc-900 leading-tight">{meta.label}</h1>
                  <p className="text-sm text-zinc-500 mt-0.5">{meta.sublabel}</p>
                </div>

                {/* Desktop step dots */}
                <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
                  {STEPS.map(s => (
                    <div
                      key={s.id}
                      className="rounded-full transition-all duration-300"
                      style={{
                        width:      s.id === step ? 20 : 8,
                        height:     8,
                        background: completed.has(s.id as StepId)
                          ? s.accentHex
                          : s.id === step
                          ? meta.accentHex
                          : '#e4e4e7',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* ── Step body ───────────────────────────── */}
              <div className="px-7 py-7">
                {step === 1 && <StepBusiness   register={register} errors={errors} watch={watch} />}
                {step === 2 && <StepGuarantor  register={register} errors={errors} />}
                {step === 3 && <StepDerogatory register={register} watch={watch} />}
                {step === 4 && <StepLoan       register={register} errors={errors} />}
              </div>

              {/* ── Footer nav ──────────────────────────── */}
              <div className="px-7 py-4 border-t border-zinc-100 bg-zinc-50/80 flex items-center justify-between gap-4">

                {/* Back */}
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={goBack}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold text-zinc-600 bg-white border border-zinc-200 hover:border-zinc-300 hover:text-zinc-900 hover:shadow-sm transition-all"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Back
                  </button>
                ) : (
                  <div /> /* spacer */
                )}

                <div className="flex items-center gap-3">
                  {/* Submit error */}
                  {submitErr && (
                    <p className="text-xs text-red-600 flex items-center gap-1.5 max-w-[200px]">
                      <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
                      {submitErr}
                    </p>
                  )}

                  {/* Continue / Submit */}
                  {step < 4 ? (
                    <button
                      type="button"
                      onClick={goNext}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.98] shadow-sm"
                      style={{ background: `linear-gradient(135deg, ${meta.accentHex}, ${meta.accentHex}dd)` }}
                    >
                      Continue
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting}
                      className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:opacity-90 active:scale-[.98] disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                      style={{ background: 'linear-gradient(135deg,#059669,#047857)' }}
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Running Underwriting…
                        </>
                      ) : (
                        <>
                          <CircleCheck className="w-4 h-4" />
                          Find Matching Lenders
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Step counter hint */}
            <p className="text-center text-[11px] text-zinc-400 mt-3 tabular-nums">
              Step {step} of {STEPS.length}
              <span className="mx-1.5 opacity-40">·</span>
              <span style={{ color: meta.accentHex }} className="font-semibold">{meta.label}</span>
              {completed.size > 0 && (
                <>
                  <span className="mx-1.5 opacity-40">·</span>
                  <span className="text-emerald-600 font-semibold">{completed.size} section{completed.size > 1 ? 's' : ''} complete</span>
                </>
              )}
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}

// endregion