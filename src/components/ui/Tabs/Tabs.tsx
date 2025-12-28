import { type ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';

export interface TabItem {
  key: string;
  label: ReactNode;
  content: ReactNode;
  disabled?: boolean;
}

export interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  className?: string;
}

export function Tabs({ items, activeKey, onChange, className }: TabsProps) {
  const activeItem = items.find((item) => item.key === activeKey);

  return (
    <div className={cn('flex flex-col h-full', className)}>
      {/* Tab Headers */}
      <div
        className="flex gap-1 p-2 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700"
        role="tablist"
      >
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={item.key === activeKey}
            aria-disabled={item.disabled}
            disabled={item.disabled}
            onClick={() => onChange(item.key)}
            className={cn(
              'px-4 py-2 text-sm font-medium rounded-lg transition-colors',
              'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              item.key === activeKey
                ? 'bg-white dark:bg-neutral-900 text-primary-600 dark:text-primary-400 shadow-sm'
                : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-700',
              item.disabled && 'opacity-50 cursor-not-allowed'
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div role="tabpanel" className="flex-1 overflow-y-auto">
        {activeItem?.content}
      </div>
    </div>
  );
}
