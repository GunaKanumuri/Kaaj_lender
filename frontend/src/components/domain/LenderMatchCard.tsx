// ============================================================
// LENDER MATCH CARD — Summary card for one lender result
// Shows eligible/ineligible + score + expandable rule details
// ============================================================

import { useState } from 'react';
import { ChevronDown, ChevronUp, Building2, TrendingUp } from 'lucide-react';
import { clsx } from 'clsx';
import { Badge } from '../ui/Badge';
import { RuleResultRow } from './RuleResultRow';
import type { MatchResult } from '../../types';

interface Props {
  result: MatchResult;
  rank?: number;
}

export function LenderMatchCard({ result, rank }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isEligible = result.status === 'eligible';

  const passed = result.rule_results.filter(r => r.passed).length;
  const total = result.rule_results.length;

  return (
    <div className={clsx(
      'rounded-xl border overflow-hidden transition-shadow hover:shadow-md',
      isEligible ? 'border-emerald-200' : 'border-zinc-200'
    )}>
      {/* Header */}
      <div className={clsx(
        'flex items-center gap-4 p-4',
        isEligible ? 'bg-emerald-50' : 'bg-zinc-50'
      )}>
        {rank && (
          <div className={clsx(
            'w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0',
            isEligible ? 'bg-emerald-600 text-white' : 'bg-zinc-300 text-zinc-600'
          )}>
            {rank}
          </div>
        )}

        <div className="flex items-center gap-2 flex-shrink-0">
          <Building2 className={clsx('w-5 h-5', isEligible ? 'text-emerald-600' : 'text-zinc-400')} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-zinc-900">{result.lender_name}</h3>
            <Badge variant={isEligible ? 'success' : 'danger'}>
              {isEligible ? '✓ Eligible' : '✗ Ineligible'}
            </Badge>
            {result.program_name && (
              <Badge variant="info">{result.program_name}</Badge>
            )}
          </div>
          <p className="text-sm text-zinc-600 mt-0.5">{result.summary}</p>
        </div>

        <div className="flex items-center gap-4 flex-shrink-0">
          {isEligible && (
            <div className="text-right">
              <div className="flex items-center gap-1">
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-2xl font-bold text-emerald-700">{result.fit_score}</span>
              </div>
              <p className="text-xs text-zinc-500">fit score</p>
            </div>
          )}

          <div className="text-right text-sm">
            <span className={clsx(
              'font-medium',
              isEligible ? 'text-emerald-700' : 'text-zinc-500'
            )}>
              {passed}/{total}
            </span>
            <p className="text-xs text-zinc-500">rules passed</p>
          </div>

          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 rounded hover:bg-zinc-200 transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-zinc-500" />
            ) : (
              <ChevronDown className="w-5 h-5 text-zinc-500" />
            )}
          </button>
        </div>
      </div>

      {/* Expanded rule breakdown */}
      {expanded && (
        <div className="p-4 border-t border-zinc-200 space-y-1.5 bg-white">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Policy Rules Evaluated
          </p>
          {result.rule_results.length === 0 ? (
            <p className="text-sm text-zinc-500">No rule details available.</p>
          ) : (
            result.rule_results.map(rr => (
              <RuleResultRow key={rr.id} result={rr} />
            ))
          )}
        </div>
      )}
    </div>
  );
}
