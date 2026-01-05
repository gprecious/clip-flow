import { useTranslation } from 'react-i18next';
import { Card, Switch, Button, Progress } from '@/components/ui';
import { useSettings } from '@/context/SettingsContext';
import { useAutoUpdate } from '@/hooks';

export function UpdateSection() {
  const { t } = useTranslation();
  const { settings, setAutoUpdateEnabled } = useSettings();
  const {
    checking,
    updateAvailable,
    downloading,
    downloadProgress,
    downloadTotal,
    error,
    installed,
    checkForUpdates,
    downloadAndInstall,
    restartApp,
    dismissUpdate,
  } = useAutoUpdate();

  const progressPercent = downloadTotal
    ? Math.round((downloadProgress / downloadTotal) * 100)
    : 0;

  return (
    <Card title={t('settings.updates', 'Updates')}>
      <div className="space-y-4">
        {/* Auto-update toggle */}
        <Switch
          label={t('settings.autoUpdate', 'Automatic Updates')}
          description={t(
            'settings.autoUpdateDesc',
            'Check for updates when the app starts'
          )}
          checked={settings.autoUpdateEnabled}
          onChange={(e) => setAutoUpdateEnabled(e.target.checked)}
        />

        {/* Update status */}
        <div className="pt-3 border-t border-neutral-200 dark:border-neutral-700">
          {/* Error state */}
          {error && (
            <div className="p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300 rounded-lg text-sm mb-3">
              {error}
            </div>
          )}

          {/* Update available notification */}
          {updateAvailable && !downloading && !installed && (
            <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium text-blue-900 dark:text-blue-100">
                    {t('settings.updateAvailable', 'Update Available')}
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {t('settings.newVersion', 'Version {{version}} is available', {
                      version: updateAvailable.version,
                    })}
                  </p>
                  {updateAvailable.body && (
                    <p className="text-sm text-blue-600 dark:text-blue-400 mt-2 whitespace-pre-wrap">
                      {updateAvailable.body}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={dismissUpdate}
                  className="text-blue-500 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-200 p-1"
                  aria-label={t('common.close', 'Close')}
                >
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
              <Button onClick={downloadAndInstall} className="mt-3" size="sm">
                {t('settings.downloadAndInstall', 'Download and Install')}
              </Button>
            </div>
          )}

          {/* Downloading state */}
          {downloading && (
            <div className="space-y-2">
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('settings.downloading', 'Downloading update...')}
              </p>
              <Progress
                value={progressPercent}
                max={100}
                showLabel
                label={t('settings.downloadProgress', 'Download Progress')}
              />
            </div>
          )}

          {/* Installed state - needs restart */}
          {installed && (
            <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <p className="text-green-700 dark:text-green-300">
                {t(
                  'settings.updateInstalled',
                  'Update installed. Restart to apply changes.'
                )}
              </p>
              <Button onClick={restartApp} className="mt-3" size="sm">
                {t('settings.restartNow', 'Restart Now')}
              </Button>
            </div>
          )}

          {/* No update available or not checked */}
          {!updateAvailable && !downloading && !installed && !error && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                {checking
                  ? t('settings.checkingUpdates', 'Checking for updates...')
                  : t('settings.upToDate', 'You are up to date')}
              </span>
              <Button
                onClick={checkForUpdates}
                variant="secondary"
                size="sm"
                disabled={checking}
              >
                {t('settings.checkNow', 'Check Now')}
              </Button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
