import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock Tauri commands before imports
vi.mock('@/lib/tauri', () => ({
  checkWhisperAvailable: vi.fn(),
  getInstalledModels: vi.fn(),
  getApiKeyStatus: vi.fn(),
}));

vi.mock('@/context/SettingsContext', () => ({
  useSettings: vi.fn(),
}));

import * as tauriModule from '@/lib/tauri';
import { useSettings } from '@/context/SettingsContext';
import { useModelReadinessCheck } from './useModelReadinessCheck';

describe('useModelReadinessCheck', () => {
  const mockSettings = (overrides: Partial<{
    transcriptionProvider: 'local' | 'openai';
    whisperModel: string;
  }> = {}) => {
    vi.mocked(useSettings).mockReturnValue({
      settings: {
        autoUpdateEnabled: false,
        transcriptionProvider: overrides.transcriptionProvider ?? 'local',
        transcriptionLanguage: 'auto',
        whisperModel: overrides.whisperModel ?? 'base',
        openaiWhisperModel: 'whisper-1',
        llmProvider: 'ollama',
        ollamaModel: 'llama3.2',
        openaiModel: 'gpt-4o',
        claudeModel: 'claude-3-5-sonnet-latest',
      },
      updateSettings: vi.fn(),
      setTranscriptionProvider: vi.fn(),
      setTranscriptionLanguage: vi.fn(),
      setWhisperModel: vi.fn(),
      setOpenaiWhisperModel: vi.fn(),
      setLLMProvider: vi.fn(),
      setOllamaModel: vi.fn(),
      setOpenaiModel: vi.fn(),
      setClaudeModel: vi.fn(),
      setAutoUpdateEnabled: vi.fn(),
      hasLanguageChanged: vi.fn().mockReturnValue(false),
      markLanguageAsUsed: vi.fn(),
    } as ReturnType<typeof useSettings>);
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSettings();
  });

  describe('initial state', () => {
    it('should start with isChecking true', () => {
      // Never resolve to keep in loading state
      vi.mocked(tauriModule.checkWhisperAvailable).mockImplementation(
        () => new Promise(() => {})
      );
      vi.mocked(tauriModule.getInstalledModels).mockImplementation(
        () => new Promise(() => {})
      );
      vi.mocked(tauriModule.getApiKeyStatus).mockImplementation(
        () => new Promise(() => {})
      );

      const { result } = renderHook(() => useModelReadinessCheck());

      expect(result.current.isChecking).toBe(true);
      expect(result.current.isReady).toBe(false);
    });
  });

  describe('local provider readiness', () => {
    beforeEach(() => {
      mockSettings({ transcriptionProvider: 'local' });
    });

    it('should be ready when whisper available and models installed', async () => {
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(true);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue(['base', 'small']);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      expect(result.current.isReady).toBe(true);
      expect(result.current.whisperAvailable).toBe(true);
      expect(result.current.hasInstalledModels).toBe(true);
      expect(result.current.installedModels).toEqual(['base', 'small']);
    });

    it('should not be ready when whisper unavailable', async () => {
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(false);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue(['base']);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      expect(result.current.isReady).toBe(false);
      expect(result.current.whisperAvailable).toBe(false);
    });

    it('should not be ready when no models installed', async () => {
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(true);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue([]);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      expect(result.current.isReady).toBe(false);
      expect(result.current.hasInstalledModels).toBe(false);
    });

    it('should check if selected model is installed', async () => {
      mockSettings({ transcriptionProvider: 'local', whisperModel: 'large' });
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(true);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue(['base', 'small']);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      expect(result.current.selectedModelInstalled).toBe(false);
    });

    it('should confirm selected model is installed', async () => {
      mockSettings({ transcriptionProvider: 'local', whisperModel: 'base' });
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(true);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue(['base', 'small']);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      expect(result.current.selectedModelInstalled).toBe(true);
    });
  });

  describe('OpenAI provider readiness', () => {
    beforeEach(() => {
      mockSettings({ transcriptionProvider: 'openai' });
    });

    it('should be ready when OpenAI key configured', async () => {
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(false);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue([]);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: true, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      expect(result.current.isReady).toBe(true);
      expect(result.current.hasOpenAIKey).toBe(true);
    });

    it('should not be ready without OpenAI key', async () => {
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(false);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue([]);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      expect(result.current.isReady).toBe(false);
      expect(result.current.hasOpenAIKey).toBe(false);
    });
  });

  describe('fallback logic', () => {
    it('should be ready if local provider fails but OpenAI is available', async () => {
      mockSettings({ transcriptionProvider: 'local' });
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(false);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue([]);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: true, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      // Local is not ready, but OpenAI fallback is available
      expect(result.current.isReady).toBe(true);
      expect(result.current.whisperAvailable).toBe(false);
      expect(result.current.hasOpenAIKey).toBe(true);
    });

    it('should be ready if OpenAI provider fails but local is available', async () => {
      mockSettings({ transcriptionProvider: 'openai' });
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(true);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue(['base']);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      // OpenAI is not ready, but local fallback is available
      expect(result.current.isReady).toBe(true);
      expect(result.current.hasOpenAIKey).toBe(false);
      expect(result.current.whisperAvailable).toBe(true);
    });

    it('should not be ready if neither provider is available', async () => {
      mockSettings({ transcriptionProvider: 'local' });
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(false);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue([]);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      expect(result.current.isReady).toBe(false);
    });
  });

  describe('recheck functionality', () => {
    it('should allow manual recheck', async () => {
      mockSettings({ transcriptionProvider: 'local' });

      // First check: not ready
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(false);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue([]);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      expect(result.current.isReady).toBe(false);

      // Change mock to simulate installation
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(true);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue(['base']);

      // Trigger recheck
      await act(async () => {
        await result.current.recheck();
      });

      expect(result.current.isReady).toBe(true);
    });

    it('should set isChecking during recheck', async () => {
      let resolveWhisper: (value: boolean) => void;
      vi.mocked(tauriModule.checkWhisperAvailable).mockImplementation(
        () => new Promise((resolve) => {
          resolveWhisper = resolve;
        })
      );
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue(['base']);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      // Wait for initial check to start
      await waitFor(() => {
        expect(result.current.isChecking).toBe(true);
      });

      // Resolve initial check
      await act(async () => {
        resolveWhisper!(true);
      });

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      // Set up for recheck
      vi.mocked(tauriModule.checkWhisperAvailable).mockImplementation(
        () => new Promise((resolve) => {
          resolveWhisper = resolve;
        })
      );

      // Start recheck
      act(() => {
        result.current.recheck();
      });

      expect(result.current.isChecking).toBe(true);

      await act(async () => {
        resolveWhisper!(true);
      });

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    it('should handle checkWhisperAvailable error gracefully', async () => {
      vi.mocked(tauriModule.checkWhisperAvailable).mockRejectedValue(new Error('Failed'));
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue(['base']);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: true, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      // Should fallback to false for whisper
      expect(result.current.whisperAvailable).toBe(false);
    });

    it('should handle getInstalledModels error gracefully', async () => {
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(true);
      vi.mocked(tauriModule.getInstalledModels).mockRejectedValue(new Error('Failed'));
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: true, claude: false });

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      // Should fallback to empty array
      expect(result.current.installedModels).toEqual([]);
      expect(result.current.hasInstalledModels).toBe(false);
    });

    it('should handle getApiKeyStatus error gracefully', async () => {
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(true);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue(['base']);
      vi.mocked(tauriModule.getApiKeyStatus).mockRejectedValue(new Error('Failed'));

      const { result } = renderHook(() => useModelReadinessCheck());

      await waitFor(() => {
        expect(result.current.isChecking).toBe(false);
      });

      // Should fallback to false for API keys
      expect(result.current.hasOpenAIKey).toBe(false);
    });
  });
});
