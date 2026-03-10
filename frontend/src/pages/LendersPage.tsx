// ============================================================
// LENDERS PAGE — View all lenders, programs, and policy rules
// Edit rules and add new rules inline.
// ============================================================

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp, Building2, Shield, Edit2, Check, X, Plus, Trash2 } from 'lucide-react';
import { lendersApi } from '../api/lenders';
import { Badge } from '../components/ui/Badge';
import { Card, CardHeader, CardTitle } from '../components/ui/Card';
import type { Lender, LenderProgram, PolicyRule } from '../types';

// ── Inline Rule Editor ────────────────────────────────────────
interface RuleEditorProps {
  rule: PolicyRule;
  onSave: (updated: Partial<PolicyRule>) => Promise<void>;
  onDelete: () => Promise<void>;
  onCancel: () => void;
}

function RuleEditor({ rule, onSave, onDelete, onCancel }: RuleEditorProps) {
  const [label, setLabel] = useState(rule.label || '');
  const [ruleType, setRuleType] = useState<'hard' | 'soft'>(rule.rule_type);
  const [valueNumeric, setValueNumeric] = useState(rule.value_numeric?.toString() || '');
  const [valueNumericMax, setValueNumericMax] = useState(rule.value_numeric_max?.toString() || '');
  const [valueList, setValueList] = useState(rule.value_list || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave({
        label,
        rule_type: ruleType,
        value_numeric: valueNumeric ? parseFloat(valueNumeric) : undefined,
        value_numeric_max: valueNumericMax ? parseFloat(valueNumericMax) : undefined,
        value_list: valueList || undefined,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Label</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Rule Type</label>
          <select
            value={ruleType}
            onChange={e => setRuleType(e.target.value as 'hard' | 'soft')}
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="hard">Hard (disqualifier)</option>
            <option value="soft">Soft (score penalty)</option>
          </select>
        </div>
        {(rule.operator === 'gte' || rule.operator === 'lte' || rule.operator === 'gt' || rule.operator === 'lt') && (
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Value</label>
            <input
              type="number"
              value={valueNumeric}
              onChange={e => setValueNumeric(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        )}
        {rule.operator === 'between' && (
          <>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Min Value</label>
              <input
                type="number"
                value={valueNumeric}
                onChange={e => setValueNumeric(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="text-xs text-zinc-500 mb-1 block">Max Value</label>
              <input
                type="number"
                value={valueNumericMax}
                onChange={e => setValueNumericMax(e.target.value)}
                className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </>
        )}
        {(rule.operator === 'in' || rule.operator === 'not_in') && (
          <div className="col-span-2">
            <label className="text-xs text-zinc-500 mb-1 block">Values (comma separated)</label>
            <input
              value={valueList}
              onChange={e => setValueList(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        )}
      </div>
      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onDelete}
          className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1"
        >
          <Trash2 className="w-3 h-3" /> Delete rule
        </button>
        <div className="flex gap-2">
          <button onClick={onCancel} className="text-xs text-zinc-500 hover:text-zinc-700 flex items-center gap-1">
            <X className="w-3 h-3" /> Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="text-xs text-emerald-700 hover:text-emerald-900 font-medium flex items-center gap-1"
          >
            <Check className="w-3 h-3" /> {saving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Rule Row (view + edit toggle) ─────────────────────────────
function PolicyRuleRow({
  rule,
  onUpdated,
  onDeleted,
}: {
  rule: PolicyRule;
  onUpdated: (updated: PolicyRule) => void;
  onDeleted: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);

  const getValueDisplay = () => {
    if (rule.operator === 'between') return `${rule.value_numeric} – ${rule.value_numeric_max}`;
    if (rule.value_boolean !== undefined && rule.value_boolean !== null) return rule.value_boolean ? 'Yes' : 'No';
    if (rule.value_list) return rule.value_list;
    if (rule.value_text) return rule.value_text;
    if (rule.value_numeric !== undefined) return String(rule.value_numeric);
    return '—';
  };

  const operatorLabel: Record<string, string> = {
    gte: '≥', lte: '≤', gt: '>', lt: '<',
    eq: '=', neq: '≠', in: 'in', not_in: 'not in', between: 'between',
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

  if (editing) {
    return (
      <RuleEditor
        rule={rule}
        onSave={handleSave}
        onDelete={handleDelete}
        onCancel={() => setEditing(false)}
      />
    );
  }

  return (
    <div className="flex items-center justify-between py-1.5 text-sm border-b border-zinc-100 last:border-0 group">
      <div className="flex items-center gap-2">
        <Badge variant={rule.rule_type === 'hard' ? 'danger' : 'warning'} size="sm">
          {rule.rule_type}
        </Badge>
        <span className="text-zinc-700">{rule.label || rule.field}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xs bg-zinc-100 px-2 py-0.5 rounded">
          {operatorLabel[rule.operator] || rule.operator} {getValueDisplay()}
        </span>
        <button
          onClick={() => setEditing(true)}
          className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-zinc-100 text-zinc-400 hover:text-zinc-700 transition-all"
          title="Edit rule"
        >
          <Edit2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ── Add Rule Form ─────────────────────────────────────────────
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
  { value: 'gte', label: '>= (at least)' },
  { value: 'lte', label: '<= (at most)' },
  { value: 'eq',  label: '= (equals)' },
  { value: 'neq', label: '≠ (not equals)' },
  { value: 'in',  label: 'in (allowed list)' },
  { value: 'not_in', label: 'not in (excluded list)' },
  { value: 'between', label: 'between (range)' },
];

function AddRuleForm({
  programId,
  onAdded,
  onCancel,
}: {
  programId: number;
  onAdded: (rule: PolicyRule) => void;
  onCancel: () => void;
}) {
  const [field, setField] = useState('fico_score');
  const [operator, setOperator] = useState('gte');
  const [label, setLabel] = useState('');
  const [ruleType, setRuleType] = useState<'hard' | 'soft'>('hard');
  const [valueNumeric, setValueNumeric] = useState('');
  const [valueNumericMax, setValueNumericMax] = useState('');
  const [valueList, setValueList] = useState('');
  const [valueBoolean, setValueBoolean] = useState('');
  const [scoreWeight, setScoreWeight] = useState('20');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleAdd = async () => {
    if (!field || !operator) { setError('Field and operator are required'); return; }
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        field,
        operator,
        label: label || field.replace(/_/g, ' '),
        rule_type: ruleType,
        score_weight: parseInt(scoreWeight) || 20,
      };
      if (valueNumeric) payload.value_numeric = parseFloat(valueNumeric);
      if (valueNumericMax) payload.value_numeric_max = parseFloat(valueNumericMax);
      if (valueList) payload.value_list = valueList;
      if (valueBoolean !== '') payload.value_boolean = valueBoolean === 'true';

      const result = await lendersApi.addRule(programId, payload);
      onAdded(result);
    } catch (e: any) {
      setError('Failed to add rule. Check values and try again.');
    } finally {
      setSaving(false);
    }
  };

  const needsNumeric = ['gte', 'lte', 'gt', 'lt'].includes(operator);
  const needsBetween = operator === 'between';
  const needsList = ['in', 'not_in'].includes(operator);
  const needsBoolean = ['eq', 'neq'].includes(operator);

  return (
    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-2 mt-2">
      <p className="text-xs font-semibold text-emerald-800">Add New Rule</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Field</label>
          <select
            value={field}
            onChange={e => setField(e.target.value)}
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {FIELD_OPTIONS.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Operator</label>
          <select
            value={operator}
            onChange={e => setOperator(e.target.value)}
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            {OPERATOR_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Label (shown to broker)</label>
          <input
            value={label}
            onChange={e => setLabel(e.target.value)}
            placeholder="e.g. Min FICO Score"
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>
        <div>
          <label className="text-xs text-zinc-500 mb-1 block">Rule Type</label>
          <select
            value={ruleType}
            onChange={e => setRuleType(e.target.value as 'hard' | 'soft')}
            className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          >
            <option value="hard">Hard (disqualifier)</option>
            <option value="soft">Soft (score penalty)</option>
          </select>
        </div>
        {needsNumeric && (
          <div>
            <label className="text-xs text-zinc-500 mb-1 block">Value</label>
            <input
              type="number"
              value={valueNumeric}
              onChange={e => setValueNumeric(e.target.value)}
              className="w-full text-sm border border-zinc-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
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
        {needsBoolean && (
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

// ── Program Accordion ─────────────────────────────────────────
function ProgramAccordion({ program }: { program: LenderProgram }) {
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<PolicyRule[]>(program.rules);
  const [showAddRule, setShowAddRule] = useState(false);

  const handleRuleUpdated = (updated: PolicyRule) => {
    setRules(prev => prev.map(r => r.id === updated.id ? updated : r));
  };

  const handleRuleDeleted = (id: number) => {
    setRules(prev => prev.filter(r => r.id !== id));
  };

  const handleRuleAdded = (rule: PolicyRule) => {
    setRules(prev => [...prev, rule]);
    setShowAddRule(false);
  };

  return (
    <div className="border border-zinc-200 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 bg-zinc-50 hover:bg-zinc-100 transition-colors text-left"
      >
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
          {program.description && (
            <p className="text-xs text-zinc-500 mb-3">{program.description}</p>
          )}

          {rules.length === 0 && !showAddRule && (
            <p className="text-sm text-zinc-400 mb-2">No rules defined</p>
          )}

          <div className="space-y-0.5">
            {rules.map(r => (
              <PolicyRuleRow
                key={r.id}
                rule={r}
                onUpdated={handleRuleUpdated}
                onDeleted={handleRuleDeleted}
              />
            ))}
          </div>

          {showAddRule ? (
            <AddRuleForm
              programId={program.id}
              onAdded={handleRuleAdded}
              onCancel={() => setShowAddRule(false)}
            />
          ) : (
            <button
              onClick={() => setShowAddRule(true)}
              className="mt-3 text-xs text-emerald-600 hover:text-emerald-800 flex items-center gap-1 font-medium"
            >
              <Plus className="w-3 h-3" /> Add rule
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Lender Card ───────────────────────────────────────────────
function LenderCard({ lender }: { lender: Lender }) {
  const [expanded, setExpanded] = useState(false);
  const activePrograms = lender.programs.filter(p => p.is_active).length;

  return (
    <Card padding="none" className="overflow-hidden">
      <div
        className="flex items-center gap-4 p-4 cursor-pointer hover:bg-zinc-50 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center flex-shrink-0">
          <Building2 className="w-5 h-5 text-emerald-700" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-zinc-900">{lender.name}</h3>
            <Badge variant={lender.is_active ? 'success' : 'neutral'}>
              {lender.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>
          {lender.description && (
            <p className="text-sm text-zinc-500 mt-0.5 line-clamp-1">{lender.description}</p>
          )}
          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-500">
            <span>{activePrograms} active programs</span>
            <span>{lender.programs.reduce((acc, p) => acc + p.rules.length, 0)} total rules</span>
            {lender.contact_name && <span>{lender.contact_name}</span>}
          </div>
        </div>
        {expanded ? <ChevronUp className="w-5 h-5 text-zinc-400" /> : <ChevronDown className="w-5 h-5 text-zinc-400" />}
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
            {lender.programs.map(p => (
              <ProgramAccordion key={p.id} program={p} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────
export default function LendersPage() {
  const [lenders, setLenders] = useState<Lender[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    lendersApi.list().then(setLenders).finally(() => setLoading(false));
  }, []);

  const totalPrograms = lenders.reduce((acc, l) => acc + l.programs.length, 0);
  const totalRules = lenders.reduce((acc, l) => acc + l.programs.reduce((a, p) => a + p.rules.length, 0), 0);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Lender Policies</h1>
          <p className="text-zinc-600 mt-1">
            {lenders.length} lenders · {totalPrograms} programs · {totalRules} policy rules
          </p>
        </div>
      </div>

      {loading && <div className="text-center py-16 text-zinc-500">Loading lenders...</div>}

      {!loading && (
        <div className="space-y-4">
          {lenders.map(lender => (
            <LenderCard key={lender.id} lender={lender} />
          ))}
        </div>
      )}
    </div>
  );
}