import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MediaProvider, useMedia } from './MediaContext';
import {
  mockDirectoryNode,
  mockSegments,
  mockSummary,
  createNestedDirectoryNode,
} from '@/test/mocks/media-data';
import type { ReactNode } from 'react';

// Mock the @/lib/tauri module
vi.mock('@/lib/tauri', () => ({
  scanMediaDirectoryTree: vi.fn(),
  startWatchingDirectory: vi.fn(),
  stopWatchingDirectory: vi.fn(),
  onFileChange: vi.fn(() => Promise.resolve(() => {})),
}));

// Get the mocked module
import * as tauriModule from '@/lib/tauri';

// Wrapper component for testing hooks
const wrapper = ({ children }: { children: ReactNode }) => (
  <MediaProvider>{children}</MediaProvider>
);

describe('MediaContext', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    // Default mock implementations
    vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue(mockDirectoryNode);
    vi.mocked(tauriModule.startWatchingDirectory).mockResolvedValue(undefined);
    vi.mocked(tauriModule.stopWatchingDirectory).mockResolvedValue(undefined);
    vi.mocked(tauriModule.onFileChange).mockResolvedValue(() => {});
  });

  describe('MediaProvider', () => {
    it('renders children', () => {
      const { result } = renderHook(() => useMedia(), { wrapper });
      expect(result.current).toBeDefined();
    });

    it('has null rootPath and rootFolder initially', () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      expect(result.current.state.rootPath).toBeNull();
      expect(result.current.state.rootFolder).toBeNull();
    });

    it('has empty fileStatuses initially', () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      expect(result.current.state.fileStatuses).toEqual({});
    });
  });

  describe('setRootDirectory', () => {
    it('scans directory and updates state', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      expect(tauriModule.scanMediaDirectoryTree).toHaveBeenCalledWith('/test/path');
      expect(result.current.state.rootPath).toBe('/test/path');
      expect(result.current.state.rootFolder).not.toBeNull();
    });

    it('starts watching directory after scan', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      expect(tauriModule.startWatchingDirectory).toHaveBeenCalledWith('/test/path');
    });

    it('sets error on scan failure', async () => {
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockRejectedValue(
        new Error('Directory not found')
      );

      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/invalid/path');
      });

      expect(result.current.state.error).toBe('Directory not found');
      expect(result.current.state.rootPath).toBeNull();
    });

    it('saves rootPath to localStorage', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Wait for effect to run
      await waitFor(() => {
        expect(localStorage.getItem('clip-flow-media-root-path')).toBe('/test/path');
      });
    });
  });

  describe('clearRootDirectory', () => {
    it('resets state and stops watching', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      // First set a directory
      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      expect(result.current.state.rootPath).toBe('/test/path');

      // Then clear it
      await act(async () => {
        await result.current.clearRootDirectory();
      });

      expect(tauriModule.stopWatchingDirectory).toHaveBeenCalled();
      expect(result.current.state.rootPath).toBeNull();
      expect(result.current.state.rootFolder).toBeNull();
      expect(result.current.state.selectedFileId).toBeNull();
    });

    it('clears localStorage', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      await act(async () => {
        await result.current.clearRootDirectory();
      });

      expect(localStorage.getItem('clip-flow-media-root-path')).toBeNull();
    });
  });

  describe('selectFile', () => {
    it('updates selectedFileId', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      act(() => {
        result.current.selectFile('/test/path/video.mp4');
      });

      expect(result.current.state.selectedFileId).toBe('/test/path/video.mp4');
    });

    it('clears selection with null', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      act(() => {
        result.current.selectFile('/test/path/video.mp4');
      });

      act(() => {
        result.current.selectFile(null);
      });

      expect(result.current.state.selectedFileId).toBeNull();
    });
  });

  describe('toggleFolder', () => {
    it('toggles folder expansion', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      const initialExpanded = result.current.state.rootFolder?.isExpanded;

      act(() => {
        result.current.toggleFolder('/test/path');
      });

      expect(result.current.state.rootFolder?.isExpanded).toBe(!initialExpanded);
    });
  });

  describe('updateFileStatus', () => {
    it('updates file status in fileStatuses', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      act(() => {
        result.current.updateFileStatus('/test/path/video.mp4', 'transcribing', 50);
      });

      expect(result.current.state.fileStatuses['/test/path/video.mp4']).toEqual({
        status: 'transcribing',
        progress: 50,
        error: undefined,
      });
    });

    it('updates error status', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      act(() => {
        result.current.updateFileStatus('/test/path/video.mp4', 'error', 0, 'Failed');
      });

      expect(result.current.state.fileStatuses['/test/path/video.mp4']).toEqual({
        status: 'error',
        progress: 0,
        error: 'Failed',
      });
    });
  });

  describe('setTranscription', () => {
    it('stores transcription data and sets status to completed', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      const transcription = {
        segments: mockSegments,
        fullText: 'Hello world',
        language: 'en',
        duration: 15,
      };

      act(() => {
        result.current.setTranscription('/test/path/video.mp4', transcription);
      });

      expect(result.current.state.fileStatuses['/test/path/video.mp4']).toEqual({
        status: 'completed',
        progress: 100,
        transcription,
      });
    });
  });

  describe('resetAllTranscriptions', () => {
    it('resets completed files to pending', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Set some files as completed
      act(() => {
        result.current.setTranscription('/test/path/video.mp4', {
          segments: [],
          fullText: 'Test',
        });
      });

      act(() => {
        result.current.resetAllTranscriptions();
      });

      expect(result.current.state.fileStatuses['/test/path/video.mp4'].status).toBe(
        'pending'
      );
    });

    it('resets error files to pending', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      act(() => {
        result.current.updateFileStatus('/test/path/video.mp4', 'error', 0, 'Failed');
      });

      act(() => {
        result.current.resetAllTranscriptions();
      });

      expect(result.current.state.fileStatuses['/test/path/video.mp4'].status).toBe(
        'pending'
      );
    });
  });

  describe('retranscribeFile', () => {
    it('resets single file to pending', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      act(() => {
        result.current.setTranscription('/test/path/video.mp4', {
          segments: [],
          fullText: 'Test',
        });
      });

      act(() => {
        result.current.retranscribeFile('/test/path/video.mp4');
      });

      expect(result.current.state.fileStatuses['/test/path/video.mp4'].status).toBe(
        'pending'
      );
      expect(result.current.state.fileStatuses['/test/path/video.mp4'].progress).toBe(0);
    });
  });

  describe('retranscribeAllFiles', () => {
    it('resets all files to pending', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Set some files as completed
      act(() => {
        result.current.setTranscription('/test/path/video.mp4', {
          segments: [],
          fullText: 'Test video',
        });
        result.current.setTranscription('/test/path/audio.mp3', {
          segments: [],
          fullText: 'Test audio',
        });
      });

      // Verify files are completed
      expect(result.current.state.fileStatuses['/test/path/video.mp4'].status).toBe(
        'completed'
      );
      expect(result.current.state.fileStatuses['/test/path/audio.mp3'].status).toBe(
        'completed'
      );

      // Retranscribe all files
      act(() => {
        result.current.retranscribeAllFiles();
      });

      // Verify all files are pending
      expect(result.current.state.fileStatuses['/test/path/video.mp4'].status).toBe(
        'pending'
      );
      expect(result.current.state.fileStatuses['/test/path/video.mp4'].progress).toBe(0);
      expect(result.current.state.fileStatuses['/test/path/audio.mp3'].status).toBe(
        'pending'
      );
      expect(result.current.state.fileStatuses['/test/path/audio.mp3'].progress).toBe(0);
    });

    it('does nothing when no folder is set', () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      // Should not throw when called without a folder
      act(() => {
        result.current.retranscribeAllFiles();
      });

      expect(result.current.state.fileStatuses).toEqual({});
    });
  });

  describe('getSelectedFile', () => {
    it('returns null when no file is selected', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      expect(result.current.getSelectedFile()).toBeNull();
    });

    it('returns file with merged status', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      act(() => {
        result.current.selectFile('/test/path/video.mp4');
        result.current.updateFileStatus('/test/path/video.mp4', 'transcribing', 50);
      });

      const selectedFile = result.current.getSelectedFile();

      expect(selectedFile?.path).toBe('/test/path/video.mp4');
      expect(selectedFile?.status).toBe('transcribing');
      expect(selectedFile?.progress).toBe(50);
    });
  });

  describe('getAllFiles', () => {
    it('returns empty array when no folder', () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      expect(result.current.getAllFiles()).toEqual([]);
    });

    it('returns all files with merged statuses', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      const files = result.current.getAllFiles();

      expect(files.length).toBe(2); // video.mp4 and audio.mp3 from mockDirectoryNode
      expect(files[0].status).toBe('pending');
    });
  });

  describe('useMedia hook', () => {
    it('throws error when used outside MediaProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useMedia());
      }).toThrow('useMedia must be used within a MediaProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('deeply nested directory handling (5+ levels)', () => {
    beforeEach(() => {
      // Use 5-level deep nested structure (6 files total: root + 5 levels)
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue(
        createNestedDirectoryNode(5)
      );
    });

    it('handles 5+ level nested directory structure', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/root');
      });

      expect(result.current.state.rootPath).toBe('/test/root');
      expect(result.current.state.rootFolder).not.toBeNull();

      // Should have 6 files (one at each level: root, level1, level2, level3, level4, level5)
      const allFiles = result.current.getAllFiles();
      expect(allFiles.length).toBe(6);
    });

    it('finds file at deepest level (depth 5)', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/root');
      });

      // Select deepest file
      act(() => {
        result.current.selectFile(
          '/test/root/level1/level2/level3/level4/level5/file-level5.flac'
        );
      });

      const selected = result.current.getSelectedFile();
      expect(selected).not.toBeNull();
      expect(selected?.name).toBe('file-level5.flac');
      expect(selected?.path).toBe(
        '/test/root/level1/level2/level3/level4/level5/file-level5.flac'
      );
    });

    it('toggles folder at depth 3', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/root');
      });

      // Find initial state of level3 folder
      const findFolder = (
        folder: typeof result.current.state.rootFolder,
        path: string
      ): typeof result.current.state.rootFolder => {
        if (!folder) return null;
        if (folder.path === path) return folder;
        for (const sub of folder.subfolders) {
          const found = findFolder(sub, path);
          if (found) return found;
        }
        return null;
      };

      const level3Path = '/test/root/level1/level2/level3';
      const level3Before = findFolder(result.current.state.rootFolder, level3Path);
      expect(level3Before).not.toBeNull();
      const initialExpanded = level3Before?.isExpanded;

      // Toggle level3 folder
      act(() => {
        result.current.toggleFolder(level3Path);
      });

      const level3After = findFolder(result.current.state.rootFolder, level3Path);
      expect(level3After?.isExpanded).toBe(!initialExpanded);
    });

    it('updates file status at deepest level', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/root');
      });

      const deepFilePath =
        '/test/root/level1/level2/level3/level4/level5/file-level5.flac';

      act(() => {
        result.current.updateFileStatus(deepFilePath, 'transcribing', 50);
      });

      expect(result.current.state.fileStatuses[deepFilePath]).toEqual({
        status: 'transcribing',
        progress: 50,
        error: undefined,
      });

      // Verify through getAllFiles as well
      const allFiles = result.current.getAllFiles();
      const deepFile = allFiles.find((f) => f.path === deepFilePath);
      expect(deepFile?.status).toBe('transcribing');
      expect(deepFile?.progress).toBe(50);
    });

    it('getAllFiles returns all files from all depths', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/root');
      });

      const allFiles = result.current.getAllFiles();

      // Verify files from each level exist
      expect(allFiles.some((f) => f.name === 'file-root.mp4')).toBe(true);
      expect(allFiles.some((f) => f.name === 'file-level1.mp3')).toBe(true);
      expect(allFiles.some((f) => f.name === 'file-level2.mkv')).toBe(true);
      expect(allFiles.some((f) => f.name === 'file-level3.wav')).toBe(true);
      expect(allFiles.some((f) => f.name === 'file-level4.mov')).toBe(true);
      expect(allFiles.some((f) => f.name === 'file-level5.flac')).toBe(true);
    });

    it('handles 7-level nested structure', async () => {
      // Test even deeper nesting (7 levels = 8 files)
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue(
        createNestedDirectoryNode(7)
      );

      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/root');
      });

      const allFiles = result.current.getAllFiles();
      expect(allFiles.length).toBe(8);
    });
  });

  describe('Summary actions', () => {
    describe('setSummary', () => {
      it('should store summary for a file', async () => {
        const { result } = renderHook(() => useMedia(), { wrapper });

        await act(async () => {
          await result.current.setRootDirectory('/test/path');
        });

        // First complete transcription
        act(() => {
          result.current.setTranscription('/test/path/video.mp4', {
            segments: mockSegments,
            fullText: 'Test transcription',
          });
        });

        // Then set summary
        act(() => {
          result.current.setSummary('/test/path/video.mp4', mockSummary);
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summary).toEqual(mockSummary);
        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryStatus).toBe('completed');
      });

      it('should clear summaryError when setting summary', async () => {
        const { result } = renderHook(() => useMedia(), { wrapper });

        await act(async () => {
          await result.current.setRootDirectory('/test/path');
        });

        // Set error first
        act(() => {
          result.current.updateSummaryStatus('/test/path/video.mp4', 'error', 'Failed to summarize');
        });

        // Then set summary (should clear error)
        act(() => {
          result.current.setSummary('/test/path/video.mp4', mockSummary);
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryError).toBeUndefined();
      });
    });

    describe('updateSummaryStatus', () => {
      it('should update summary status to summarizing', async () => {
        const { result } = renderHook(() => useMedia(), { wrapper });

        await act(async () => {
          await result.current.setRootDirectory('/test/path');
        });

        act(() => {
          result.current.updateSummaryStatus('/test/path/video.mp4', 'summarizing');
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryStatus).toBe('summarizing');
      });

      it('should update summary status to error with error message', async () => {
        const { result } = renderHook(() => useMedia(), { wrapper });

        await act(async () => {
          await result.current.setRootDirectory('/test/path');
        });

        act(() => {
          result.current.updateSummaryStatus('/test/path/video.mp4', 'error', 'LLM service unavailable');
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryStatus).toBe('error');
        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryError).toBe('LLM service unavailable');
      });

      it('should update summary status to pending', async () => {
        const { result } = renderHook(() => useMedia(), { wrapper });

        await act(async () => {
          await result.current.setRootDirectory('/test/path');
        });

        act(() => {
          result.current.updateSummaryStatus('/test/path/video.mp4', 'pending');
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryStatus).toBe('pending');
      });
    });

    describe('clearSummary', () => {
      it('should remove summary from a file', async () => {
        const { result } = renderHook(() => useMedia(), { wrapper });

        await act(async () => {
          await result.current.setRootDirectory('/test/path');
        });

        // Set summary first
        act(() => {
          result.current.setSummary('/test/path/video.mp4', mockSummary);
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summary).toBeDefined();

        // Clear summary
        act(() => {
          result.current.clearSummary('/test/path/video.mp4');
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summary).toBeUndefined();
        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryStatus).toBeUndefined();
        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryError).toBeUndefined();
      });
    });

    describe('resummarizeFile', () => {
      it('should reset summary status to pending and clear existing summary', async () => {
        const { result } = renderHook(() => useMedia(), { wrapper });

        await act(async () => {
          await result.current.setRootDirectory('/test/path');
        });

        // Set completed summary
        act(() => {
          result.current.setSummary('/test/path/video.mp4', mockSummary);
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryStatus).toBe('completed');

        // Resummarize
        act(() => {
          result.current.resummarizeFile('/test/path/video.mp4');
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryStatus).toBe('pending');
        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summary).toBeUndefined();
      });

      it('should clear error when resummarizing', async () => {
        const { result } = renderHook(() => useMedia(), { wrapper });

        await act(async () => {
          await result.current.setRootDirectory('/test/path');
        });

        // Set error status
        act(() => {
          result.current.updateSummaryStatus('/test/path/video.mp4', 'error', 'Failed');
        });

        // Resummarize
        act(() => {
          result.current.resummarizeFile('/test/path/video.mp4');
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryStatus).toBe('pending');
        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryError).toBeUndefined();
      });
    });

    describe('resetAllTranscriptions should also clear summaries', () => {
      it('should clear summaries when resetting transcriptions', async () => {
        const { result } = renderHook(() => useMedia(), { wrapper });

        await act(async () => {
          await result.current.setRootDirectory('/test/path');
        });

        // Set transcription and summary
        act(() => {
          result.current.setTranscription('/test/path/video.mp4', {
            segments: mockSegments,
            fullText: 'Test',
          });
          result.current.setSummary('/test/path/video.mp4', mockSummary);
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summary).toBeDefined();

        // Reset all transcriptions
        act(() => {
          result.current.resetAllTranscriptions();
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].status).toBe('pending');
        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summary).toBeUndefined();
        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryStatus).toBeUndefined();
      });
    });

    describe('retranscribeFile should also clear summary', () => {
      it('should clear summary when retranscribing a file', async () => {
        const { result } = renderHook(() => useMedia(), { wrapper });

        await act(async () => {
          await result.current.setRootDirectory('/test/path');
        });

        // Set transcription and summary
        act(() => {
          result.current.setTranscription('/test/path/video.mp4', {
            segments: mockSegments,
            fullText: 'Test',
          });
          result.current.setSummary('/test/path/video.mp4', mockSummary);
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summary).toBeDefined();

        // Retranscribe
        act(() => {
          result.current.retranscribeFile('/test/path/video.mp4');
        });

        expect(result.current.state.fileStatuses['/test/path/video.mp4'].status).toBe('pending');
        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summary).toBeUndefined();
        expect(result.current.state.fileStatuses['/test/path/video.mp4'].summaryStatus).toBeUndefined();
      });
    });

    describe('getSelectedFile with summary', () => {
      it('should return file with summary data merged', async () => {
        const { result } = renderHook(() => useMedia(), { wrapper });

        await act(async () => {
          await result.current.setRootDirectory('/test/path');
        });

        // Set transcription and summary
        act(() => {
          result.current.selectFile('/test/path/video.mp4');
          result.current.setTranscription('/test/path/video.mp4', {
            segments: mockSegments,
            fullText: 'Test',
          });
          result.current.setSummary('/test/path/video.mp4', mockSummary);
        });

        const selectedFile = result.current.getSelectedFile();

        expect(selectedFile?.summary).toEqual(mockSummary);
        expect(selectedFile?.summaryStatus).toBe('completed');
      });
    });
  });
});
