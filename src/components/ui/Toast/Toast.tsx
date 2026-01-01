import { useEffect, type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastProps {
  type?: ToastType;
  message: ReactNode;
  duration?: number;
  onClose: () => void;
  visible: boolean;
}

const typeStyles = {
  success: {
    container: 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-700',
    icon: 'text-green-600 dark:text-green-400',
    text: 'text-green-800 dark:text-green-100',
  },
  error: {
    container: 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-700',
    icon: 'text-red-600 dark:text-red-400',
    text: 'text-red-800 dark:text-red-100',
  },
  warning: {
    container: 'bg-amber-50 dark:bg-amber-950 border-amber-200 dark:border-amber-700',
    icon: 'text-amber-600 dark:text-amber-400',
    text: 'text-amber-800 dark:text-amber-100',
  },
  info: {
    container: 'bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-700',
    icon: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-800 dark:text-blue-100',
  },
};

const icons = {
  success: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  ),
  error: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
  warning: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
      />
    </svg>
  ),
  info: (
    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  ),
};

export function Toast({ type = 'info', message, duration = 5000, onClose, visible }: ToastProps) {
  useEffect(() => {
    if (visible && duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [visible, duration, onClose]);

  if (!visible) return null;

  const styles = typeStyles[type];

  return (
    <div
      role="alert"
      className={cn(
        'fixed bottom-4 right-4 z-50',
        'flex items-center gap-3 px-4 py-3',
        'border rounded-lg shadow-lg',
        'animate-in slide-in-from-right fade-in duration-300',
        styles.container
      )}
    >
      <span className={styles.icon}>{icons[type]}</span>
      <span className={cn('text-sm font-medium', styles.text)}>{message}</span>
      <button
        onClick={onClose}
        className={cn('p-1 rounded hover:bg-black/5 dark:hover:bg-white/5', styles.icon)}
        aria-label="Close"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
