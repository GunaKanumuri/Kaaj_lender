// ============================================================
// src/pages/ApplicationDetailPage.tsx
//
// Read + edit view of a submitted loan application.
// Each section has an Edit button → inline form → Save calls
// PUT /api/v1/applications/:id with that section's data.
//
// TABLE OF CONTENTS
//   1.  Constants        — US_STATES, INDUSTRIES, EQUIPMENT_TYPES
//   2.  View helpers     — DetailRow, SectionCard, BoolBadge
//   3.  Edit primitives  — FieldInput, FieldSelect, CheckRow
//   4.  Edit forms       — BusinessEditForm, GuarantorEditForm,
//                          CreditEditForm, LoanEditForm
//   5.  View sections    — BusinessView, GuarantorView,
//                          CreditView, LoanView
//   6.  EditableSection  — view ↔ edit toggle wrapper
//   7.  ApplicationDetailPage — root component
// ============================================================

import { useEffect, useState }          from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  ArrowLeft, Building2, User, ShieldAlert, DollarSign,
  CheckCircle, XCircle, Play, Loader2, Clock, TrendingUp,
  AlertTriangle, Edit2, Check, X,
} from 'lucide-react';
import { applicationsApi } from '../api/applications';
import { underwritingApi } from '../api/underwriting';
import { Badge }           from '../components/ui/Badge';
import type { Application, Business, PersonalGuarantor, LoanRequest } from '../types';


// ─────────────────────────────────────────────────────────────
// region 1 ── Constants
// ─────────────────────────────────────────────────────────────

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
];

const INDUSTRIES = [
  'Construction','Medical','Dental','Veterinary','Healthcare',
  'Transportation','Trucking','Manufacturing','Agriculture',
  'Food Service','Restaurant','Retail','Technology',
  'Automotive Repair','Landscaping','Janitorial','Logistics',
  'Oil & Gas','Cannabis','Gaming','Gambling','Real Estate','Other',
];

const EQUIPMENT_TYPES = [
  'Construction Equipment','Forklift','Medical Equipment','Dental Equipment',
  'Trucking / OTR','Semi Truck','Trailer','Agricultural Equipment',
  'Machine Tools','Industrial Machinery','Vocational Trucks',
  'Automotive Repair Equipment','Janitorial Equipment','Lawn Equipment',
  'Restaurant Equipment','Audio Visual','Office Equipment','Other',
];

const BUSINESS_TYPES = ['LLC','Corporation','Sole Proprietorship','Partnership'];
const LOAN_TERMS     = [24, 36, 48, 60, 72, 84];

const DEROG_FLAGS = [
  { key: 'has_bankruptcy',           label: 'Bankruptcy',               sublabel: 'Falcon requires 15-yr lookback'    },
  { key: 'has_judgement',            label: 'Judgement',                sublabel: 'Court-ordered monetary judgement'  },
  { key: 'has_foreclosure',          label: 'Foreclosure',              sublabel: 'Prior property foreclosure'        },
  { key: 'has_repossession',         label: 'Repossession',             sublabel: 'Prior asset repossession'          },
  { key: 'has_tax_lien',             label: 'Tax Lien',                 sublabel: 'Federal or state tax lien'         },
  { key: 'has_collections_last_3y',  label: 'Collections (last 3 yrs)',  sublabel: 'Any account in collections'       },
] as const;

// endregion


// ─────────────────────────────────────────────────────────────
// region 2 ── View helpers
// ─────────────────────────────────────────────────────────────

function DetailRow({ label, value, missing = false }: {
  label: string; value: React.ReactNode; missing?: boolean;
}) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-zinc-100 last:border-0">
      <span className="text-sm text-zinc-500 flex-shrink-0 w-48">{label}</span>
      <span className={`text-sm text-right flex-1 font-medium ${missing ? 'text-zinc-300 italic' : 'text-zinc-900'}`}>
        {missing ? 'Not provided' : value}
      </span>
    </div>
  );
}

function BoolBadge({ value, trueLabel = 'Yes', falseLabel = 'No' }: {
  value: boolean; trueLabel?: string; falseLabel?: string;
}) {
  return value
    ? <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold"><CheckCircle className="w-3.5 h-3.5" />{trueLabel}</span>
    : <span className="inline-flex items-center gap-1 text-zinc-400"><XCircle className="w-3.5 h-3.5" />{falseLabel}</span>;
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 3 ── Edit primitives
// ─────────────────────────────────────────────────────────────

const inputCls = 'w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent bg-white';

function FieldInput({ label, type = 'text', value, onChange, placeholder, hint, required }: {
  label: string; type?: string; value: string | number; required?: boolean;
  onChange: (v: string) => void; placeholder?: string; hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} className={inputCls} />
      {hint && <p className="text-[11px] text-zinc-400 mt-1">{hint}</p>}
    </div>
  );
}

function FieldSelect({ label, value, onChange, options, placeholder }: {
  label: string; value: string; onChange: (v: string) => void;
  options: string[]; placeholder?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-zinc-600 mb-1">{label}</label>
      <select value={value} onChange={e => onChange(e.target.value)} className={inputCls}>
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function CheckRow({ label, sublabel, checked, onChange }: {
  label: string; sublabel?: string; checked: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3 px-4 py-3 rounded-xl border border-zinc-200 bg-zinc-50 cursor-pointer hover:border-zinc-300 hover:bg-white transition-all">
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        className="mt-0.5 w-4 h-4 rounded flex-shrink-0 accent-emerald-600" />
      <div>
        <p className="text-sm font-semibold text-zinc-800 leading-snug">{label}</p>
        {sublabel && <p className="text-xs text-zinc-500 mt-0.5">{sublabel}</p>}
      </div>
    </label>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 4 ── Edit forms
// ─────────────────────────────────────────────────────────────

function BusinessEditForm({ data, onChange }: { data: Business; onChange: (d: Business) => void }) {
  const set    = (k: keyof Business) => (v: string) => onChange({ ...data, [k]: v || undefined });
  const setNum = (k: keyof Business) => (v: string) =>
    onChange({ ...data, [k]: v === '' ? undefined : parseFloat(v) } as Business);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <FieldInput label="Legal Business Name" required value={data.business_name ?? ''}
          onChange={v => onChange({ ...data, business_name: v })} placeholder="e.g. Acme Equipment LLC" />
      </div>
      <FieldSelect label="Business Type" value={data.business_type ?? ''} onChange={set('business_type')}
        options={BUSINESS_TYPES} placeholder="Select type" />
      <FieldSelect label="Industry" value={data.industry ?? ''} onChange={set('industry')}
        options={INDUSTRIES} placeholder="Select industry" />
      <FieldSelect label="State" value={data.state ?? ''} onChange={set('state')}
        options={US_STATES} placeholder="Select state" />
      <FieldInput label="Annual Revenue ($)" type="number" value={data.annual_revenue ?? ''}
        onChange={setNum('annual_revenue')} placeholder="e.g. 500000" />
      <FieldInput label="Time in Business (years)" type="number" value={data.years_in_business ?? ''}
        onChange={setNum('years_in_business')} placeholder="e.g. 3.5" />
      <FieldInput label="PayNet Score" type="number" value={data.paynet_score ?? ''}
        onChange={v => onChange({ ...data, paynet_score: v === '' ? undefined : parseInt(v) })}
        placeholder="e.g. 680" hint="Optional — 0 to 999" />
      <div className="col-span-2">
        <CheckRow label="This is a startup"
          sublabel="Enables Advantage+ Startup program; operating less than 2 years"
          checked={!!data.is_startup} onChange={v => onChange({ ...data, is_startup: v })} />
      </div>
    </div>
  );
}

function GuarantorEditForm({ data, onChange }: { data: PersonalGuarantor; onChange: (d: PersonalGuarantor) => void }) {
  const setNum = (k: keyof PersonalGuarantor) => (v: string) =>
    onChange({ ...data, [k]: v === '' ? undefined : parseFloat(v) } as PersonalGuarantor);

  return (
    <div className="grid grid-cols-2 gap-3">
      <FieldInput label="First Name" required value={data.first_name ?? ''}
        onChange={v => onChange({ ...data, first_name: v })} placeholder="John" />
      <FieldInput label="Last Name" required value={data.last_name ?? ''}
        onChange={v => onChange({ ...data, last_name: v })} placeholder="Smith" />
      <FieldInput label="FICO Score" required type="number" value={data.fico_score ?? ''}
        onChange={v => onChange({ ...data, fico_score: v === '' ? undefined : parseInt(v) })}
        placeholder="e.g. 720" hint="Range: 300 – 850" />
      <FieldInput label="Comparable Credit %" type="number" value={data.comparable_credit_pct ?? ''}
        onChange={setNum('comparable_credit_pct')} placeholder="e.g. 85"
        hint="% of loan covered by comparable credit" />
      <FieldInput label="Revolving Debt ($)" type="number" value={data.revolving_debt ?? ''}
        onChange={setNum('revolving_debt')} placeholder="e.g. 5000" />
      <FieldInput label="Revolving + Unsecured ($)" type="number"
        value={data.revolving_plus_unsecured_debt ?? ''}
        onChange={setNum('revolving_plus_unsecured_debt')} placeholder="e.g. 12000" />
      <FieldInput label="Years at Current Address" type="number" value={data.years_at_residence ?? ''}
        onChange={setNum('years_at_residence')} placeholder="e.g. 6" />
      <div /> {/* spacer */}
      <CheckRow label="Homeowner" sublabel="Currently owns primary residence"
        checked={!!data.is_homeowner} onChange={v => onChange({ ...data, is_homeowner: v })} />
      <CheckRow label="US Citizen / Permanent Resident"
        sublabel="Required by Citizens Bank & Advantage+ programs"
        checked={!!data.is_us_citizen} onChange={v => onChange({ ...data, is_us_citizen: v })} />
    </div>
  );
}

function CreditEditForm({ data, onChange }: { data: PersonalGuarantor; onChange: (d: PersonalGuarantor) => void }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl">
        <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-amber-800 leading-relaxed">
          These are hard disqualifiers for most lenders. Leave unchecked if the record is clean.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {DEROG_FLAGS.map(f => (
          <CheckRow key={f.key} label={f.label} sublabel={f.sublabel}
            checked={!!(data as any)[f.key]}
            onChange={v => onChange({ ...data, [f.key]: v })} />
        ))}
      </div>
      {data.has_bankruptcy && (
        <FieldInput label="Years Since Bankruptcy Discharge" type="number"
          value={data.years_since_bankruptcy ?? ''}
          onChange={v => onChange({ ...data, years_since_bankruptcy: v === '' ? undefined : parseFloat(v) })}
          placeholder="e.g. 8" hint="Falcon Equipment requires 15+ years" />
      )}
    </div>
  );
}

function LoanEditForm({ data, onChange }: { data: LoanRequest; onChange: (d: LoanRequest) => void }) {
  const year = new Date().getFullYear();
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="col-span-2">
        <FieldInput label="Loan Amount ($)" required type="number" value={data.amount ?? ''}
          onChange={v => onChange({ ...data, amount: parseFloat(v) || 0 })} placeholder="e.g. 75000" />
      </div>
      <div>
        <label className="block text-xs font-semibold text-zinc-600 mb-1">Loan Term</label>
        <select value={data.term_months ?? ''}
          onChange={e => onChange({ ...data, term_months: parseInt(e.target.value) || undefined })}
          className={inputCls}>
          <option value="">Select term</option>
          {LOAN_TERMS.map(t => <option key={t} value={t}>{t} months ({t / 12}y)</option>)}
        </select>
      </div>
      <FieldSelect label="Equipment Type" value={data.equipment_type ?? ''}
        onChange={v => onChange({ ...data, equipment_type: v || undefined })}
        options={EQUIPMENT_TYPES} placeholder="Select type" />
      <FieldInput label="Equipment Year" type="number" value={data.equipment_year ?? ''}
        onChange={v => onChange({ ...data, equipment_year: v === '' ? undefined : parseInt(v) })}
        placeholder={`e.g. ${year - 3}`} hint={`${year} − year = age`} />
      <FieldInput label="Equipment Mileage" type="number" value={data.equipment_mileage ?? ''}
        onChange={v => onChange({ ...data, equipment_mileage: v === '' ? undefined : parseInt(v) })}
        placeholder="e.g. 45000" hint="Optional — trucks / titled assets" />
      <CheckRow label="Private Party Sale" sublabel="Purchased from individual, not a dealer"
        checked={!!data.is_private_party} onChange={v => onChange({ ...data, is_private_party: v })} />
      <CheckRow label="Titled Asset" sublabel="Vehicle requiring DMV title transfer"
        checked={!!data.is_titled_asset} onChange={v => onChange({ ...data, is_titled_asset: v })} />
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 5 ── View sections (read-only display)
// ─────────────────────────────────────────────────────────────

function BusinessView({ b }: { b: Business }) {
  return (
    <>
      <DetailRow label="Legal Name"       value={b.business_name} />
      <DetailRow label="Business Type"    value={b.business_type}        missing={!b.business_type} />
      <DetailRow label="Industry"         value={b.industry}             missing={!b.industry} />
      <DetailRow label="State"            value={b.state}                missing={!b.state} />
      <DetailRow label="Time in Business"
        value={b.years_in_business != null ? `${b.years_in_business} yr${b.years_in_business !== 1 ? 's' : ''}` : null}
        missing={b.years_in_business == null} />
      <DetailRow label="Annual Revenue"
        value={b.annual_revenue != null ? `$${b.annual_revenue.toLocaleString()}` : null}
        missing={b.annual_revenue == null} />
      <DetailRow label="PayNet Score"     value={b.paynet_score}         missing={b.paynet_score == null} />
      <DetailRow label="Startup"          value={<BoolBadge value={b.is_startup} trueLabel="Yes — startup" />} />
    </>
  );
}

function GuarantorView({ g }: { g: PersonalGuarantor }) {
  return (
    <>
      <DetailRow label="Full Name"         value={`${g.first_name} ${g.last_name}`} />
      <DetailRow label="FICO Score"
        value={g.fico_score != null
          ? <span className={`font-bold ${g.fico_score >= 720 ? 'text-emerald-700' : g.fico_score >= 680 ? 'text-amber-600' : 'text-rose-600'}`}>{g.fico_score}</span>
          : null}
        missing={g.fico_score == null} />
      <DetailRow label="Comparable Credit" value={g.comparable_credit_pct != null ? `${g.comparable_credit_pct}%` : null}            missing={g.comparable_credit_pct == null} />
      <DetailRow label="Revolving Debt"    value={g.revolving_debt != null ? `$${g.revolving_debt.toLocaleString()}` : null}          missing={g.revolving_debt == null} />
      <DetailRow label="Revolving + Unsec" value={g.revolving_plus_unsecured_debt != null ? `$${g.revolving_plus_unsecured_debt.toLocaleString()}` : null} missing={g.revolving_plus_unsecured_debt == null} />
      <DetailRow label="Years at Address"  value={g.years_at_residence != null ? `${g.years_at_residence} years` : null}              missing={g.years_at_residence == null} />
      <DetailRow label="Homeowner"         value={<BoolBadge value={g.is_homeowner} />} />
      <DetailRow label="US Citizen / PR"   value={<BoolBadge value={g.is_us_citizen} />} />
    </>
  );
}

function CreditView({ g }: { g: PersonalGuarantor }) {
  const active = DEROG_FLAGS.filter(f => !!(g as any)[f.key]);
  if (active.length === 0) return (
    <div className="flex items-center gap-2 py-3">
      <CheckCircle className="w-4 h-4 text-emerald-500" />
      <span className="text-sm font-semibold text-emerald-700">Clean record — no derogatory marks</span>
    </div>
  );
  return (
    <div className="py-2 space-y-1.5">
      {active.map(f => (
        <div key={f.key} className="flex items-center gap-2 py-1">
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500 flex-shrink-0" />
          <span className="text-sm font-semibold text-rose-700">{f.label}</span>
          {f.key === 'has_bankruptcy' && g.years_since_bankruptcy != null && (
            <span className="text-xs text-zinc-500">— {g.years_since_bankruptcy} yrs since discharge</span>
          )}
        </div>
      ))}
    </div>
  );
}

function LoanView({ lr }: { lr: LoanRequest }) {
  const year = new Date().getFullYear();
  return (
    <>
      <DetailRow label="Loan Amount"
        value={<span className="text-lg font-black text-amber-700">${lr.amount.toLocaleString()}</span>} />
      <DetailRow label="Term"
        value={lr.term_months != null ? `${lr.term_months} months` : null} missing={lr.term_months == null} />
      <DetailRow label="Equipment Type"  value={lr.equipment_type}    missing={!lr.equipment_type} />
      <DetailRow label="Equipment Year"
        value={lr.equipment_year != null ? `${lr.equipment_year} (${year - lr.equipment_year} yrs old)` : null}
        missing={lr.equipment_year == null} />
      <DetailRow label="Mileage"
        value={lr.equipment_mileage != null ? lr.equipment_mileage.toLocaleString() : null}
        missing={lr.equipment_mileage == null} />
      <DetailRow label="Private Party"   value={<BoolBadge value={lr.is_private_party} />} />
      <DetailRow label="Titled Asset"    value={<BoolBadge value={lr.is_titled_asset} />} />
    </>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 6 ── EditableSection
//
// Generic wrapper — shows view content by default.
// "Edit" in header → inline edit form.
// "Save Changes" → calls onSave(draft) → flips back to view.
// "Cancel"       → discards draft, flips back to view.
// ─────────────────────────────────────────────────────────────

function EditableSection<T>({
  icon: Icon, label, accentHex, data,
  renderView, renderEdit, onSave,
}: {
  icon:       React.ElementType;
  label:      string;
  accentHex:  string;
  data:       T;
  renderView: (d: T) => React.ReactNode;
  renderEdit: (d: T, set: (d: T) => void) => React.ReactNode;
  onSave:     (d: T) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState<T>(data);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => { if (!editing) setDraft(data); }, [data, editing]);

  const handleSave = async () => {
    setSaving(true); setError('');
    try   { await onSave(draft); setEditing(false); }
    catch (e: any) { setError(e?.response?.data?.detail ?? e?.message ?? 'Save failed.'); }
    finally { setSaving(false); }
  };

  const handleCancel = () => { setDraft(data); setEditing(false); setError(''); };

  return (
    <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
      {/* Section header */}
      <div className="flex items-center justify-between px-5 py-3.5"
        style={{ background: `linear-gradient(135deg, ${accentHex}14, ${accentHex}06)` }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{ background: `linear-gradient(135deg, ${accentHex}, ${accentHex}cc)` }}>
            <Icon className="w-4 h-4 text-white" />
          </div>
          <h2 className="text-sm font-black uppercase tracking-[0.12em]" style={{ color: accentHex }}>
            {label}
          </h2>
        </div>

        {editing ? (
          <div className="flex items-center gap-2">
            {error && (
              <span className="text-xs text-red-500 flex items-center gap-1 max-w-xs">
                <AlertTriangle className="w-3 h-3 flex-shrink-0" />{error}
              </span>
            )}
            <button onClick={handleCancel} disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 hover:border-zinc-300 disabled:opacity-50 transition-all">
              <X className="w-3.5 h-3.5" /> Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-all shadow-sm">
              {saving
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…</>
                : <><Check className="w-3.5 h-3.5" /> Save Changes</>
              }
            </button>
          </div>
        ) : (
          <button onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all">
            <Edit2 className="w-3.5 h-3.5" /> Edit
          </button>
        )}
      </div>

      {/* Body */}
      <div className={editing ? 'px-5 py-4' : 'px-5 py-1'}>
        {editing ? renderEdit(draft, setDraft) : renderView(data)}
      </div>
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 7 ── ApplicationDetailPage
// ─────────────────────────────────────────────────────────────

export default function ApplicationDetailPage() {
  const { id }   = useParams<{ id: string }>();
  const navigate = useNavigate();
  const appId    = Number(id);

  const [app,      setApp]      = useState<Application | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [running,  setRunning]  = useState(false);
  const [runError, setRunError] = useState('');

  useEffect(() => {
    applicationsApi.get(appId)
      .then(setApp)
      .catch(() => navigate('/applications'))
      .finally(() => setLoading(false));
  }, [appId]);

  const saveBusiness  = async (business: Business)         => setApp(await applicationsApi.update(appId, { business }     as any));
  const saveGuarantor = async (guarantor: PersonalGuarantor) => setApp(await applicationsApi.update(appId, { guarantor }  as any));
  const saveLoan      = async (loan_request: LoanRequest)  => setApp(await applicationsApi.update(appId, { loan_request } as any));
  // Credit history lives on the guarantor model
  const saveCredit    = async (guarantor: PersonalGuarantor) => setApp(await applicationsApi.update(appId, { guarantor }  as any));

  const handleRun = async () => {
    setRunning(true); setRunError('');
    try {
      const result = await underwritingApi.run(appId);
      navigate(`/results/${appId}`, { state: { runResult: result } });
    } catch (e: any) {
      setRunError(e?.message ?? 'Underwriting failed.');
      setRunning(false);
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-[400px]">
      <Loader2 className="w-7 h-7 text-emerald-600 animate-spin" />
    </div>
  );
  if (!app) return null;

  const isCompleted = app.status === 'completed';

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">

      {/* Back */}
      <Link to="/applications"
        className="inline-flex items-center gap-1 text-sm text-zinc-500 hover:text-zinc-700 mb-5">
        <ArrowLeft className="w-4 h-4" /> Back to Applications
      </Link>

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">
            {app.business?.business_name || `Application #${app.id}`}
          </h1>
          <div className="flex items-center gap-3 mt-1.5 text-sm text-zinc-500 flex-wrap">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(app.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </span>
            {app.loan_request?.amount && (
              <span className="font-semibold text-zinc-700">${app.loan_request.amount.toLocaleString()}</span>
            )}
            {app.business?.state    && <span>{app.business.state}</span>}
            {app.business?.industry && <span>{app.business.industry}</span>}
            {isCompleted ? <Badge variant="success">Evaluated</Badge> : <Badge variant="neutral">Not evaluated</Badge>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {isCompleted ? (
            <>
              <button onClick={() => navigate(`/results/${appId}`)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm">
                <TrendingUp className="w-4 h-4" /> View Results
              </button>
              <button onClick={handleRun} disabled={running}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-zinc-600 bg-white border border-zinc-200 hover:border-zinc-300 transition-all">
                {running ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Re-running…</> : <><Play className="w-3.5 h-3.5" /> Re-run Underwriting</>}
              </button>
            </>
          ) : (
            <button onClick={handleRun} disabled={running}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 transition-all shadow-sm">
              {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</> : <><Play className="w-4 h-4" /> Run Underwriting</>}
            </button>
          )}
          {runError && (
            <p className="text-xs text-red-600 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3 flex-shrink-0" />{runError}
            </p>
          )}
        </div>
      </div>

      {/* Quick-stat strip */}
      {app.guarantor && (
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            {
              label: 'FICO Score',
              value: app.guarantor.fico_score ?? '—',
              color: app.guarantor.fico_score == null ? '#a1a1aa'
                : app.guarantor.fico_score >= 720 ? '#059669'
                : app.guarantor.fico_score >= 680 ? '#d97706' : '#e11d48',
            },
            { label: 'PayNet Score',     value: app.business?.paynet_score ?? '—',          color: '#2563eb' },
            { label: 'Time in Business', value: app.business?.years_in_business != null ? `${app.business.years_in_business}y` : '—', color: '#7c3aed' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl border border-zinc-200 px-4 py-3 text-center shadow-sm">
              <div className="text-2xl font-black" style={{ color: s.color }}>{s.value}</div>
              <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Edit hint */}
      <div className="flex items-center gap-2 p-3 mb-4 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-700">
        <Edit2 className="w-3.5 h-3.5 flex-shrink-0" />
        Click <strong className="mx-1">Edit</strong> on any section to correct a value, then
        <strong className="mx-1">Save Changes</strong>. Re-run underwriting after editing for fresh results.
      </div>

      {/* Sections */}
      <div className="space-y-4">
        {app.business && (
          <EditableSection
            icon={Building2} label="Business" accentHex="#059669"
            data={app.business}
            renderView={d => <BusinessView b={d} />}
            renderEdit={(d, set) => <BusinessEditForm data={d} onChange={set} />}
            onSave={saveBusiness}
          />
        )}
        {app.guarantor && (
          <EditableSection
            icon={User} label="Personal Guarantor" accentHex="#2563eb"
            data={app.guarantor}
            renderView={d => <GuarantorView g={d} />}
            renderEdit={(d, set) => <GuarantorEditForm data={d} onChange={set} />}
            onSave={saveGuarantor}
          />
        )}
        {app.guarantor && (
          <EditableSection
            icon={ShieldAlert} label="Credit History" accentHex="#e11d48"
            data={app.guarantor}
            renderView={d => <CreditView g={d} />}
            renderEdit={(d, set) => <CreditEditForm data={d} onChange={set} />}
            onSave={saveCredit}
          />
        )}
        {app.loan_request && (
          <EditableSection
            icon={DollarSign} label="Loan Request" accentHex="#d97706"
            data={app.loan_request}
            renderView={d => <LoanView lr={d} />}
            renderEdit={(d, set) => <LoanEditForm data={d} onChange={set} />}
            onSave={saveLoan}
          />
        )}
      </div>

      <p className="text-center text-xs text-zinc-300 mt-6">Application ID #{app.id}</p>
    </div>
  );
}

// endregion