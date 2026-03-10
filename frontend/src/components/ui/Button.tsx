// ============================================================
// Button — primary interactive element
//
// TABLE OF CONTENTS
//   1.  Props interface
//   2.  Button component
//
// VARIANTS
//   primary   → emerald fill   (main CTA)
//   secondary → zinc fill      (secondary actions)
//   danger    → red fill       (destructive — delete, hard disqualify)
//   ghost     → no fill        (tertiary / icon-adjacent actions)
//
// SIZES
//   sm  → px-3 py-1.5 text-sm  (inline in card rows)
//   md  → px-4 py-2 text-sm    (default — form actions, nav CTAs)
//   lg  → px-6 py-3 text-base  (page-level primary CTA)
//
// LOADING STATE
//   Pass loading={true} to show a spinner and disable the button.
//   The button is also auto-disabled while loading.
// ============================================================

import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';


// region ── 1. Props ──────────────────────────────────────────

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?:    'sm' | 'md' | 'lg';
  loading?: boolean;
}

// endregion


// region ── 2. Button component ───────────────────────────────

export function Button({
  children,
  variant = 'primary',
  size    = 'md',
  loading,
  disabled,
  className,
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        // Base
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg',
        'transition-all focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        // Variant
        {
          'bg-emerald-600 hover:bg-emerald-700 text-white  focus:ring-emerald-500': variant === 'primary',
          'bg-zinc-100    hover:bg-zinc-200    text-zinc-900 focus:ring-zinc-400': variant === 'secondary',
          'bg-red-600     hover:bg-red-700     text-white  focus:ring-red-500':    variant === 'danger',
          'hover:bg-zinc-100                   text-zinc-700 focus:ring-zinc-400': variant === 'ghost',
        },
        // Size
        {
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2   text-sm': size === 'md',
          'px-6 py-3  text-base': size === 'lg',
        },
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

// endregion