import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { useTheme } from '@/context/ThemeContext';
import { LanguageSwitcher } from '@/components/ui';

export interface HeaderProps {
  title?: string;
  actions?: ReactNode;
  showThemeToggle?: boolean;
  showLanguageSwitcher?: boolean;
  className?: string;
}

export function Header({
  title,
  actions,
  showThemeToggle = true,
  showLanguageSwitcher = true,
  className
}: HeaderProps) {
  const { resolvedTheme, toggleTheme } = useTheme();

  return (
    <header
      className={cn(
        'flex items-center justify-between h-14 px-6',
        'bg-white dark:bg-neutral-900',
        'border-b border-neutral-200 dark:border-neutral-800',
        className
      )}
    >
      <div className="flex items-center gap-4">
        {title && (
          <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h1>
        )}
      </div>

      <div className="flex items-center gap-3">
        {actions}

        {showLanguageSwitcher && <LanguageSwitcher />}

        {showThemeToggle && (
          <button
            onClick={toggleTheme}
            className={cn(
              'p-2 rounded-lg transition-colors',
              'text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200',
              'hover:bg-neutral-100 dark:hover:bg-neutral-800',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500'
            )}
            aria-label={`Switch to ${resolvedTheme === 'light' ? 'dark' : 'light'} mode`}
          >
            {resolvedTheme === 'light' ? (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
                />
              </svg>
            ) : (
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                />
              </svg>
            )}
          </button>
        )}
      </div>
    </header>
  );
}
