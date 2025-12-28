import { type ReactNode, type HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  title?: string;
  description?: string;
  actions?: ReactNode;
  noPadding?: boolean;
}

export function Card({
  className,
  title,
  description,
  actions,
  noPadding = false,
  children,
  ...props
}: CardProps) {
  return (
    <div
      className={cn(
        'bg-white dark:bg-neutral-800',
        'border border-neutral-200 dark:border-neutral-700',
        'rounded-xl shadow-sm',
        !noPadding && 'p-6',
        className
      )}
      {...props}
    >
      {(title || description || actions) && (
        <div className={cn('flex items-start justify-between', (title || description) && 'mb-4')}>
          <div>
            {title && (
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
                {title}
              </h3>
            )}
            {description && (
              <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
}
