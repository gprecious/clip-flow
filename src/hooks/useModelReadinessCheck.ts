import { useState, useEffect, useCallback } from 'react';
import {
  checkWhisperAvailable,
  getInstalledModels,
  getApiKeyStatus,
} from '@/lib/tauri';
import { useSettings } from '@/context/SettingsContext';

export interface ModelReadinessState {
  isChecking: boolean;
  isReady: boolean;
  whisperAvailable: boolean;
  hasInstalledModels: boolean;
  hasOpenAIKey: boolean;
  selectedModelInstalled: boolean;
  installedModels: string[];
}

/**
 * Hook that checks if transcription models are ready on mount.
 * Used to show warnings when entering the page if models are not configured.
 */
export function useModelReadinessCheck() {
  const { settings } = useSettings();
  const [state, setState] = useState<ModelReadinessState>({
    isChecking: true,
    isReady: false,
    whisperAvailable: false,
    hasInstalledModels: false,
    hasOpenAIKey: false,
    selectedModelInstalled: false,
    installedModels: [],
  });

  const checkReadiness = useCallback(async () => {
    setState((prev) => ({ ...prev, isChecking: true }));

    try {
      const [whisperAvailable, installedModels, apiStatus] = await Promise.all([
        checkWhisperAvailable().catch(() => false),
        getInstalledModels().catch((): string[] => []),
        getApiKeyStatus().catch(() => ({ openai: false, claude: false })),
      ]);

      const hasInstalledModels = installedModels.length > 0;
      const hasOpenAIKey = apiStatus.openai;
      const selectedModelInstalled = installedModels.includes(settings.whisperModel);

      // Determine if transcription is ready based on provider
      let isReady = false;
      if (settings.transcriptionProvider === 'local') {
        isReady = whisperAvailable && hasInstalledModels;
      } else if (settings.transcriptionProvider === 'openai') {
        isReady = hasOpenAIKey;
      }

      // If primary provider isn't ready but fallback is available, still mark as ready
      if (!isReady) {
        if (settings.transcriptionProvider === 'local' && hasOpenAIKey) {
          isReady = true; // Can fall back to OpenAI
        } else if (settings.transcriptionProvider === 'openai' && whisperAvailable && hasInstalledModels) {
          isReady = true; // Can fall back to local
        }
      }

      setState({
        isChecking: false,
        isReady,
        whisperAvailable,
        hasInstalledModels,
        hasOpenAIKey,
        selectedModelInstalled,
        installedModels,
      });
    } catch (error) {
      console.error('[useModelReadinessCheck] Failed to check readiness:', error);
      setState((prev) => ({ ...prev, isChecking: false }));
    }
  }, [settings.whisperModel, settings.transcriptionProvider]);

  // Check on mount
  useEffect(() => {
    checkReadiness();
  }, [checkReadiness]);

  return {
    ...state,
    recheck: checkReadiness,
  };
}

export default useModelReadinessCheck;
