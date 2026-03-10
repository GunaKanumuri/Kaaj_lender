// ============================================================
// Badge — inline pill label for status / category indicators
//
// TABLE OF CONTENTS
//   1.  Props interface
//   2.  Badge component
//
// VARIANTS
//   success  → emerald   (Eligible, Active, Completed)
//   danger   → red       (Ineligible, Hard fail, hard rule)
//   warning  → amber     (Soft fail, soft rule, Inactive)
//   info     → blue      (Program name, Processing)
//   neutral  → zinc      (Draft, unknown status)
//
// SIZES
//   sm  → text-xs, px-2.5 py-0.5   (default — inline in tables/cards)
//   md  → text-sm, px-3 py-1       (standalone, larger context)
// ============================================================

import { clsx } from 'clsx';


// region ── 1. Props ──────────────────────────────────────────

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'neutral' | 'info';
  size?:    'sm' | 'md';
}

// endregion


// region ── 2. Badge component ────────────────────────────────

export function Badge({ children, variant = 'neutral', size = 'sm' }: BadgeProps) {
  return (
    <span
      className={clsx(
        'inline-flex items-center font-medium rounded-full',
        // Size
        size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        // Colour
        {
          'bg-emerald-100 text-emerald-800': variant === 'success',
          'bg-red-100     text-red-800':     variant === 'danger',
          'bg-amber-100   text-amber-800':   variant === 'warning',
          'bg-zinc-100    text-zinc-700':    variant === 'neutral',
          'bg-blue-100    text-blue-800':    variant === 'info',
        },
      )}
    >
      {children}
    </span>
  );
}

// endregion