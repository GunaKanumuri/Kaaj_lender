// ============================================================
// RULE RESULT ROW — Shows pass/fail for one policy rule
// Used in the match results detail view
// ============================================================

import { CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';
import type { RuleEvaluationResult } from '../../types';

interface Props {
  result: RuleEvaluationResult;
}

export function RuleResultRow({ result }: Props) {
  const label = result.rule?.label || result.rule?.field || 'Rule';
  const isHard = result.rule?.rule_type === 'hard';

  return (
    <div className={clsx(
      'flex items-start gap-3 py-2.5 px-3 rounded-lg text-sm',
      result.passed ? 'bg-emerald-50' : isHard ? 'bg-red-50' : 'bg-amber-50'
    )}>
      <div className="mt-0.5 flex-shrink-0">
        {result.passed ? (
          <CheckCircle className="w-4 h-4 text-emerald-600" />
        ) : isHard ? (
          <XCircle className="w-4 h-4 text-red-600" />
        ) : (
          <AlertCircle className="w-4 h-4 text-amber-600" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className={clsx(
          'font-medium',
          result.passed ? 'text-emerald-900' : isHard ? 'text-red-900' : 'text-amber-900'
        )}>
          {label}
        </p>
        <p className={clsx(
          'text-xs mt-0.5',
          result.passed ? 'text-emerald-700' : isHard ? 'text-red-700' : 'text-amber-700'
        )}>
          {result.explanation}
        </p>
        {!result.passed && (
          <div className="flex gap-4 mt-1 text-xs">
            <span className="text-zinc-600">
              Got: <span className="font-mono font-medium">{result.actual_value ?? 'N/A'}</span>
            </span>
            <span className="text-zinc-600">
              Required: <span className="font-mono font-medium">{result.required_value ?? 'N/A'}</span>
            </span>
          </div>
        )}
      </div>
      <div className="flex-shrink-0">
        {!result.passed && !isHard && (
          <span className="text-xs bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded font-medium">soft</span>
        )}
        {!result.passed && isHard && (
          <span className="text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded font-medium">hard fail</span>
        )}
      </div>
    </div>
  );
}
