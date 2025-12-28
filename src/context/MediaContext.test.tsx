import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MediaProvider, useMedia } from './MediaContext';
import { mockDirectoryNode, mockSegments } from '@/test/mocks/media-data';
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
});
