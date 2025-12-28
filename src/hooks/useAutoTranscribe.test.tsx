import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAutoTranscribe } from './useAutoTranscribe';
import type { ReactNode } from 'react';
import { MediaProvider } from '@/context/MediaContext';
import { SettingsProvider } from '@/context/SettingsContext';

// Mock the tauri module
vi.mock('@/lib/tauri', () => ({
  transcribeMedia: vi.fn(),
  getInstalledModels: vi.fn(),
  checkWhisperAvailable: vi.fn(),
  onTranscriptionProgress: vi.fn(() => Promise.resolve(() => {})),
  getApiKeyStatus: vi.fn(),
  openaiTranscribe: vi.fn(),
  scanMediaDirectoryTree: vi.fn(),
  startWatchingDirectory: vi.fn(),
  stopWatchingDirectory: vi.fn(),
  onFileChange: vi.fn(() => Promise.resolve(() => {})),
}));

// Get the mocked module
import * as tauriModule from '@/lib/tauri';

// Wrapper with all required providers
const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider>
    <MediaProvider>{children}</MediaProvider>
  </SettingsProvider>
);

describe('useAutoTranscribe', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Reset all mocks
    vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(false);
    vi.mocked(tauriModule.getInstalledModels).mockResolvedValue([]);
    vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });
    vi.mocked(tauriModule.onTranscriptionProgress).mockResolvedValue(() => {});
    vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
      path: '/test',
      name: 'test',
      is_dir: true,
      size: 0,
      modified: Date.now(),
      extension: null,
      children: [],
    });
    vi.mocked(tauriModule.startWatchingDirectory).mockResolvedValue(undefined);
    vi.mocked(tauriModule.stopWatchingDirectory).mockResolvedValue(undefined);
    vi.mocked(tauriModule.onFileChange).mockResolvedValue(() => {});
  });

  describe('initialization', () => {
    it('sets up progress listener on mount', async () => {
      renderHook(() => useAutoTranscribe(), { wrapper });

      await waitFor(() => {
        expect(tauriModule.onTranscriptionProgress).toHaveBeenCalled();
      });
    });

    it('cleans up progress listener on unmount', async () => {
      const unsubscribe = vi.fn();
      vi.mocked(tauriModule.onTranscriptionProgress).mockResolvedValue(unsubscribe);

      const { unmount } = renderHook(() => useAutoTranscribe(), { wrapper });

      await waitFor(() => {
        expect(tauriModule.onTranscriptionProgress).toHaveBeenCalled();
      });

      unmount();

      expect(unsubscribe).toHaveBeenCalled();
    });
  });

  describe('transcription method determination', () => {
    it('renders hook without error when whisper available', async () => {
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(true);
      vi.mocked(tauriModule.getInstalledModels).mockResolvedValue(['base']);
      vi.mocked(tauriModule.transcribeMedia).mockResolvedValue({
        segments: [{ start: 0, end: 1, text: 'Test' }],
        full_text: 'Test',
        language: 'en',
        duration: 1,
      });

      // This hook needs files in the MediaContext to process
      // For a full integration test, we would need to set up the MediaContext with pending files
      // Here we just verify the hook renders without error
      const { result } = renderHook(() => useAutoTranscribe(), { wrapper });

      // Hook should render without throwing
      expect(result.current).toBeUndefined();
    });

    it('renders hook without error when whisper not available', async () => {
      vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(false);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: true, claude: false });

      // Verify hook renders without error
      const { result } = renderHook(() => useAutoTranscribe(), { wrapper });

      expect(result.current).toBeUndefined();
    });
  });

  describe('language change detection', () => {
    it('checks for language change on mount', async () => {
      // Store a previous language that differs from default
      localStorage.setItem('clip-flow-last-transcription-language', 'en');
      localStorage.setItem(
        'clip-flow-settings',
        JSON.stringify({ transcriptionLanguage: 'ko' })
      );

      renderHook(() => useAutoTranscribe(), { wrapper });

      // The hook should detect language change and mark as used
      await waitFor(() => {
        // After language change detection, it should save the current language
        const lastLang = localStorage.getItem('clip-flow-last-transcription-language');
        expect(lastLang).toBe('ko');
      });
    });

    it('marks language as used after processing', async () => {
      renderHook(() => useAutoTranscribe(), { wrapper });

      await waitFor(() => {
        const lastLang = localStorage.getItem('clip-flow-last-transcription-language');
        expect(lastLang).toBe('auto'); // Default language
      });
    });
  });

  describe('error handling', () => {
    it('handles progress listener setup failure gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.mocked(tauriModule.onTranscriptionProgress).mockRejectedValue(
        new Error('Failed to setup listener')
      );

      // Should not throw
      expect(() => {
        renderHook(() => useAutoTranscribe(), { wrapper });
      }).not.toThrow();

      consoleSpy.mockRestore();
    });
  });
});
