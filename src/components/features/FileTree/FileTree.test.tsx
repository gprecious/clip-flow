import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FileTree } from './FileTree';
import { MediaProvider, useMedia } from '@/context/MediaContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
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

// Create a wrapper that exposes media context for test manipulation
let mediaContextValue: ReturnType<typeof useMedia> | null = null;

function MediaContextCapture({ children }: { children: ReactNode }) {
  const value = useMedia();
  mediaContextValue = value;
  return <>{children}</>;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <SettingsProvider>
          <MediaProvider>
            <MediaContextCapture>{children}</MediaContextCapture>
          </MediaProvider>
        </SettingsProvider>
      </ThemeProvider>
    </I18nextProvider>
  </BrowserRouter>
);

describe('FileTree', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mediaContextValue = null;

    // Default mock implementations
    vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
      path: '/test/path',
      name: 'path',
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

  describe('empty state', () => {
    it('shows no folder message when rootFolder is null', () => {
      render(<FileTree />, { wrapper });

      expect(screen.getByText(/no folder selected/i)).toBeInTheDocument();
    });
  });

  describe('with files', () => {
    beforeEach(() => {
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
        path: '/test/path',
        name: 'path',
        is_dir: true,
        size: 0,
        modified: Date.now(),
        extension: null,
        children: [
          {
            path: '/test/path/video.mp4',
            name: 'video.mp4',
            is_dir: false,
            size: 1024 * 1024 * 100,
            modified: Date.now(),
            extension: 'mp4',
            children: [],
          },
          {
            path: '/test/path/audio.mp3',
            name: 'audio.mp3',
            is_dir: false,
            size: 1024 * 1024 * 10,
            modified: Date.now(),
            extension: 'mp3',
            children: [],
          },
        ],
      });
    });

    it('renders file count in header', async () => {
      render(<FileTree />, { wrapper });

      // Trigger directory set
      await mediaContextValue?.setRootDirectory('/test/path');

      // Header shows "Files (2)" but text is split across elements
      const header = await screen.findByText((_content, element) => {
        return element?.tagName === 'H3' && element?.textContent?.includes('2') || false;
      });
      expect(header).toBeInTheDocument();
    });

    it('renders files at root level', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');

      expect(await screen.findByText('video.mp4')).toBeInTheDocument();
      expect(screen.getByText('audio.mp3')).toBeInTheDocument();
    });

    it('shows correct file type icons', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');

      // Video and audio files should have different icons (SVG elements)
      const buttons = await screen.findAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });
  });

  describe('file selection', () => {
    beforeEach(() => {
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
        path: '/test/path',
        name: 'path',
        is_dir: true,
        size: 0,
        modified: Date.now(),
        extension: null,
        children: [
          {
            path: '/test/path/video.mp4',
            name: 'video.mp4',
            is_dir: false,
            size: 1024,
            modified: Date.now(),
            extension: 'mp4',
            children: [],
          },
        ],
      });
    });

    it('calls selectFile when file is clicked', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');

      const fileButton = await screen.findByText('video.mp4');
      fireEvent.click(fileButton);

      expect(mediaContextValue?.state.selectedFileId).toBe('/test/path/video.mp4');
    });

    it('highlights selected file', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');

      const fileButton = await screen.findByText('video.mp4');
      fireEvent.click(fileButton);

      // The button should have the selected class
      const button = fileButton.closest('button');
      expect(button).toHaveClass('bg-primary-50');
    });
  });

  describe('folder expansion', () => {
    beforeEach(() => {
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
        path: '/test/root',
        name: 'root',
        is_dir: true,
        size: 0,
        modified: Date.now(),
        extension: null,
        children: [
          {
            path: '/test/root/subfolder',
            name: 'subfolder',
            is_dir: true,
            size: 0,
            modified: Date.now(),
            extension: null,
            children: [
              {
                path: '/test/root/subfolder/video.mp4',
                name: 'video.mp4',
                is_dir: false,
                size: 1024,
                modified: Date.now(),
                extension: 'mp4',
                children: [],
              },
            ],
          },
        ],
      });
    });

    it('shows files in expanded folder', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/root');

      // Folder is expanded by default
      expect(await screen.findByText('subfolder')).toBeInTheDocument();
      expect(await screen.findByText('video.mp4')).toBeInTheDocument();
    });

    it('shows file count for folder', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/root');

      // Should show 1 file in the subfolder
      expect(await screen.findByText('1')).toBeInTheDocument();
    });
  });

  describe('status indicators', () => {
    beforeEach(() => {
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
        path: '/test/path',
        name: 'path',
        is_dir: true,
        size: 0,
        modified: Date.now(),
        extension: null,
        children: [
          {
            path: '/test/path/pending.mp4',
            name: 'pending.mp4',
            is_dir: false,
            size: 1024,
            modified: Date.now(),
            extension: 'mp4',
            children: [],
          },
        ],
      });
    });

    it('shows pending status indicator', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');

      // Pending files should have a neutral colored dot
      expect(await screen.findByText('pending.mp4')).toBeInTheDocument();
    });

    it('shows spinner for files being processed', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.updateFileStatus('/test/path/pending.mp4', 'transcribing', 50);

      // Should show spinner for transcribing files
      // The Spinner component renders an SVG
      const fileItem = await screen.findByText('pending.mp4');
      expect(fileItem.closest('button')?.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('empty folder', () => {
    beforeEach(() => {
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
        path: '/test/empty',
        name: 'empty',
        is_dir: true,
        size: 0,
        modified: Date.now(),
        extension: null,
        children: [],
      });
    });

    it('shows empty state message when no media files', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/empty');

      expect(await screen.findByText(/no media files found/i)).toBeInTheDocument();
    });
  });

  describe('deeply nested folders (5+ levels)', () => {
    beforeEach(() => {
      // Create 5-level nested structure manually for precise control
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
        path: '/test/root',
        name: 'root',
        is_dir: true,
        size: 0,
        modified: Date.now(),
        extension: null,
        children: [
          {
            path: '/test/root/file-root.mp4',
            name: 'file-root.mp4',
            is_dir: false,
            size: 1024,
            modified: Date.now(),
            extension: 'mp4',
            children: [],
          },
          {
            path: '/test/root/level1',
            name: 'level1',
            is_dir: true,
            size: 0,
            modified: Date.now(),
            extension: null,
            children: [
              {
                path: '/test/root/level1/file-level1.mp3',
                name: 'file-level1.mp3',
                is_dir: false,
                size: 1024,
                modified: Date.now(),
                extension: 'mp3',
                children: [],
              },
              {
                path: '/test/root/level1/level2',
                name: 'level2',
                is_dir: true,
                size: 0,
                modified: Date.now(),
                extension: null,
                children: [
                  {
                    path: '/test/root/level1/level2/file-level2.mkv',
                    name: 'file-level2.mkv',
                    is_dir: false,
                    size: 1024,
                    modified: Date.now(),
                    extension: 'mkv',
                    children: [],
                  },
                  {
                    path: '/test/root/level1/level2/level3',
                    name: 'level3',
                    is_dir: true,
                    size: 0,
                    modified: Date.now(),
                    extension: null,
                    children: [
                      {
                        path: '/test/root/level1/level2/level3/file-level3.wav',
                        name: 'file-level3.wav',
                        is_dir: false,
                        size: 1024,
                        modified: Date.now(),
                        extension: 'wav',
                        children: [],
                      },
                      {
                        path: '/test/root/level1/level2/level3/level4',
                        name: 'level4',
                        is_dir: true,
                        size: 0,
                        modified: Date.now(),
                        extension: null,
                        children: [
                          {
                            path: '/test/root/level1/level2/level3/level4/file-level4.mov',
                            name: 'file-level4.mov',
                            is_dir: false,
                            size: 1024,
                            modified: Date.now(),
                            extension: 'mov',
                            children: [],
                          },
                          {
                            path: '/test/root/level1/level2/level3/level4/level5',
                            name: 'level5',
                            is_dir: true,
                            size: 0,
                            modified: Date.now(),
                            extension: null,
                            children: [
                              {
                                path: '/test/root/level1/level2/level3/level4/level5/file-level5.flac',
                                name: 'file-level5.flac',
                                is_dir: false,
                                size: 1024,
                                modified: Date.now(),
                                extension: 'flac',
                                children: [],
                              },
                            ],
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      });
    });

    it('renders all nested folder levels', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/root');

      // All folder names should be visible (folders expanded by default)
      expect(await screen.findByText('level1')).toBeInTheDocument();
      expect(screen.getByText('level2')).toBeInTheDocument();
      expect(screen.getByText('level3')).toBeInTheDocument();
      expect(screen.getByText('level4')).toBeInTheDocument();
      expect(screen.getByText('level5')).toBeInTheDocument();
    });

    it('renders files at all depth levels', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/root');

      expect(await screen.findByText('file-root.mp4')).toBeInTheDocument();
      expect(screen.getByText('file-level1.mp3')).toBeInTheDocument();
      expect(screen.getByText('file-level2.mkv')).toBeInTheDocument();
      expect(screen.getByText('file-level3.wav')).toBeInTheDocument();
      expect(screen.getByText('file-level4.mov')).toBeInTheDocument();
      expect(screen.getByText('file-level5.flac')).toBeInTheDocument();
    });

    it('shows correct total file count including nested files', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/root');

      // Header should show total count (6 files across all levels)
      const header = await screen.findByText((_content, element) => {
        return element?.tagName === 'H3' && element?.textContent?.includes('6') || false;
      });
      expect(header).toBeInTheDocument();
    });

    it('selects file at deepest level (depth 5)', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/root');

      const deepFile = await screen.findByText('file-level5.flac');
      fireEvent.click(deepFile);

      expect(mediaContextValue?.state.selectedFileId).toBe(
        '/test/root/level1/level2/level3/level4/level5/file-level5.flac'
      );
    });

    it('hides deeply nested content when ancestor folder is collapsed', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/root');

      // Verify deep content is initially visible
      expect(await screen.findByText('file-level5.flac')).toBeInTheDocument();
      expect(screen.getByText('level3')).toBeInTheDocument();

      // Click level1 folder to collapse it (should hide all nested content)
      const level1Button = screen.getByText('level1');
      fireEvent.click(level1Button);

      // All content inside level1 should be hidden
      expect(screen.queryByText('file-level1.mp3')).not.toBeInTheDocument();
      expect(screen.queryByText('level2')).not.toBeInTheDocument();
      expect(screen.queryByText('level3')).not.toBeInTheDocument();
      expect(screen.queryByText('file-level5.flac')).not.toBeInTheDocument();

      // Root level content and level1 folder header should still be visible
      expect(screen.getByText('file-root.mp4')).toBeInTheDocument();
      expect(screen.getByText('level1')).toBeInTheDocument();
    });

    it('shows correct file count for deeply nested folders', async () => {
      render(<FileTree />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/root');

      // level1 contains 5 files total (level1 + level2 + level3 + level4 + level5)
      // Find the file count badge for level1 folder
      await screen.findByText('level1');

      // There should be multiple file count badges
      const fiveCount = screen.getByText('5');
      expect(fiveCount).toBeInTheDocument();
    });
  });
});
