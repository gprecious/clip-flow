import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card, FileDropzone, Button, Progress, Tabs } from '@/components/ui';

export function TranscribePage() {
  const { t } = useTranslation();
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('segments');

  const handleStartTranscription = async () => {
    if (files.length === 0) return;

    setIsProcessing(true);
    setProgress(0);

    // Simulate transcription progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsProcessing(false);
          setResult('This is a sample transcription result. In the real app, this would be the transcribed text from your media file.');
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

  const tabItems = [
    {
      key: 'segments',
      label: t('transcribe.segments'),
      content: (
        <div className="space-y-2">
          {['0:00 - 0:15', '0:15 - 0:30', '0:30 - 0:45'].map((time, idx) => (
            <div key={time} className="p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
              <span className="text-xs text-primary-600 dark:text-primary-400 font-mono">{time}</span>
              <p className="text-sm text-neutral-700 dark:text-neutral-300 mt-1">
                {result ? `Segment ${idx + 1} of the transcription...` : ''}
              </p>
            </div>
          ))}
        </div>
      ),
    },
    {
      key: 'fullText',
      label: t('transcribe.fullText'),
      content: (
        <div className="p-4 bg-neutral-50 dark:bg-neutral-800 rounded-lg">
          <p className="text-sm text-neutral-700 dark:text-neutral-300 whitespace-pre-wrap">
            {result}
          </p>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <Card title={t('transcribe.title')}>
        <div className="space-y-4">
          <FileDropzone
            accept="video/*,audio/*,.mp4,.mp3,.wav,.m4a,.webm"
            multiple
            onDrop={setFiles}
            title={t('transcribe.dropzone.title')}
            subtitle={t('transcribe.dropzone.subtitle')}
          />

          {files.length > 0 && (
            <div className="flex items-center justify-between">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {files.length} {files.length === 1 ? 'file' : 'files'} selected
              </p>
              <Button
                onClick={handleStartTranscription}
                disabled={isProcessing}
                loading={isProcessing}
              >
                {isProcessing ? t('transcribe.processing') : t('transcribe.title')}
              </Button>
            </div>
          )}

          {isProcessing && (
            <Progress
              value={progress}
              showLabel
              label={t('transcribe.progress', { percent: progress })}
            />
          )}
        </div>
      </Card>

      {result && (
        <Card title={t('transcribe.result')}>
          <div className="space-y-4">
            <Tabs
              items={tabItems}
              activeKey={activeTab}
              onChange={setActiveTab}
            />

            <div className="flex gap-2">
              <Button variant="secondary" size="sm">
                {t('transcribe.copyText')}
              </Button>
              <Button variant="secondary" size="sm">
                {t('transcribe.download')}
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

export default TranscribePage;
