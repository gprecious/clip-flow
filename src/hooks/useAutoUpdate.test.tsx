import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

// Mock Tauri plugins before imports
vi.mock('@tauri-apps/plugin-updater', () => ({
  check: vi.fn(),
}));

vi.mock('@tauri-apps/plugin-process', () => ({
  relaunch: vi.fn(),
}));

vi.mock('@/context/SettingsContext', () => ({
  useSettings: vi.fn(),
}));

import { check } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { useSettings } from '@/context/SettingsContext';
import { useAutoUpdate, type UpdateInfo } from './useAutoUpdate';

// Create a mock Update object
const createMockUpdate = (info: Partial<UpdateInfo> = {}) => ({
  version: info.version ?? '1.1.0',
  currentVersion: info.currentVersion ?? '1.0.0',
  date: info.date ?? '2024-01-01',
  body: info.body ?? 'Release notes',
  downloadAndInstall: vi.fn(),
});

describe('useAutoUpdate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: autoUpdateEnabled = false
    vi.mocked(useSettings).mockReturnValue({
      settings: {
        autoUpdateEnabled: false,
        transcriptionProvider: 'local',
        transcriptionLanguage: 'auto',
        whisperModel: 'base',
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
  });

  describe('initial state', () => {
    it('should return correct initial state', () => {
      vi.mocked(check).mockResolvedValue(null);

      const { result } = renderHook(() => useAutoUpdate());

      expect(result.current.checking).toBe(false);
      expect(result.current.updateAvailable).toBeNull();
      expect(result.current.downloading).toBe(false);
      expect(result.current.downloadProgress).toBe(0);
      expect(result.current.downloadTotal).toBeNull();
      expect(result.current.error).toBeNull();
      expect(result.current.installed).toBe(false);
    });
  });

  describe('checkForUpdates', () => {
    it('should set checking to true during check', async () => {
      let resolveCheck: (value: null) => void;
      vi.mocked(check).mockImplementation(
        () => new Promise((resolve) => {
          resolveCheck = resolve;
        })
      );

      const { result } = renderHook(() => useAutoUpdate());

      act(() => {
        result.current.checkForUpdates();
      });

      expect(result.current.checking).toBe(true);

      await act(async () => {
        resolveCheck!(null);
      });

      expect(result.current.checking).toBe(false);
    });

    it('should return update info when available', async () => {
      const mockUpdate = createMockUpdate({
        version: '2.0.0',
        currentVersion: '1.0.0',
        date: '2024-06-01',
        body: 'New features',
      });
      vi.mocked(check).mockResolvedValue(mockUpdate as never);

      const { result } = renderHook(() => useAutoUpdate());

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.updateAvailable).toEqual({
        version: '2.0.0',
        currentVersion: '1.0.0',
        date: '2024-06-01',
        body: 'New features',
      });
      expect(result.current.checking).toBe(false);
    });

    it('should return null when no update available', async () => {
      vi.mocked(check).mockResolvedValue(null);

      const { result } = renderHook(() => useAutoUpdate());

      await act(async () => {
        const update = await result.current.checkForUpdates();
        expect(update).toBeNull();
      });

      expect(result.current.updateAvailable).toBeNull();
    });

    it('should handle check failure gracefully', async () => {
      vi.mocked(check).mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useAutoUpdate());

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.checking).toBe(false);
      expect(result.current.error).toBe('Network error');
    });

    it('should handle non-Error rejection', async () => {
      vi.mocked(check).mockRejectedValue('Unknown failure');

      const { result } = renderHook(() => useAutoUpdate());

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.error).toBe('Update check failed');
    });
  });

  describe('downloadAndInstall', () => {
    it('should set error when no update available', async () => {
      vi.mocked(check).mockResolvedValue(null);

      const { result } = renderHook(() => useAutoUpdate());

      await act(async () => {
        await result.current.downloadAndInstall();
      });

      expect(result.current.error).toBe('No update available to download');
    });

    it('should track download progress', async () => {
      const mockUpdate = createMockUpdate();

      mockUpdate.downloadAndInstall.mockImplementation(async (callback) => {
        // Simulate download events
        callback({ event: 'Started', data: { contentLength: 1000 } });
        callback({ event: 'Progress', data: { chunkLength: 500 } });
        callback({ event: 'Progress', data: { chunkLength: 500 } });
        callback({ event: 'Finished', data: {} });
      });

      vi.mocked(check).mockResolvedValue(mockUpdate as never);

      const { result } = renderHook(() => useAutoUpdate());

      // First check for updates
      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.updateAvailable).not.toBeNull();

      // Then download and install
      await act(async () => {
        await result.current.downloadAndInstall();
      });

      expect(result.current.downloadTotal).toBe(1000);
      expect(result.current.downloadProgress).toBe(1000);
      expect(result.current.installed).toBe(true);
      expect(result.current.downloading).toBe(false);
    });

    it('should handle download failure', async () => {
      const mockUpdate = createMockUpdate();
      mockUpdate.downloadAndInstall.mockRejectedValue(new Error('Download failed'));

      vi.mocked(check).mockResolvedValue(mockUpdate as never);

      const { result } = renderHook(() => useAutoUpdate());

      await act(async () => {
        await result.current.checkForUpdates();
      });

      await act(async () => {
        await result.current.downloadAndInstall();
      });

      expect(result.current.downloading).toBe(false);
      expect(result.current.error).toBe('Download failed');
      expect(result.current.installed).toBe(false);
    });
  });

  describe('restartApp', () => {
    it('should call relaunch', async () => {
      vi.mocked(relaunch).mockResolvedValue(undefined);

      const { result } = renderHook(() => useAutoUpdate());

      await act(async () => {
        await result.current.restartApp();
      });

      expect(relaunch).toHaveBeenCalledTimes(1);
    });

    it('should handle restart failure', async () => {
      vi.mocked(relaunch).mockRejectedValue(new Error('Restart failed'));

      const { result } = renderHook(() => useAutoUpdate());

      await act(async () => {
        await result.current.restartApp();
      });

      expect(result.current.error).toBe('Restart failed');
    });
  });

  describe('dismissUpdate', () => {
    it('should reset update available state', async () => {
      const mockUpdate = createMockUpdate();
      vi.mocked(check).mockResolvedValue(mockUpdate as never);

      const { result } = renderHook(() => useAutoUpdate());

      await act(async () => {
        await result.current.checkForUpdates();
      });

      expect(result.current.updateAvailable).not.toBeNull();

      act(() => {
        result.current.dismissUpdate();
      });

      expect(result.current.updateAvailable).toBeNull();
    });
  });

  describe('auto-check on startup', () => {
    it('should check on startup if autoUpdateEnabled is true', async () => {
      vi.mocked(useSettings).mockReturnValue({
        settings: {
          autoUpdateEnabled: true,
          transcriptionProvider: 'local',
          transcriptionLanguage: 'auto',
          whisperModel: 'base',
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

      vi.mocked(check).mockResolvedValue(null);

      renderHook(() => useAutoUpdate());

      await waitFor(() => {
        expect(check).toHaveBeenCalledTimes(1);
      });
    });

    it('should not check if autoUpdateEnabled is false', async () => {
      vi.mocked(useSettings).mockReturnValue({
        settings: {
          autoUpdateEnabled: false,
          transcriptionProvider: 'local',
          transcriptionLanguage: 'auto',
          whisperModel: 'base',
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

      renderHook(() => useAutoUpdate());

      // Wait a bit to ensure no check happens
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(check).not.toHaveBeenCalled();
    });

    it('should only check once on startup', async () => {
      vi.mocked(useSettings).mockReturnValue({
        settings: {
          autoUpdateEnabled: true,
          transcriptionProvider: 'local',
          transcriptionLanguage: 'auto',
          whisperModel: 'base',
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

      vi.mocked(check).mockResolvedValue(null);

      const { rerender } = renderHook(() => useAutoUpdate());

      await waitFor(() => {
        expect(check).toHaveBeenCalledTimes(1);
      });

      // Rerender multiple times
      rerender();
      rerender();

      // Should still only be called once
      expect(check).toHaveBeenCalledTimes(1);
    });
  });
});
