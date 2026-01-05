import { useState, useEffect, useCallback, useRef } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useSettings } from '@/context/SettingsContext';

export interface UpdateInfo {
  version: string;
  currentVersion: string;
  date: string | null;
  body: string | null;
}

export interface UpdateState {
  checking: boolean;
  updateAvailable: UpdateInfo | null;
  downloading: boolean;
  downloadProgress: number;
  downloadTotal: number | null;
  error: string | null;
  installed: boolean;
}

export function useAutoUpdate() {
  const { settings } = useSettings();
  const [state, setState] = useState<UpdateState>({
    checking: false,
    updateAvailable: null,
    downloading: false,
    downloadProgress: 0,
    downloadTotal: null,
    error: null,
    installed: false,
  });

  const downloadedRef = useRef(0);
  const hasCheckedOnStartup = useRef(false);
  const updateRef = useRef<Update | null>(null);

  const checkForUpdates = useCallback(async () => {
    setState((prev) => ({ ...prev, checking: true, error: null }));
    try {
      const update = await check();
      if (update) {
        updateRef.current = update;
        setState((prev) => ({
          ...prev,
          checking: false,
          updateAvailable: {
            version: update.version,
            currentVersion: update.currentVersion,
            date: update.date ?? null,
            body: update.body ?? null,
          },
        }));
        return update;
      }
      setState((prev) => ({
        ...prev,
        checking: false,
        updateAvailable: null,
      }));
      return null;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        checking: false,
        error: error instanceof Error ? error.message : 'Update check failed',
      }));
      return null;
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    if (!updateRef.current) {
      setState((prev) => ({
        ...prev,
        error: 'No update available to download',
      }));
      return;
    }

    setState((prev) => ({
      ...prev,
      downloading: true,
      downloadProgress: 0,
      error: null,
    }));
    downloadedRef.current = 0;

    try {
      await updateRef.current.downloadAndInstall((event) => {
        if (event.event === 'Started') {
          setState((prev) => ({
            ...prev,
            downloadTotal: event.data.contentLength ?? null,
          }));
        } else if (event.event === 'Progress') {
          downloadedRef.current += event.data.chunkLength;
          setState((prev) => ({
            ...prev,
            downloadProgress: downloadedRef.current,
          }));
        } else if (event.event === 'Finished') {
          setState((prev) => ({
            ...prev,
            downloading: false,
            installed: true,
          }));
        }
      });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        downloading: false,
        error: error instanceof Error ? error.message : 'Download failed',
      }));
    }
  }, []);

  const restartApp = useCallback(async () => {
    try {
      await relaunch();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to restart',
      }));
    }
  }, []);

  const dismissUpdate = useCallback(() => {
    setState((prev) => ({ ...prev, updateAvailable: null }));
    updateRef.current = null;
  }, []);

  // Check for updates on startup if auto-update is enabled
  useEffect(() => {
    if (settings.autoUpdateEnabled && !hasCheckedOnStartup.current) {
      hasCheckedOnStartup.current = true;
      checkForUpdates();
    }
  }, [settings.autoUpdateEnabled, checkForUpdates]);

  return {
    ...state,
    checkForUpdates,
    downloadAndInstall,
    restartApp,
    dismissUpdate,
  };
}
