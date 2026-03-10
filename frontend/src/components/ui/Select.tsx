// ============================================================
// Select — labelled <select> with error state
//
// TABLE OF CONTENTS
//   1.  Props interface
//   2.  Select component   (forwardRef — compatible with react-hook-form register)
//
// USAGE
//   <Select
//     label="Industry"
//     options={INDUSTRIES}
//     placeholder="Select industry"
//     error={errors.business?.industry?.message}
//     {...register('business.industry')}
//   />
//
// The placeholder option renders as value="" so react-hook-form treats
// an unselected state as an empty string (easy required validation).
// ============================================================

import { clsx } from 'clsx';
import { forwardRef } from 'react';


// region ── 1. Props ──────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?:       string;
  error?:       string;
  options:      { value: string; label: string }[];
  placeholder?: string;
}

// endregion


// region ── 2. Select component ───────────────────────────────

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ label, error, options, placeholder, className, ...props }, ref) => (
    <div className="space-y-1">
      {label && (
        <label className="block text-sm font-medium text-zinc-700">{label}</label>
      )}
      <select
        ref={ref}
        className={clsx(
          'w-full px-3 py-2 text-sm rounded-lg border bg-white transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-emerald-500',
          error ? 'border-red-400' : 'border-zinc-300',
          className,
        )}
        {...props}
      >
        {/* Blank option as "unselected" sentinel for required validation */}
        {placeholder && <option value="">{placeholder}</option>}
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  ),
);
Select.displayName = 'Select';

// endregion