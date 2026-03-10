// ============================================================
// Input — labelled text / number input with error + hint states
//
// TABLE OF CONTENTS
//   1.  Props interface
//   2.  Input component    (forwardRef — compatible with react-hook-form register)
//
// USAGE
//   <Input
//     label="FICO Score"
//     type="number"
//     hint="Personal credit score (300–850)"
//     error={errors.guarantor?.fico_score?.message}
//     {...register('guarantor.fico_score', { valueAsNumber: true })}
//   />
//
// Error takes visual precedence over hint — only one is shown at a time.
// ============================================================

import { clsx } from 'clsx';
import { forwardRef } from 'react';


// region ── 1. Props ──────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?:  string;
}

// endregion


// region ── 2. Input component ────────────────────────────────

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, className, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-zinc-700">{label}</label>
      )}
      <input
        ref={ref}
        className={clsx(
          'w-full px-3 py-2 text-sm rounded-lg border bg-white transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent',
          error
            ? 'border-red-400'
            : 'border-zinc-300 hover:border-zinc-400',
          className,
        )}
        {...props}
      />
      {/* Error takes priority over hint */}
      {error         && <p className="text-xs text-red-600">{error}</p>}
      {hint && !error && <p className="text-xs text-zinc-500">{hint}</p>}
    </div>
  ),
);
Input.displayName = 'Input';

// endregion