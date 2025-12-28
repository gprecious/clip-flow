import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Progress } from '@/components/ui';

export function SummaryPage() {
  const { t } = useTranslation();
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [summary, setSummary] = useState<string | null>(null);

  const handleGenerateSummary = async () => {
    setIsGenerating(true);
    setProgress(0);

    // Simulate summary generation
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setSummary('This is a sample summary of your transcribed content. The AI has analyzed the text and identified the key points, themes, and important information.');
          return 100;
        }
        return prev + 20;
      });
    }, 400);
  };

  return (
    <div className="space-y-6">
      <Card title={t('summary.title')}>
        <div className="space-y-4">
          <p className="text-neutral-600 dark:text-neutral-400">
            {t('summary.dragToReorder')}
          </p>

          <div className="flex gap-2">
            <Button
              onClick={handleGenerateSummary}
              disabled={isGenerating}
              loading={isGenerating}
            >
              {isGenerating ? t('summary.generating') : t('summary.generate')}
            </Button>
            <Button variant="secondary">
              {t('summary.autoSort')}
            </Button>
            <Button variant="secondary">
              {t('summary.manualSort')}
            </Button>
          </div>

          {isGenerating && (
            <Progress
              value={progress}
              showLabel
              label={t('summary.generating')}
            />
          )}
        </div>
      </Card>

      {summary && (
        <Card title={t('summary.result')}>
          <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
            <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
              {summary}
            </p>
          </div>
        </Card>
      )}

      <Card title={t('summary.storyOrder')}>
        <div className="space-y-2">
          {[1, 2, 3].map((item) => (
            <div
              key={item}
              className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700 cursor-move"
            >
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                Clip {item} - Sample clip description
              </p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default SummaryPage;
