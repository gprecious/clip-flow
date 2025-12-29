import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { open, confirm } from '@tauri-apps/plugin-dialog';
import { useMedia } from '@/context/MediaContext';
import { useAutoTranscribe, useAutoSummarize } from '@/hooks';
import { Button, Spinner } from '@/components/ui';
import { FileTree, Inspector } from '@/components/features';

export function HomePage() {
  const { t } = useTranslation();
  const { state, setRootDirectory, retranscribeAllFiles, getAllFiles } = useMedia();
  const [isRetranscribing, setIsRetranscribing] = useState(false);

  // Auto-transcribe files when added
  useAutoTranscribe();

  // Auto-summarize transcriptions when completed
  useAutoSummarize();

  const handleSelectDirectory = useCallback(async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: t('home.selectDirectory', 'Select Media Directory'),
      });

      if (selected && typeof selected === 'string') {
        await setRootDirectory(selected);
      }
    } catch (error) {
      console.error('Failed to select directory:', error);
    }
  }, [t, setRootDirectory]);

  const handleRetranscribeAll = useCallback(async () => {
    const fileCount = getAllFiles().length;
    if (fileCount === 0) return;

    const confirmed = await confirm(
      t('home.retranscribeAllConfirm', 'All {{count}} files will be re-transcribed. Are you sure?', { count: fileCount }),
      {
        title: t('home.retranscribeAll', 'Re-transcribe All'),
        kind: 'warning',
      }
    );

    if (confirmed) {
      setIsRetranscribing(true);
      retranscribeAllFiles();
      // Brief delay to show the action was triggered
      setTimeout(() => setIsRetranscribing(false), 500);
    }
  }, [t, getAllFiles, retranscribeAllFiles]);

  const hasDirectory = state.rootPath !== null;

  return (
    <div className="h-full flex">
      {/* Left Panel - File Tree */}
      <div className="w-72 flex-shrink-0 border-r border-neutral-200 dark:border-neutral-700 flex flex-col bg-neutral-50 dark:bg-neutral-900">
        {/* Directory Header */}
        <div className="p-3 border-b border-neutral-200 dark:border-neutral-700">
          {hasDirectory ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 min-w-0">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                  {t('home.watchingDirectory', 'Watching')}
                </p>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {state.rootFolder?.name || state.rootPath}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectDirectory}
                title={t('home.changeFolder', 'Change folder')}
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
                  />
                </svg>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRetranscribeAll}
                disabled={isRetranscribing}
                title={t('home.retranscribeAll', 'Re-transcribe All')}
              >
                <svg className={`w-4 h-4 ${isRetranscribing ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={handleSelectDirectory}
            >
              <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              {t('home.selectFolder', 'Select Folder')}
            </Button>
          )}
        </div>

        {/* File Tree or Loading */}
        {state.isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <Spinner size="lg" />
          </div>
        ) : hasDirectory ? (
          <FileTree className="flex-1" />
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center">
              {t('home.noDirectorySelected', 'No directory selected')}
            </p>
          </div>
        )}
      </div>

      {/* Right Panel - Inspector */}
      <div className="flex-1 flex flex-col min-w-0 bg-white dark:bg-neutral-900">
        {hasDirectory ? (
          <Inspector className="flex-1" />
        ) : (
          <EmptyState onSelectDirectory={handleSelectDirectory} />
        )}
      </div>
    </div>
  );
}

interface EmptyStateProps {
  onSelectDirectory: () => void;
}

function EmptyState({ onSelectDirectory }: EmptyStateProps) {
  const { t } = useTranslation();

  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center mb-4">
            <svg
              className="w-10 h-10 text-primary-600 dark:text-primary-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
            {t('home.welcome', 'Welcome to Clip Flow')}
          </h2>
          <p className="mt-2 text-neutral-600 dark:text-neutral-400">
            {t('home.directoryDescription', 'Select a folder containing your media files to get started with automatic transcription')}
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          className="w-full"
          onClick={onSelectDirectory}
        >
          <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
          </svg>
          {t('home.selectMediaFolder', 'Select Media Folder')}
        </Button>

        <div className="mt-8 grid grid-cols-3 gap-4 text-center">
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
            <div className="w-8 h-8 mx-auto rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">MP4, WebM, MOV</p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
            <div className="w-8 h-8 mx-auto rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-purple-600 dark:text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
              </svg>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">MP3, WAV, M4A</p>
          </div>
          <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800">
            <div className="w-8 h-8 mx-auto rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-2">
              <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
            </div>
            <p className="text-xs text-neutral-600 dark:text-neutral-400">{t('home.autoWatch', 'Auto-watch')}</p>
          </div>
        </div>

        <p className="mt-6 text-xs text-center text-neutral-500 dark:text-neutral-400">
          {t('home.autoWatchDescription', 'New files added to the folder will be automatically detected and transcribed')}
        </p>
      </div>
    </div>
  );
}

export default HomePage;
