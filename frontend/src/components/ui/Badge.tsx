import { clsx } from 'clsx';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'danger' | 'warning' | 'neutral' | 'info';
  size?: 'sm' | 'md';
}

export function Badge({ children, variant = 'neutral', size = 'sm' }: BadgeProps) {
  return (
    <span className={clsx(
      'inline-flex items-center font-medium rounded-full',
      size === 'sm' ? 'px-2.5 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      {
        'bg-emerald-100 text-emerald-800': variant === 'success',
        'bg-red-100 text-red-800': variant === 'danger',
        'bg-amber-100 text-amber-800': variant === 'warning',
        'bg-zinc-100 text-zinc-700': variant === 'neutral',
        'bg-blue-100 text-blue-800': variant === 'info',
      }
    )}>
      {children}
    </span>
  );
}
