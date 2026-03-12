// ============================================================
// src/pages/LendersPage.tsx
//
// Lender policy management — view, edit rules, add rules,
// and ADD NEW LENDERS via modal wizard.
//
// TABLE OF CONTENTS
//   1.  Constants        — FIELD_OPTIONS, OPERATOR_OPTIONS
//   2.  RuleEditor       — inline edit form for existing rule
//   3.  PolicyRuleRow    — view + edit toggle row
//   4.  AddRuleForm      — inline add-rule form per program
//   5.  ProgramAccordion — collapsible program with rules list
//   6.  LenderCard       — collapsible lender with programs
//   7.  AddLenderModal   — 3-step wizard: lender → programs → review
//   8.  LendersPage      — root page component
// ============================================================

import { useEffect, useState, useRef } from 'react';
import {
  ChevronDown, ChevronUp, Building2, Shield,
  Edit2, Check, X, Plus, Trash2,
  ArrowRight, ArrowLeft, Loader2, CheckCircle,
  AlertTriangle, Info,
} from 'lucide-react';
import { lendersApi } from '../api/lenders';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import type { Lender, LenderProgram, PolicyRule } from '../types';


// ─────────────────────────────────────────────────────────────
// region 1 ── Constants
// ─────────────────────────────────────────────────────────────

const FIELD_OPTIONS = [
  'fico_score', 'paynet_score', 'time_in_business_years', 'annual_revenue',
  'business_state', 'industry', 'is_startup', 'is_homeowner', 'is_us_citizen',
  'years_at_residence', 'has_bankruptcy', 'has_judgement', 'has_foreclosure',
  'has_repossession', 'has_tax_lien', 'has_collections_last_3y',
  'revolving_debt', 'revolving_plus_unsecured_debt', 'comparable_credit_pct',
  'loan_amount', 'loan_term_months', 'equipment_type', 'equipment_age_years',
  'equipment_mileage', 'is_private_party', 'is_titled_asset',
];

const OPERATOR_OPTIONS = [
  { value: 'gte',     label: '>= (at least)'     },
  { value: 'lte',     label: '<= (at most)'       },
  { value: 'gt',      label: '> (greater than)'   },
  { value: 'lt',      label: '< (less than)'      },
  { value: 'eq',      label: '= (equals)'         },
  { value: 'neq',     label: '≠ (not equals)'     },
  { value: 'in',      label: 'in (allowed list)'  },
  { value: 'not_in',  label: 'not in (excluded)'  },
  { value: 'between', label: 'between (range)'    },
];

// endregion


// ─────────────────────────────────────────────────────────────
// region 2 ── RuleEditor
// ─────────────────────────────────────────────────────────────

interface RuleEditorProps {
  rule:     PolicyRule;
  onSave:   (updated: Partial<PolicyRule>) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}

function RuleEditor({ rule, onSave, onDelete, onCancel }: RuleEditorProps) {
  const [label,          setLabel]          = useState(rule.label || '');
  const [ruleType,       setRuleType]       = useState<'hard'|'soft'>(rule.rule_type);
  const [valueNumeric,   setValueNumeric]   = useState(rule.value_numeric?.toString() || '');
  const [valueNumericMax,setValueNumericMax]= useState(rule.value_numeric_max?.toString() || '');
  const [valueList,      setValueList]      = useState(rule.value_list || '');
  const [saving,         setSaving]         = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        label,
        rule_type:         ruleType,
        value_numeric:     valueNumeric    ? parseFloat(valueNumeric)    : undefined,
        value_numeric_max: valueNumericMax ? parseFloat(valueNumericMax) : undefined,
        value_list:        valueList || undefined,
      });
    } finally { setSaving(false); }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Label</label>
          <input value={label} onChange={e => setLabel(e.target.value)}
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Rule Type</label>
          <select value={ruleType} onChange={e => setRuleType(e.target.value as 'hard'|'soft')}
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="hard">Hard (disqualifier)</option>
            <option value="soft">Soft (score penalty)</option>
          </select>
        </div>
        {['gte','lte','gt','lt'].includes(rule.operator) && (
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Value</label>
            <input type="number" value={valueNumeric} onChange={e => setValueNumeric(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
        )}
        {rule.operator === 'between' && (
          <>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Min Value</label>
              <input type="number" value={valueNumeric} onChange={e => setValueNumeric(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Max Value</label>
              <input type="number" value={valueNumericMax} onChange={e => setValueNumericMax(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
          </>
        )}
        {['in','not_in'].includes(rule.operator) && (
          <div className="col-span-2">
            <label className="text-xs text-zinc-500 mb-1 block">Values (comma separated)</label>
            <input value={valueList} onChange={e => setValueList(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between pt-1">
        <button onClick={onDelete} className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1">
          <Trash2 className="w-3 h-3" /> Delete rule
        </button>
        <div className="flex gap-2">
          <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1">
            <X className="w-3 h-3" /> Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1">
            <Check className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 3 ── PolicyRuleRow
// ─────────────────────────────────────────────────────────────

function PolicyRuleRow({
  rule, onUpdated, onDeleted,
}: {
  rule:      PolicyRule;
  onUpdated: (u: PolicyRule) => void;
  onDeleted: (id: number)    => void;
}) {
  const [editing, setEditing] = useState(false);

  const getValueDisplay = () => {
    if (rule.operator === 'between')                                return `${rule.value_numeric} – ${rule.value_numeric_max}`;
    if (rule.value_boolean !== undefined && rule.value_boolean !== null) return rule.value_boolean ? 'Yes' : 'No';
    if (rule.value_list)    return rule.value_list;
    if (rule.value_text)    return rule.value_text;
    if (rule.value_numeric !== undefined) return String(rule.value_numeric);
    return '—';
  };

  const opLabel: Record<string,string> = {
    gte:'≥', lte:'≤', gt:'>', lt:'<',
    eq:'=', neq:'≠', in:'in', not_in:'not in', between:'between',
  };

  const handleSave = async (updated: Partial<PolicyRule>) => {
    const result = await lendersApi.updateRule(rule.id, updated);
    onUpdated(result);
    setEditing(false);
  };

  const handleDelete = async () => {
    if (!confirm(`Delete rule "${rule.label || rule.field}"?`)) return;
    await lendersApi.deleteRule(rule.id);
    onDeleted(rule.id);
  };

  if (editing) return (
    <RuleEditor rule={rule} onSave={handleSave} onDelete={handleDelete} onCancel={() => setEditing(false)} />
  );

  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-zinc-100 last:border-0 group">
      <div className="flex items-center gap-2">
        <Badge variant={rule.rule_type === 'hard' ? 'danger' : 'warning'} size="sm">{rule.rule_type}</Badge>
        <span className="text-zinc-700">{rule.label || rule.field}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs bg-zinc-100 px-2 py-0.5 rounded">
          {opLabel[rule.operator] || rule.operator} {getValueDisplay()}
        </span>
        <button onClick={() => setEditing(true)}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-all">
          <Edit2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 4 ── AddRuleForm
// ─────────────────────────────────────────────────────────────

function AddRuleForm({
  programId, onAdded, onCancel,
}: {
  programId: number;
  onAdded:   (r: PolicyRule) => void;
  onCancel:  () => void;
}) {
  const [field,          setField]          = useState('fico_score');
  const [operator,       setOperator]       = useState('gte');
  const [label,          setLabel]          = useState('');
  const [ruleType,       setRuleType]       = useState<'hard'|'soft'>('hard');
  const [valueNumeric,   setValueNumeric]   = useState('');
  const [valueNumericMax,setValueNumericMax]= useState('');
  const [valueList,      setValueList]      = useState('');
  const [valueBoolean,   setValueBoolean]   = useState('');
  const [scoreWeight,    setScoreWeight]    = useState('20');
  const [saving,         setSaving]         = useState(false);
  const [error,          setError]          = useState('');

  const handleAdd = async () => {
    if (!field || !operator) { setError('Field and operator are required'); return; }
    setSaving(true); setError('');
    try {
      const payload: any = {
        field, operator,
        label:        label || field.replace(/_/g, ' '),
        rule_type:    ruleType,
        score_weight: parseInt(scoreWeight) || 20,
      };
      if (valueNumeric)    payload.value_numeric     = parseFloat(valueNumeric);
      if (valueNumericMax) payload.value_numeric_max = parseFloat(valueNumericMax);
      if (valueList)       payload.value_list        = valueList;
      if (valueBoolean !== '') payload.value_boolean = valueBoolean === 'true';
      const result = await lendersApi.addRule(programId, payload);
      onAdded(result);
    } catch { setError('Failed to add rule. Check values and try again.'); }
    finally  { setSaving(false); }
  };

  const needsNumeric = ['gte','lte','gt','lt'].includes(operator);
  const needsBetween = operator === 'between';
  const needsList    = ['in','not_in'].includes(operator);
  const needsBool    = ['eq','neq'].includes(operator);

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2 mt-2">
      <p className="text-xs font-semibold text-emerald-800">Add New Rule</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Field</label>
          <select value={field} onChange={e => setField(e.target.value)}
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            {FIELD_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Operator</label>
          <select value={operator} onChange={e => setOperator(e.target.value)}
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            {OPERATOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Label (shown to broker)</label>
          <input value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. Min FICO Score"
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Rule Type</label>
          <select value={ruleType} onChange={e => setRuleType(e.target.value as 'hard'|'soft')}
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500">
            <option value="hard">Hard (disqualifier)</option>
            <option value="soft">Soft (score penalty)</option>
          </select>
        </div>
        {needsNumeric && (
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Value</label>
            <input type="number" value={valueNumeric} onChange={e => setValueNumeric(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
        )}
        {needsBetween && (
          <>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Min Value</label>
              <input type="number" value={valueNumeric} onChange={e => setValueNumeric(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Max Value</label>
              <input type="number" value={valueNumericMax} onChange={e => setValueNumericMax(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
            </div>
          </>
        )}
        {needsList && (
          <div className="col-span-2">
            <label className="text-xs text-zinc-500 mb-1 block">Values (comma separated, e.g. CA,NV,TX)</label>
            <input value={valueList} onChange={e => setValueList(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
          </div>
        )}
        {needsBool && (
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Value</label>
            <select value={valueBoolean} onChange={e => setValueBoolean(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500">
              <option value="">Select...</option>
              <option value="true">True</option>
              <option value="false">False</option>
            </select>
          </div>
        )}
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Score Weight (1–30)</label>
          <input type="number" value={scoreWeight} onChange={e => setScoreWeight(e.target.value)} min={1} max={30}
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500" />
        </div>
      </div>
      {error && <p className="text-xs text-red-500">{error}</p>}
      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1">
          <X className="w-3 h-3" /> Cancel
        </button>
        <button onClick={handleAdd} disabled={saving}
          className="text-xs bg-emerald-600 text-white px-3 py-1 rounded hover:bg-emerald-700 flex items-center gap-1">
          <Plus className="w-3 h-3" /> {saving ? 'Adding...' : 'Add Rule'}
        </button>
      </div>
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 5 ── ProgramAccordion
// ─────────────────────────────────────────────────────────────

function ProgramAccordion({ program }: { program: LenderProgram }) {
  const [open,        setOpen]        = useState(false);
  const [rules,       setRules]       = useState<PolicyRule[]>(program.rules);
  const [showAddRule, setShowAddRule] = useState(false);

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden">
      <button onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100 transition-colors text-left">
        <div className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-zinc-500" />
          <span className="font-medium text-sm text-zinc-900">{program.name}</span>
          {program.min_rate && (
            <span className="text-xs text-zinc-500">
              {program.min_rate}%{program.max_rate && program.max_rate !== program.min_rate ? `–${program.max_rate}%` : ''} rate
            </span>
          )}
          <Badge variant="neutral" size="sm">{rules.length} rules</Badge>
          {!program.is_active && <Badge variant="warning">Inactive</Badge>}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-zinc-400" /> : <ChevronDown className="w-4 h-4 text-zinc-400" />}
      </button>

      {open && (
        <div className="p-3 bg-white">
          {program.description && <p className="text-xs text-zinc-500 mb-3">{program.description}</p>}
          {rules.length === 0 && !showAddRule && <p className="text-sm text-zinc-400 mb-2">No rules defined</p>}
          <div className="space-y-0.5">
            {rules.map(r => (
              <PolicyRuleRow key={r.id} rule={r}
                onUpdated={u => setRules(prev => prev.map(x => x.id === u.id ? u : x))}
                onDeleted={id => setRules(prev => prev.filter(x => x.id !== id))}
              />
            ))}
          </div>
          {showAddRule
            ? <AddRuleForm programId={program.id}
                onAdded={r => { setRules(prev => [...prev, r]); setShowAddRule(false); }}
                onCancel={() => setShowAddRule(false)} />
            : <button onClick={() => setShowAddRule(true)}
                className="mt-3 text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-medium">
                <Plus className="w-3 h-3" /> Add rule
              </button>
          }
        </div>
      )}
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 6 ── LenderCard
// ─────────────────────────────────────────────────────────────

function LenderCard({
  lender,
  onDeleted,
}: {
  lender:    Lender;
  onDeleted: (id: number) => void;
}) {
  const [expanded,   setExpanded]   = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [deleting,   setDeleting]   = useState(false);

  const active     = lender.programs.filter(p => p.is_active).length;
  const totalRules = lender.programs.reduce((a, p) => a + p.rules.length, 0);

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(true);
  };

  const handleConfirm = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setDeleting(true);
    try {
      await lendersApi.delete(lender.id);
      onDeleted(lender.id);
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  };

  const handleCancel = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirming(false);
  };

  return (
    <Card padding="none" className="overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-zinc-50 transition-colors group"
        onClick={() => { if (!confirming) setExpanded(!expanded); }}
      >
        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-emerald-700" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-900">{lender.name}</h3>
            <Badge variant={lender.is_active ? 'success' : 'neutral'}>
              {lender.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          {lender.description && <p className="text-sm text-zinc-500 mt-0.5 line-clamp-1">{lender.description}</p>}
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
            <span>{active} active programs</span>
            <span>{totalRules} total rules</span>
            {lender.contact_name && <span>{lender.contact_name}</span>}
          </div>
        </div>

        {/* Delete controls — shown on hover */}
        <div className="flex items-center gap-2 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {confirming ? (
            <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
              <span className="text-xs font-semibold text-red-700 whitespace-nowrap">Delete lender?</span>
              <button
                onClick={handleConfirm}
                disabled={deleting}
                className="text-xs font-bold text-white bg-red-600 hover:bg-red-700 disabled:opacity-60 px-2.5 py-1 rounded-md transition-colors"
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                onClick={handleCancel}
                className="text-xs text-zinc-500 hover:text-zinc-800 px-1 transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={handleDeleteClick}
              title="Delete lender"
              className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-all"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {!confirming && (
          expanded
            ? <ChevronUp   className="w-5 h-5 text-zinc-400 flex-shrink-0" />
            : <ChevronDown className="w-5 h-5 text-zinc-400 flex-shrink-0" />
        )}
      </div>

      {expanded && (
        <div className="border-t border-zinc-200 p-4 space-y-3 bg-white">
          {lender.contact_email && (
            <p className="text-sm text-zinc-600">
              <span className="font-medium">Contact:</span> {lender.contact_name} · {lender.contact_email}
              {lender.contact_phone && ` · ${lender.contact_phone}`}
            </p>
          )}
          <div className="space-y-2">
            {lender.programs.map(p => <ProgramAccordion key={p.id} program={p} />)}
          </div>
        </div>
      )}
    </Card>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 7 ── AddLenderModal
//
// 3-step wizard:
//   Step 1 — Lender details (name, description, contact)
//   Step 2 — Add programs  (name, description, priority, rates)
//   Step 3 — Review & submit
// ─────────────────────────────────────────────────────────────

interface NewProgram {
  name:        string;
  description: string;
  priority:    number;
  min_rate:    string;
  max_rate:    string;
}

interface NewLenderForm {
  name:          string;
  description:   string;
  contact_name:  string;
  contact_email: string;
  contact_phone: string;
}

const EMPTY_LENDER: NewLenderForm = {
  name: '', description: '', contact_name: '', contact_email: '', contact_phone: '',
};

const emptyProgram = (priority: number): NewProgram => ({
  name: '', description: '', priority, min_rate: '', max_rate: '',
});

function AddLenderModal({
  onClose,
  onCreated,
}: {
  onClose:   () => void;
  onCreated: (lender: Lender) => void;
}) {
  const [step,      setStep]      = useState<1|2|3>(1);
  const [form,      setForm]      = useState<NewLenderForm>(EMPTY_LENDER);
  const [programs,  setPrograms]  = useState<NewProgram[]>([emptyProgram(1)]);
  const [submitting,setSubmitting]= useState(false);
  const [error,     setError]     = useState('');
  const overlayRef = useRef<HTMLDivElement>(null);

  // Close on overlay click
  const handleOverlay = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const updateProgram = (i: number, field: keyof NewProgram, val: string | number) => {
    setPrograms(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: val } : p));
  };

  const addProgram = () =>
    setPrograms(prev => [...prev, emptyProgram(prev.length + 1)]);

  const removeProgram = (i: number) =>
    setPrograms(prev => prev.filter((_, idx) => idx !== i));

  // ── Validation ──────────────────────────────────────────────
  const step1Valid = form.name.trim().length > 0;
  const step2Valid = programs.length > 0 && programs.every(p => p.name.trim().length > 0);

  // ── Submit ──────────────────────────────────────────────────
  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      // 1. Create the lender
      const lender = await lendersApi.create({
        name:          form.name.trim(),
        description:   form.description.trim() || undefined,
        contact_name:  form.contact_name.trim()  || undefined,
        contact_email: form.contact_email.trim() || undefined,
        contact_phone: form.contact_phone.trim() || undefined,
        is_active:     true,
      });

      // 2. Create each program (sequentially to preserve priority)
      for (const prog of programs) {
        await lendersApi.addProgram(lender.id, {
          name:        prog.name.trim(),
          description: prog.description.trim() || undefined,
          priority:    prog.priority,
          min_rate:    prog.min_rate ? parseFloat(prog.min_rate) : undefined,
          max_rate:    prog.max_rate ? parseFloat(prog.max_rate) : undefined,
          is_active:   true,
        });
      }

      // 3. Reload lender with programs
      const full = await lendersApi.get(lender.id);
      onCreated(full);
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? e?.message ?? 'Failed to create lender.');
      setSubmitting(false);
    }
  };

  // ── Step indicators ─────────────────────────────────────────
  const STEPS = [
    { n: 1, label: 'Lender Details' },
    { n: 2, label: 'Programs'       },
    { n: 3, label: 'Review'         },
  ];

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlay}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">

        {/* ── Modal header ──────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
              <Building2 className="w-4 h-4 text-emerald-700" />
            </div>
            <h2 className="text-base font-bold text-zinc-900">Add New Lender</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── Step dots ─────────────────────────────────────── */}
        <div className="flex items-center gap-0 px-6 pt-4 pb-2">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center flex-1">
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className={[
                  'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all',
                  step > s.n  ? 'bg-emerald-600 text-white'
                  : step === s.n ? 'bg-emerald-600 text-white ring-4 ring-emerald-100'
                  : 'bg-zinc-200 text-zinc-500',
                ].join(' ')}>
                  {step > s.n ? <Check className="w-3.5 h-3.5" /> : s.n}
                </div>
                <span className={`text-[10px] font-semibold whitespace-nowrap ${step === s.n ? 'text-emerald-700' : 'text-zinc-400'}`}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div className="flex-1 h-px mx-2 mb-4 rounded-full transition-all"
                  style={{ background: step > s.n ? '#059669' : '#e4e4e7' }} />
              )}
            </div>
          ))}
        </div>

        {/* ── Step content ──────────────────────────────────── */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">

          {/* Step 1 — Lender Details */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">
                  Lender Name <span className="text-red-500">*</span>
                </label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="e.g. First National Equipment Finance"
                  className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1.5">Description</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  rows={2}
                  placeholder="Brief summary of this lender's focus / specialty"
                  className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent resize-none"
                />
              </div>

              <div className="pt-1">
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-3">Contact (Optional)</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Contact Name</label>
                    <input value={form.contact_name}
                      onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                      placeholder="Jane Smith"
                      className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Phone</label>
                    <input value={form.contact_phone}
                      onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                      placeholder="(555) 000-0000"
                      className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs text-zinc-500 mb-1">Email</label>
                    <input type="email" value={form.contact_email}
                      onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                      placeholder="submissions@lender.com"
                      className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  </div>
                </div>
              </div>

              {/* Hint about adding rules after */}
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                <Info className="w-4 h-4 text-blue-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-blue-700 leading-relaxed">
                  After creating the lender you can add policy rules to each program directly
                  from the Lenders page — no need to enter all rules now.
                </p>
              </div>
            </div>
          )}

          {/* Step 2 — Programs */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600">
                Add the lending programs / tiers for <strong>{form.name}</strong>.
                Programs are evaluated in priority order — lower number = higher priority.
              </p>

              {programs.map((prog, i) => (
                <div key={i} className="border border-zinc-200 rounded-xl p-4 space-y-3 relative">
                  {programs.length > 1 && (
                    <button onClick={() => removeProgram(i)}
                      className="absolute top-3 right-3 p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <div className="flex items-center gap-2 mb-1">
                    <Shield className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-zinc-500 uppercase tracking-wider">Program {i + 1}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-xs text-zinc-500 mb-1">
                        Program Name <span className="text-red-500">*</span>
                      </label>
                      <input
                        value={prog.name}
                        onChange={e => updateProgram(i, 'name', e.target.value)}
                        placeholder="e.g. Tier 1 — Prime Credit"
                        className={`w-full text-sm border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500 ${
                          prog.name.trim() === '' ? 'border-red-300' : 'border-zinc-300'
                        }`}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-zinc-500 mb-1">Description</label>
                      <input value={prog.description}
                        onChange={e => updateProgram(i, 'description', e.target.value)}
                        placeholder="Brief description of this tier's target borrower"
                        className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Priority (1 = highest)</label>
                      <input type="number" min={1} max={99}
                        value={prog.priority}
                        onChange={e => updateProgram(i, 'priority', parseInt(e.target.value) || i + 1)}
                        className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Min Rate %</label>
                        <input type="number" step="0.01" min="0"
                          value={prog.min_rate}
                          onChange={e => updateProgram(i, 'min_rate', e.target.value)}
                          placeholder="e.g. 6.5"
                          className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-500 mb-1">Max Rate %</label>
                        <input type="number" step="0.01" min="0"
                          value={prog.max_rate}
                          onChange={e => updateProgram(i, 'max_rate', e.target.value)}
                          placeholder="e.g. 9.9"
                          className="w-full text-sm border border-zinc-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              <button onClick={addProgram}
                className="w-full py-2.5 border-2 border-dashed border-zinc-300 rounded-xl text-sm text-zinc-500 hover:border-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 transition-all flex items-center justify-center gap-2">
                <Plus className="w-4 h-4" /> Add Another Program
              </button>
            </div>
          )}

          {/* Step 3 — Review */}
          {step === 3 && (
            <div className="space-y-4">
              {/* Lender summary */}
              <div className="p-4 bg-zinc-50 rounded-xl border border-zinc-200">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-emerald-700" />
                  </div>
                  <div>
                    <p className="font-bold text-zinc-900">{form.name}</p>
                    {form.description && <p className="text-xs text-zinc-500">{form.description}</p>}
                  </div>
                </div>
                {(form.contact_name || form.contact_email) && (
                  <p className="text-xs text-zinc-500">
                    Contact: {[form.contact_name, form.contact_email, form.contact_phone].filter(Boolean).join(' · ')}
                  </p>
                )}
              </div>

              {/* Programs summary */}
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-zinc-400 mb-2">
                  {programs.length} Program{programs.length > 1 ? 's' : ''} to Create
                </p>
                <div className="space-y-2">
                  {programs.map((p, i) => (
                    <div key={i} className="flex items-center gap-3 p-3 bg-white border border-zinc-200 rounded-lg">
                      <div className="w-6 h-6 bg-emerald-600 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {p.priority}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-zinc-900">{p.name}</p>
                        {p.description && <p className="text-xs text-zinc-500">{p.description}</p>}
                      </div>
                      {(p.min_rate || p.max_rate) && (
                        <span className="text-xs text-zinc-500 font-mono">
                          {p.min_rate}{p.max_rate && p.max_rate !== p.min_rate ? `–${p.max_rate}` : ''}%
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Rules note */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-relaxed">
                  <strong>Next step:</strong> After creating this lender, expand each program on the Lenders page
                  and add policy rules (FICO minimums, state restrictions, etc.) using the "Add rule" button.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {error}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer nav ────────────────────────────────────── */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-100 bg-zinc-50/80">
          {step > 1 ? (
            <button onClick={() => setStep(s => (s - 1) as 1|2|3)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-zinc-600 bg-white border border-zinc-200 hover:border-zinc-300 hover:shadow-sm transition-all">
              <ArrowLeft className="w-4 h-4" /> Back
            </button>
          ) : <div />}

          {step < 3 ? (
            <button
              onClick={() => setStep(s => (s + 1) as 1|2|3)}
              disabled={step === 1 ? !step1Valid : !step2Valid}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed transition-all shadow-sm"
            >
              {submitting
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Creating…</>
                : <><CheckCircle className="w-4 h-4" /> Create Lender</>
              }
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// endregion


// ─────────────────────────────────────────────────────────────
// region 8 ── LendersPage
// ─────────────────────────────────────────────────────────────

export default function LendersPage() {
  const [lenders,      setLenders]      = useState<Lender[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [justAdded,    setJustAdded]    = useState<number | null>(null);

  useEffect(() => {
    lendersApi.list().then(setLenders).finally(() => setLoading(false));
  }, []);

  const handleLenderCreated = (lender: Lender) => {
    setLenders(prev => [lender, ...prev]);
    setShowAddModal(false);
    setJustAdded(lender.id);
    setTimeout(() => setJustAdded(null), 3000);
  };

  const handleLenderDeleted = (id: number) => {
    setLenders(prev => prev.filter(l => l.id !== id));
  };

  const totalPrograms = lenders.reduce((a, l) => a + l.programs.length, 0);
  const totalRules    = lenders.reduce((a, l) => a + l.programs.reduce((b, p) => b + p.rules.length, 0), 0);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Lender Policies</h1>
          <p className="text-zinc-600 mt-1">
            {lenders.length} lenders · {totalPrograms} programs · {totalRules} policy rules
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" /> Add Lender
        </button>
      </div>

      {/* Just-added success banner */}
      {justAdded !== null && (
        <div className="flex items-center gap-3 p-3 mb-4 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-800 text-sm animate-pulse">
          <CheckCircle className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span>
            Lender created successfully! Expand it below to add policy rules to each program.
          </span>
        </div>
      )}

      {loading && <div className="text-center py-16 text-zinc-500">Loading lenders…</div>}

      {!loading && (
        <div className="space-y-4">
          {lenders.map(lender => (
            <div key={lender.id}
              className={`rounded-2xl transition-shadow duration-300 ${justAdded === lender.id ? 'ring-2 ring-emerald-400 shadow-lg' : ''}`}>
              <LenderCard
                lender={lender}
                onDeleted={handleLenderDeleted}
              />
            </div>
          ))}
        </div>
      )}

      {/* Add Lender modal */}
      {showAddModal && (
        <AddLenderModal
          onClose={() => setShowAddModal(false)}
          onCreated={handleLenderCreated}
        />
      )}
    </div>
  );
}

// endregion