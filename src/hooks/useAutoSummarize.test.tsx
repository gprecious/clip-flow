import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useAutoSummarize } from './useAutoSummarize';
import type { ReactNode } from 'react';
import { MediaProvider, useMedia } from '@/context/MediaContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { QueueProvider } from '@/context/QueueContext';
import { mockSegments, mockSummary } from '@/test/mocks/media-data';

// Mock the tauri module
vi.mock('@/lib/tauri', () => ({
  summarizeText: vi.fn(),
  openaiSummarize: vi.fn(),
  claudeSummarize: vi.fn(),
  checkOllama: vi.fn(),
  getApiKeyStatus: vi.fn(),
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
    <MediaProvider>
      <QueueProvider>{children}</QueueProvider>
    </MediaProvider>
  </SettingsProvider>
);

describe('useAutoSummarize', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    // Reset all mocks
    vi.mocked(tauriModule.checkOllama).mockResolvedValue(true);
    vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });
    vi.mocked(tauriModule.summarizeText).mockResolvedValue('This is a test summary.');
    vi.mocked(tauriModule.openaiSummarize).mockResolvedValue('OpenAI summary.');
    vi.mocked(tauriModule.claudeSummarize).mockResolvedValue('Claude summary.');
    vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
      path: '/test',
      name: 'test',
      is_dir: true,
      size: 0,
      modified: Date.now(),
      extension: null,
      children: [
        {
          path: '/test/video.mp4',
          name: 'video.mp4',
          is_dir: false,
          size: 1024,
          modified: Date.now(),
          extension: 'mp4',
          children: [],
        },
      ],
    });
    vi.mocked(tauriModule.startWatchingDirectory).mockResolvedValue(undefined);
    vi.mocked(tauriModule.stopWatchingDirectory).mockResolvedValue(undefined);
    vi.mocked(tauriModule.onFileChange).mockResolvedValue(() => {});
  });

  describe('initialization', () => {
    it('should render hook without error', async () => {
      const { result } = renderHook(() => useAutoSummarize(), { wrapper });
      expect(result.current).toBeUndefined();
    });
  });

  describe('auto-summarization trigger', () => {
    it('should not summarize files without completed transcription', async () => {
      // Just verify the hook doesn't call summarize when there's no completed transcription
      renderHook(() => useAutoSummarize(), { wrapper });

      await waitFor(() => {
        expect(tauriModule.summarizeText).not.toHaveBeenCalled();
        expect(tauriModule.openaiSummarize).not.toHaveBeenCalled();
        expect(tauriModule.claudeSummarize).not.toHaveBeenCalled();
      });
    });

    it('should auto-summarize when transcription completes', async () => {
      // Set up LLM provider as ollama
      localStorage.setItem(
        'clip-flow-settings',
        JSON.stringify({
          llmProvider: 'ollama',
          ollamaModel: 'llama3.2',
          transcriptionLanguage: 'en',
        })
      );

      vi.mocked(tauriModule.checkOllama).mockResolvedValue(true);
      vi.mocked(tauriModule.summarizeText).mockResolvedValue('Summarized content');

      // Create a wrapper that will set up the context state properly
      let mediaContext: ReturnType<typeof useMedia> | null = null;
      const TestWrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider>
          <MediaProvider>
            <QueueProvider>
              <ContextCapture onCapture={(ctx) => (mediaContext = ctx)} />
              {children}
            </QueueProvider>
          </MediaProvider>
        </SettingsProvider>
      );

      function ContextCapture({
        onCapture,
      }: {
        onCapture: (ctx: ReturnType<typeof useMedia>) => void;
      }) {
        const ctx = useMedia();
        onCapture(ctx);
        return null;
      }

      renderHook(() => useAutoSummarize(), { wrapper: TestWrapper });

      // Set up a directory and wait for scan
      await act(async () => {
        await mediaContext!.setRootDirectory('/test');
      });

      // Wait for directory to be scanned
      await waitFor(() => {
        expect(tauriModule.scanMediaDirectoryTree).toHaveBeenCalledWith('/test');
      });

      // Now set a completed transcription on the file
      await act(async () => {
        mediaContext!.setTranscription('/test/video.mp4', {
          segments: mockSegments,
          fullText: 'Test transcription text',
          language: 'en',
        });
      });

      // Wait for summarization to be triggered
      await waitFor(
        () => {
          expect(tauriModule.summarizeText).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );
    });
  });

  describe('LLM provider selection', () => {
    it('should use Ollama when llmProvider is ollama', async () => {
      localStorage.setItem(
        'clip-flow-settings',
        JSON.stringify({
          llmProvider: 'ollama',
          ollamaModel: 'llama3.2',
          transcriptionLanguage: 'en',
        })
      );

      vi.mocked(tauriModule.checkOllama).mockResolvedValue(true);

      let mediaContext: ReturnType<typeof useMedia> | null = null;
      const TestWrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider>
          <MediaProvider>
            <QueueProvider>
              <ContextCapture onCapture={(ctx) => (mediaContext = ctx)} />
              {children}
            </QueueProvider>
          </MediaProvider>
        </SettingsProvider>
      );

      function ContextCapture({
        onCapture,
      }: {
        onCapture: (ctx: ReturnType<typeof useMedia>) => void;
      }) {
        const ctx = useMedia();
        onCapture(ctx);
        return null;
      }

      renderHook(() => useAutoSummarize(), { wrapper: TestWrapper });

      await act(async () => {
        await mediaContext!.setRootDirectory('/test');
      });

      await waitFor(() => {
        expect(tauriModule.scanMediaDirectoryTree).toHaveBeenCalled();
      });

      await act(async () => {
        mediaContext!.setTranscription('/test/video.mp4', {
          segments: mockSegments,
          fullText: 'Test transcription',
          language: 'en',
        });
      });

      await waitFor(
        () => {
          expect(tauriModule.summarizeText).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      expect(tauriModule.openaiSummarize).not.toHaveBeenCalled();
      expect(tauriModule.claudeSummarize).not.toHaveBeenCalled();
    });

    it('should use OpenAI when llmProvider is openai', async () => {
      localStorage.setItem(
        'clip-flow-settings',
        JSON.stringify({
          llmProvider: 'openai',
          openaiModel: 'gpt-4o-mini',
          transcriptionLanguage: 'en',
        })
      );

      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: true, claude: false });

      let mediaContext: ReturnType<typeof useMedia> | null = null;
      const TestWrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider>
          <MediaProvider>
            <QueueProvider>
              <ContextCapture onCapture={(ctx) => (mediaContext = ctx)} />
              {children}
            </QueueProvider>
          </MediaProvider>
        </SettingsProvider>
      );

      function ContextCapture({
        onCapture,
      }: {
        onCapture: (ctx: ReturnType<typeof useMedia>) => void;
      }) {
        const ctx = useMedia();
        onCapture(ctx);
        return null;
      }

      renderHook(() => useAutoSummarize(), { wrapper: TestWrapper });

      await act(async () => {
        await mediaContext!.setRootDirectory('/test');
      });

      await waitFor(() => {
        expect(tauriModule.scanMediaDirectoryTree).toHaveBeenCalled();
      });

      await act(async () => {
        mediaContext!.setTranscription('/test/video.mp4', {
          segments: mockSegments,
          fullText: 'Test transcription',
          language: 'en',
        });
      });

      await waitFor(
        () => {
          expect(tauriModule.openaiSummarize).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      expect(tauriModule.summarizeText).not.toHaveBeenCalled();
      expect(tauriModule.claudeSummarize).not.toHaveBeenCalled();
    });

    it('should use Claude when llmProvider is claude', async () => {
      localStorage.setItem(
        'clip-flow-settings',
        JSON.stringify({
          llmProvider: 'claude',
          claudeModel: 'claude-3-haiku-20240307',
          transcriptionLanguage: 'en',
        })
      );

      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: true });

      let mediaContext: ReturnType<typeof useMedia> | null = null;
      const TestWrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider>
          <MediaProvider>
            <QueueProvider>
              <ContextCapture onCapture={(ctx) => (mediaContext = ctx)} />
              {children}
            </QueueProvider>
          </MediaProvider>
        </SettingsProvider>
      );

      function ContextCapture({
        onCapture,
      }: {
        onCapture: (ctx: ReturnType<typeof useMedia>) => void;
      }) {
        const ctx = useMedia();
        onCapture(ctx);
        return null;
      }

      renderHook(() => useAutoSummarize(), { wrapper: TestWrapper });

      await act(async () => {
        await mediaContext!.setRootDirectory('/test');
      });

      await waitFor(() => {
        expect(tauriModule.scanMediaDirectoryTree).toHaveBeenCalled();
      });

      await act(async () => {
        mediaContext!.setTranscription('/test/video.mp4', {
          segments: mockSegments,
          fullText: 'Test transcription',
          language: 'en',
        });
      });

      await waitFor(
        () => {
          expect(tauriModule.claudeSummarize).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      expect(tauriModule.summarizeText).not.toHaveBeenCalled();
      expect(tauriModule.openaiSummarize).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('should handle summarization errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      localStorage.setItem(
        'clip-flow-settings',
        JSON.stringify({
          llmProvider: 'ollama',
          ollamaModel: 'llama3.2',
          transcriptionLanguage: 'en',
        })
      );

      vi.mocked(tauriModule.checkOllama).mockResolvedValue(true);
      vi.mocked(tauriModule.summarizeText).mockRejectedValue(new Error('LLM service unavailable'));

      let mediaContext: ReturnType<typeof useMedia> | null = null;
      const TestWrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider>
          <MediaProvider>
            <QueueProvider>
              <ContextCapture onCapture={(ctx) => (mediaContext = ctx)} />
              {children}
            </QueueProvider>
          </MediaProvider>
        </SettingsProvider>
      );

      function ContextCapture({
        onCapture,
      }: {
        onCapture: (ctx: ReturnType<typeof useMedia>) => void;
      }) {
        const ctx = useMedia();
        onCapture(ctx);
        return null;
      }

      renderHook(() => useAutoSummarize(), { wrapper: TestWrapper });

      await act(async () => {
        await mediaContext!.setRootDirectory('/test');
      });

      await waitFor(() => {
        expect(tauriModule.scanMediaDirectoryTree).toHaveBeenCalled();
      });

      await act(async () => {
        mediaContext!.setTranscription('/test/video.mp4', {
          segments: mockSegments,
          fullText: 'Test transcription',
          language: 'en',
        });
      });

      await waitFor(
        () => {
          expect(tauriModule.summarizeText).toHaveBeenCalled();
        },
        { timeout: 3000 }
      );

      // Error should be logged
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });

    it('should handle Ollama not running error', async () => {
      localStorage.setItem(
        'clip-flow-settings',
        JSON.stringify({
          llmProvider: 'ollama',
          ollamaModel: 'llama3.2',
          transcriptionLanguage: 'en',
        })
      );

      vi.mocked(tauriModule.checkOllama).mockResolvedValue(false);

      let mediaContext: ReturnType<typeof useMedia> | null = null;
      const TestWrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider>
          <MediaProvider>
            <QueueProvider>
              <ContextCapture onCapture={(ctx) => (mediaContext = ctx)} />
              {children}
            </QueueProvider>
          </MediaProvider>
        </SettingsProvider>
      );

      function ContextCapture({
        onCapture,
      }: {
        onCapture: (ctx: ReturnType<typeof useMedia>) => void;
      }) {
        const ctx = useMedia();
        onCapture(ctx);
        return null;
      }

      renderHook(() => useAutoSummarize(), { wrapper: TestWrapper });

      await act(async () => {
        await mediaContext!.setRootDirectory('/test');
      });

      await waitFor(() => {
        expect(tauriModule.scanMediaDirectoryTree).toHaveBeenCalled();
      });

      await act(async () => {
        mediaContext!.setTranscription('/test/video.mp4', {
          segments: mockSegments,
          fullText: 'Test transcription',
          language: 'en',
        });
      });

      // Wait for the hook to process the file and set error status
      await waitFor(
        () => {
          const file = mediaContext!.getAllFiles().find(f => f.path === '/test/video.mp4');
          expect(file?.summaryStatus).toBe('error');
        },
        { timeout: 3000 }
      );

      // Verify summarizeText was NOT called when Ollama is not running
      expect(tauriModule.summarizeText).not.toHaveBeenCalled();
    }, 10000);
  });

  describe('skip already processing files', () => {
    it('should skip files already being summarized', async () => {
      localStorage.setItem(
        'clip-flow-settings',
        JSON.stringify({
          llmProvider: 'ollama',
          ollamaModel: 'llama3.2',
          transcriptionLanguage: 'en',
        })
      );

      let mediaContext: ReturnType<typeof useMedia> | null = null;
      const TestWrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider>
          <MediaProvider>
            <QueueProvider>
              <ContextCapture onCapture={(ctx) => (mediaContext = ctx)} />
              {children}
            </QueueProvider>
          </MediaProvider>
        </SettingsProvider>
      );

      function ContextCapture({
        onCapture,
      }: {
        onCapture: (ctx: ReturnType<typeof useMedia>) => void;
      }) {
        const ctx = useMedia();
        onCapture(ctx);
        return null;
      }

      renderHook(() => useAutoSummarize(), { wrapper: TestWrapper });

      await act(async () => {
        await mediaContext!.setRootDirectory('/test');
      });

      await waitFor(() => {
        expect(tauriModule.scanMediaDirectoryTree).toHaveBeenCalled();
      });

      // Set summary status to 'summarizing' BEFORE setting transcription
      // to prevent the hook from processing it
      await act(async () => {
        mediaContext!.updateSummaryStatus('/test/video.mp4', 'summarizing');
      });

      // Now set transcription
      await act(async () => {
        mediaContext!.setTranscription('/test/video.mp4', {
          segments: mockSegments,
          fullText: 'Test transcription',
          language: 'en',
        });
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // summarizeText should not have been called because the file is already being summarized
      expect(tauriModule.summarizeText).not.toHaveBeenCalled();
    });

    it('should skip files with completed summary', async () => {
      localStorage.setItem(
        'clip-flow-settings',
        JSON.stringify({
          llmProvider: 'ollama',
          ollamaModel: 'llama3.2',
          transcriptionLanguage: 'en',
        })
      );

      let mediaContext: ReturnType<typeof useMedia> | null = null;
      const TestWrapper = ({ children }: { children: ReactNode }) => (
        <SettingsProvider>
          <MediaProvider>
            <QueueProvider>
              <ContextCapture onCapture={(ctx) => (mediaContext = ctx)} />
              {children}
            </QueueProvider>
          </MediaProvider>
        </SettingsProvider>
      );

      function ContextCapture({
        onCapture,
      }: {
        onCapture: (ctx: ReturnType<typeof useMedia>) => void;
      }) {
        const ctx = useMedia();
        onCapture(ctx);
        return null;
      }

      renderHook(() => useAutoSummarize(), { wrapper: TestWrapper });

      await act(async () => {
        await mediaContext!.setRootDirectory('/test');
      });

      await waitFor(() => {
        expect(tauriModule.scanMediaDirectoryTree).toHaveBeenCalled();
      });

      // Set an existing summary BEFORE setting transcription
      // to prevent the hook from processing it
      await act(async () => {
        mediaContext!.setSummary('/test/video.mp4', mockSummary);
      });

      // Now set transcription
      await act(async () => {
        mediaContext!.setTranscription('/test/video.mp4', {
          segments: mockSegments,
          fullText: 'Test transcription',
          language: 'en',
        });
      });

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 500));

      // summarizeText should not have been called because the file already has a summary
      expect(tauriModule.summarizeText).not.toHaveBeenCalled();
    });
  });
});
