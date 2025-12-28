import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

export interface SwitchProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'size'> {
  label?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: {
    track: 'w-8 h-4',
    thumb: 'w-3 h-3 translate-x-0.5 peer-checked:translate-x-4',
  },
  md: {
    track: 'w-11 h-6',
    thumb: 'w-5 h-5 translate-x-0.5 peer-checked:translate-x-5',
  },
  lg: {
    track: 'w-14 h-7',
    thumb: 'w-6 h-6 translate-x-0.5 peer-checked:translate-x-7',
  },
};

export const Switch = forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, label, description, size = 'md', id, disabled, ...props }, ref) => {
    const switchId = id || label?.toLowerCase().replace(/\s+/g, '-');

    return (
      <label
        htmlFor={switchId}
        className={cn(
          'inline-flex items-start gap-3 cursor-pointer',
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
      >
        <div className="relative flex-shrink-0">
          <input
            ref={ref}
            type="checkbox"
            id={switchId}
            disabled={disabled}
            className="peer sr-only"
            {...props}
          />
          <div
            className={cn(
              'rounded-full transition-colors duration-200',
              'bg-neutral-300 dark:bg-neutral-600',
              'peer-checked:bg-primary-500',
              'peer-focus-visible:ring-2 peer-focus-visible:ring-primary-500 peer-focus-visible:ring-offset-2',
              sizeStyles[size].track
            )}
          />
          <div
            className={cn(
              'absolute top-1/2 -translate-y-1/2 rounded-full',
              'bg-white shadow-sm',
              'transition-transform duration-200',
              sizeStyles[size].thumb
            )}
          />
        </div>
        {(label || description) && (
          <div className="pt-0.5">
            {label && (
              <span className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {label}
              </span>
            )}
            {description && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400">{description}</p>
            )}
          </div>
        )}
      </label>
    );
  }
);

Switch.displayName = 'Switch';
