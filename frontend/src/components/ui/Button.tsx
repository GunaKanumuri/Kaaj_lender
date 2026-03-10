import { clsx } from 'clsx';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

export function Button({
  children, variant = 'primary', size = 'md',
  loading, disabled, className, ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-offset-2',
        {
          'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500': variant === 'primary',
          'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 focus:ring-zinc-400': variant === 'secondary',
          'bg-red-600 hover:bg-red-700 text-white focus:ring-red-500': variant === 'danger',
          'hover:bg-zinc-100 text-zinc-700 focus:ring-zinc-400': variant === 'ghost',
        },
        {
          'px-3 py-1.5 text-sm': size === 'sm',
          'px-4 py-2 text-sm': size === 'md',
          'px-6 py-3 text-base': size === 'lg',
        },
        'disabled:opacity-50 disabled:cursor-not-allowed',
        className
      )}
      {...props}
    >
      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}
