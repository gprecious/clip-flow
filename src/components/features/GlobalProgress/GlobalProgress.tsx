import { useTranslation } from 'react-i18next';
import { useQueue } from '@/context/QueueContext';
import { Progress } from '@/components/ui/Progress';
import { cn } from '@/lib/utils/cn';

interface GlobalProgressProps {
  className?: string;
}

export function GlobalProgress({ className }: GlobalProgressProps) {
  const { t } = useTranslation();
  const { isProcessing, overallProgress, transcriptionStats, summarizationStats } = useQueue();

  if (!isProcessing) {
    return null;
  }

  const transcriptionTotal = transcriptionStats.pending + transcriptionStats.active + transcriptionStats.completed + transcriptionStats.error;
  const summarizationTotal = summarizationStats.pending + summarizationStats.active + summarizationStats.completed + summarizationStats.error;

  const transcriptionCompleted = transcriptionStats.completed + transcriptionStats.error;
  const summarizationCompleted = summarizationStats.completed + summarizationStats.error;

  return (
    <div
      className={cn(
        'fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-200 dark:border-neutral-700 px-4 py-2',
        className
      )}
    >
      <div className="max-w-screen-2xl mx-auto flex items-center gap-4">
        <Progress value={overallProgress} size="sm" className="flex-1 max-w-md" />
        <div className="flex items-center gap-3 text-xs text-neutral-600 dark:text-neutral-400">
          {transcriptionTotal > 0 && (
            <span className="flex items-center gap-1.5">
              <span className={cn(
                'w-2 h-2 rounded-full',
                transcriptionStats.active > 0 ? 'bg-primary-500 animate-pulse' : 'bg-neutral-300 dark:bg-neutral-600'
              )} />
              <span>{t('queue.transcribing')}</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {t('queue.progress', { completed: transcriptionCompleted, total: transcriptionTotal })}
              </span>
            </span>
          )}
          {summarizationTotal > 0 && (
            <span className="flex items-center gap-1.5">
              <span className={cn(
                'w-2 h-2 rounded-full',
                summarizationStats.active > 0 ? 'bg-success-500 animate-pulse' : 'bg-neutral-300 dark:bg-neutral-600'
              )} />
              <span>{t('queue.summarizing')}</span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {t('queue.progress', { completed: summarizationCompleted, total: summarizationTotal })}
              </span>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export default GlobalProgress;
