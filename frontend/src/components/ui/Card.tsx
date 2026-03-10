// ============================================================
// Card — white rounded container with border + shadow
//
// TABLE OF CONTENTS
//   1.  Card component      — outer container
//   2.  CardHeader          — top area with bottom margin
//   3.  CardTitle           — h3-level heading inside a card
//
// PADDING OPTIONS
//   none  → 0        (when child controls its own padding, e.g. accordion rows)
//   sm    → p-3      (compact — metric tiles, small info panels)
//   md    → p-5      (default — form sections, standard content cards)
//   lg    → p-8      (spacious — centered empty states, modal-like cards)
// ============================================================

import { clsx } from 'clsx';


// region ── 1. Card ───────────────────────────────────────────

interface CardProps {
  children:   React.ReactNode;
  className?: string;
  padding?:   'sm' | 'md' | 'lg' | 'none';
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div
      className={clsx(
        'bg-white rounded-xl border border-zinc-200 shadow-sm',
        {
          'p-3': padding === 'sm',
          'p-5': padding === 'md',
          'p-8': padding === 'lg',
          '':    padding === 'none',
        },
        className,
      )}
    >
      {children}
    </div>
  );
}

// endregion


// region ── 2. CardHeader ─────────────────────────────────────

export function CardHeader({
  children,
  className,
}: {
  children:   React.ReactNode;
  className?: string;
}) {
  return <div className={clsx('mb-4', className)}>{children}</div>;
}

// endregion


// region ── 3. CardTitle ──────────────────────────────────────

export function CardTitle({
  children,
  className,
}: {
  children:   React.ReactNode;
  className?: string;
}) {
  return (
    <h3 className={clsx('text-base font-semibold text-zinc-900', className)}>
      {children}
    </h3>
  );
}

// endregion