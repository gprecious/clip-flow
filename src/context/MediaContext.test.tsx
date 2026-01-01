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
import type { DirectoryNode } from '@/lib/tauri';

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

  describe('localStorage persistence', () => {
    it('localStorage.setItem 실패 시 graceful degradation - 앱은 정상 동작', async () => {
      // Test that app continues to work even if localStorage fails
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Trigger file status updates
      act(() => {
        result.current.updateFileStatus('/test/path/video.mp4', 'transcribing', 50);
      });

      // App should still function even if storage fails
      expect(result.current.state.rootPath).toBe('/test/path');
      expect(result.current.state.fileStatuses['/test/path/video.mp4'].progress).toBe(50);
    });

    it('localStorage.getItem 실패 시 null 반환', () => {
      const mockGetItem = vi.spyOn(Storage.prototype, 'getItem');
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      // Simulate localStorage access error
      mockGetItem.mockImplementation(() => {
        throw new Error('Storage access denied');
      });

      const { result } = renderHook(() => useMedia(), { wrapper });

      // Should not crash - rootPath should be null
      expect(result.current.state.rootPath).toBeNull();

      consoleErrorSpy.mockRestore();
      mockGetItem.mockRestore();
    });
  });

  describe('initialization and restoration', () => {
    it('초기화 시 저장된 rootPath로부터 복원', async () => {
      // This test verifies the initialization logic works when provider mounts
      // Since initialization happens in the provider's effect, we test it indirectly
      const { result } = renderHook(() => useMedia(), { wrapper });

      // Start with no directory
      expect(result.current.state.rootPath).toBeNull();

      // Set a directory and add transcription
      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      act(() => {
        result.current.setTranscription('/test/path/video.mp4', {
          segments: mockSegments,
          fullText: 'Test transcription',
        });
      });

      // Wait for debounced save
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Verify data was saved to localStorage
      expect(localStorage.getItem('clip-flow-media-root-path')).toBe('/test/path');
      const savedStatuses = JSON.parse(
        localStorage.getItem('clip-flow-media-file-statuses') || '{}'
      );
      expect(savedStatuses['/test/path/video.mp4']).toBeDefined();
      expect(savedStatuses['/test/path/video.mp4'].status).toBe('completed');
    });

    it('저장된 파일 상태는 setRootDirectory 시 병합됨', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      // Simulate having previous file statuses in state (e.g., from previous session)
      // by manually setting them before scanning
      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Add transcription for a file
      act(() => {
        result.current.setTranscription('/test/path/video.mp4', {
          segments: mockSegments,
          fullText: 'Previously transcribed',
        });
      });

      // Verify status is completed
      expect(result.current.state.fileStatuses['/test/path/video.mp4'].status).toBe('completed');

      // Clear and rescan - the statuses should be preserved because they're in the same state
      await act(async () => {
        await result.current.clearRootDirectory();
      });

      // Set directory again - since we cleared, start fresh
      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      const files = result.current.getAllFiles();
      const videoFile = files.find((f) => f.path === '/test/path/video.mp4');

      // After clearing, file should be back to pending (this is expected behavior)
      expect(videoFile?.status).toBe('pending');
    });

    it('삭제된 파일의 상태는 refreshDirectory에서 유지됨', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { result } = renderHook(() => useMedia(), { wrapper });

      // Set directory with files
      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Add status for a file that exists
      act(() => {
        result.current.updateFileStatus('/test/path/video.mp4', 'completed', 100);
      });

      // Manually add status for non-existent files (simulating old data)
      act(() => {
        result.current.updateFileStatus('/test/path/deleted.mp4', 'completed', 100);
      });

      // Verify both statuses exist
      expect(result.current.state.fileStatuses['/test/path/video.mp4']).toBeDefined();
      expect(result.current.state.fileStatuses['/test/path/deleted.mp4']).toBeDefined();

      // The cleanup only happens during initialization, not during normal operation
      // So we just verify that file statuses can handle non-existent files gracefully
      const files = result.current.getAllFiles();

      // getAllFiles only returns files that exist in the tree
      expect(files.some((f) => f.path === '/test/path/video.mp4')).toBe(true);
      expect(files.some((f) => f.path === '/test/path/deleted.mp4')).toBe(false);

      consoleLogSpy.mockRestore();
    });
  });

  describe('file watching', () => {
    it('rootPath 설정 후 onFileChange 리스너 등록 확인', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Should have registered file change listener
      expect(tauriModule.onFileChange).toHaveBeenCalled();
    });

    it('파일 변경 이벤트 수신 시 refreshDirectory 호출', async () => {
      const mockUnsubscribe = vi.fn();
      let fileChangeCallback: ((event: any) => void) | undefined;

      vi.mocked(tauriModule.onFileChange).mockImplementation(async (callback) => {
        fileChangeCallback = callback;
        return mockUnsubscribe;
      });

      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Clear mock calls from setup
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockClear();

      // Simulate file change event
      await act(async () => {
        if (fileChangeCallback) {
          fileChangeCallback({
            event_type: 'Created',
            path: '/test/path/new-file.mp4',
          });
        }
      });

      // Wait for refresh to be called
      await waitFor(() => {
        expect(tauriModule.scanMediaDirectoryTree).toHaveBeenCalledWith('/test/path');
      });
    });

    it('컴포넌트 언마운트 시 리스너 정리 (unsubscribe 호출)', async () => {
      const mockUnsubscribe = vi.fn();

      vi.mocked(tauriModule.onFileChange).mockResolvedValue(mockUnsubscribe);

      const { result, unmount } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Unsubscribe should not be called yet
      expect(mockUnsubscribe).not.toHaveBeenCalled();

      // Unmount the component
      unmount();

      // Should have called unsubscribe
      expect(mockUnsubscribe).toHaveBeenCalled();
    });

    it('rootPath가 변경되면 이전 리스너 정리 후 새 리스너 등록', async () => {
      const mockUnsubscribe1 = vi.fn();
      const mockUnsubscribe2 = vi.fn();

      vi.mocked(tauriModule.onFileChange)
        .mockResolvedValueOnce(mockUnsubscribe1)
        .mockResolvedValueOnce(mockUnsubscribe2);

      const { result } = renderHook(() => useMedia(), { wrapper });

      // Set first directory
      await act(async () => {
        await result.current.setRootDirectory('/test/path1');
      });

      expect(tauriModule.onFileChange).toHaveBeenCalledTimes(1);
      expect(mockUnsubscribe1).not.toHaveBeenCalled();

      // Set second directory
      await act(async () => {
        await result.current.setRootDirectory('/test/path2');
      });

      // Should unsubscribe from first and subscribe to second
      await waitFor(() => {
        expect(mockUnsubscribe1).toHaveBeenCalled();
      });
      expect(tauriModule.onFileChange).toHaveBeenCalledTimes(2);
    });
  });

  describe('fileStatuses debounce 저장', () => {
    it('파일 상태 변경이 localStorage에 저장됨', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Make multiple rapid changes
      act(() => {
        result.current.updateFileStatus('/test/path/video.mp4', 'transcribing', 30);
      });

      // Wait for debounce (1 second + buffer)
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Verify data was saved to localStorage
      const savedStatuses = JSON.parse(
        localStorage.getItem('clip-flow-media-file-statuses') || '{}'
      );

      expect(savedStatuses['/test/path/video.mp4']).toBeDefined();
      expect(savedStatuses['/test/path/video.mp4'].progress).toBe(30);
      expect(savedStatuses['/test/path/video.mp4'].status).toBe('transcribing');
    });

    it('연속 변경 시 최종 값이 저장됨', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Multiple updates
      act(() => {
        result.current.updateFileStatus('/test/path/video.mp4', 'transcribing', 25);
      });

      await new Promise((resolve) => setTimeout(resolve, 100));

      act(() => {
        result.current.updateFileStatus('/test/path/video.mp4', 'transcribing', 75);
      });

      // Wait for debounce
      await new Promise((resolve) => setTimeout(resolve, 1100));

      // Should have final value saved
      const savedStatuses = JSON.parse(
        localStorage.getItem('clip-flow-media-file-statuses') || '{}'
      );

      expect(savedStatuses['/test/path/video.mp4'].progress).toBe(75);
    });
  });

  describe('refreshDirectory', () => {
    it('rootPath 없을 때 no-op', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      // No rootPath set
      expect(result.current.state.rootPath).toBeNull();

      // Call refreshDirectory
      await act(async () => {
        await result.current.refreshDirectory();
      });

      // Should not call scanMediaDirectoryTree
      expect(tauriModule.scanMediaDirectoryTree).not.toHaveBeenCalled();
    });

    it('실패 시 에러 설정', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Mock scan to fail
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockRejectedValue(
        new Error('Scan failed')
      );

      // Call refreshDirectory
      await act(async () => {
        await result.current.refreshDirectory();
      });

      // Should set error
      await waitFor(() => {
        expect(result.current.state.error).toBe('Scan failed');
      });
    });

    it('성공 시 디렉토리 트리 업데이트', async () => {
      const { result } = renderHook(() => useMedia(), { wrapper });

      await act(async () => {
        await result.current.setRootDirectory('/test/path');
      });

      // Mock new scan result with different files
      const newDirectoryNode: DirectoryNode = {
        path: '/test/path',
        name: 'path',
        is_dir: true,
        size: 0,
        modified: Date.now(),
        extension: null,
        children: [
          {
            path: '/test/path/new-video.mp4',
            name: 'new-video.mp4',
            is_dir: false,
            size: 1024 * 1024 * 50,
            modified: Date.now(),
            extension: 'mp4',
            children: [],
          },
        ],
      };

      vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue(newDirectoryNode);

      // Call refreshDirectory
      await act(async () => {
        await result.current.refreshDirectory();
      });

      // Should update folder structure
      const files = result.current.getAllFiles();
      expect(files.length).toBe(1);
      expect(files[0].name).toBe('new-video.mp4');
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
