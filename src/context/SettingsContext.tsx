import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';

export type TranscriptionProvider = 'local' | 'openai';
export type LLMProvider = 'ollama' | 'openai' | 'claude';

interface Settings {
  // Transcription settings
  transcriptionProvider: TranscriptionProvider;
  transcriptionLanguage: string; // Whisper language code (e.g., 'en', 'ko', 'auto')
  whisperModel: string; // Model ID for local whisper.cpp (e.g., 'base', 'small', 'medium')
  openaiWhisperModel: string; // Model ID for OpenAI Whisper API (e.g., 'whisper-1')

  // LLM settings
  llmProvider: LLMProvider;
  ollamaModel: string;
  openaiModel: string;
  claudeModel: string;
}

interface SettingsContextValue {
  settings: Settings;
  updateSettings: (updates: Partial<Settings>) => void;
  setTranscriptionProvider: (provider: TranscriptionProvider) => void;
  setTranscriptionLanguage: (language: string) => void;
  setWhisperModel: (model: string) => void;
  setOpenaiWhisperModel: (model: string) => void;
  setLLMProvider: (provider: LLMProvider) => void;
  setOllamaModel: (model: string) => void;
  setOpenaiModel: (model: string) => void;
  setClaudeModel: (model: string) => void;
  // Language change detection for re-transcription
  hasLanguageChanged: () => boolean;
  markLanguageAsUsed: () => void;
}

const STORAGE_KEY = 'clip-flow-settings';
const LAST_LANGUAGE_KEY = 'clip-flow-last-transcription-language';

const defaultSettings: Settings = {
  transcriptionProvider: 'local',
  transcriptionLanguage: 'auto',
  whisperModel: 'base',
  openaiWhisperModel: 'whisper-1',
  llmProvider: 'ollama',
  ollamaModel: 'llama3.2',
  openaiModel: 'gpt-4o',
  claudeModel: 'claude-3-5-sonnet-latest',
};

function getStoredSettings(): Settings {
  if (typeof window === 'undefined') return defaultSettings;

  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      return { ...defaultSettings, ...parsed };
    }
  } catch (error) {
    console.error('Failed to parse stored settings:', error);
  }

  return defaultSettings;
}

function saveSettings(settings: Settings): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

function getLastTranscriptionLanguage(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    return localStorage.getItem(LAST_LANGUAGE_KEY);
  } catch (error) {
    console.error('Failed to get last transcription language:', error);
    return null;
  }
}

function saveLastTranscriptionLanguage(language: string): void {
  if (typeof window === 'undefined') return;

  try {
    localStorage.setItem(LAST_LANGUAGE_KEY, language);
  } catch (error) {
    console.error('Failed to save last transcription language:', error);
  }
}

const SettingsContext = createContext<SettingsContextValue | undefined>(undefined);

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({ children }: SettingsProviderProps) {
  const [settings, setSettings] = useState<Settings>(getStoredSettings);

  // Save settings whenever they change
  useEffect(() => {
    saveSettings(settings);
  }, [settings]);

  const updateSettings = useCallback((updates: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...updates }));
  }, []);

  const setTranscriptionProvider = useCallback((provider: TranscriptionProvider) => {
    updateSettings({ transcriptionProvider: provider });
  }, [updateSettings]);

  const setTranscriptionLanguage = useCallback((language: string) => {
    updateSettings({ transcriptionLanguage: language });
  }, [updateSettings]);

  const setWhisperModel = useCallback((model: string) => {
    updateSettings({ whisperModel: model });
  }, [updateSettings]);

  const setOpenaiWhisperModel = useCallback((model: string) => {
    updateSettings({ openaiWhisperModel: model });
  }, [updateSettings]);

  const setLLMProvider = useCallback((provider: LLMProvider) => {
    updateSettings({ llmProvider: provider });
  }, [updateSettings]);

  const setOllamaModel = useCallback((model: string) => {
    updateSettings({ ollamaModel: model });
  }, [updateSettings]);

  const setOpenaiModel = useCallback((model: string) => {
    updateSettings({ openaiModel: model });
  }, [updateSettings]);

  const setClaudeModel = useCallback((model: string) => {
    updateSettings({ claudeModel: model });
  }, [updateSettings]);

  const hasLanguageChanged = useCallback((): boolean => {
    const lastLanguage = getLastTranscriptionLanguage();
    console.log('[SettingsContext] Last transcription language:', lastLanguage);
    console.log('[SettingsContext] Current transcription language:', settings.transcriptionLanguage);
    // If no previous language stored, no change detected (first run)
    if (lastLanguage === null) {
      console.log('[SettingsContext] No previous language stored (first run)');
      return false;
    }
    const changed = lastLanguage !== settings.transcriptionLanguage;
    console.log('[SettingsContext] Language changed:', changed);
    return changed;
  }, [settings.transcriptionLanguage]);

  const markLanguageAsUsed = useCallback(() => {
    saveLastTranscriptionLanguage(settings.transcriptionLanguage);
  }, [settings.transcriptionLanguage]);

  return (
    <SettingsContext.Provider
      value={{
        settings,
        updateSettings,
        setTranscriptionProvider,
        setTranscriptionLanguage,
        setWhisperModel,
        setOpenaiWhisperModel,
        setLLMProvider,
        setOllamaModel,
        setOpenaiModel,
        setClaudeModel,
        hasLanguageChanged,
        markLanguageAsUsed,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
