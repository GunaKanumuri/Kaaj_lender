import { clsx } from 'clsx';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'sm' | 'md' | 'lg' | 'none';
}

export function Card({ children, className, padding = 'md' }: CardProps) {
  return (
    <div className={clsx(
      'bg-white rounded-xl border border-zinc-200 shadow-sm',
      {
        'p-3': padding === 'sm',
        'p-5': padding === 'md',
        'p-8': padding === 'lg',
        '': padding === 'none',
      },
      className
    )}>
      {children}
    </div>
  );
}

export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx('mb-4', className)}>{children}</div>;
}

export function CardTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h3 className={clsx('text-base font-semibold text-zinc-900', className)}>{children}</h3>;
}
