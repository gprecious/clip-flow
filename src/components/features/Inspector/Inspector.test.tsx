import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Inspector } from './Inspector';
import { MediaProvider, useMedia } from '@/context/MediaContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import { mockSegments } from '@/test/mocks/media-data';
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

// Mock the plugin-opener
vi.mock('@tauri-apps/plugin-opener', () => ({
  openPath: vi.fn(),
}));

import { openPath } from '@tauri-apps/plugin-opener';

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

describe('Inspector', () => {
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
      ],
    });
    vi.mocked(tauriModule.startWatchingDirectory).mockResolvedValue(undefined);
    vi.mocked(tauriModule.stopWatchingDirectory).mockResolvedValue(undefined);
    vi.mocked(tauriModule.onFileChange).mockResolvedValue(() => {});
  });

  describe('empty state', () => {
    it('shows select file message when no file selected', () => {
      render(<Inspector />, { wrapper });

      expect(screen.getByText(/select a file/i)).toBeInTheDocument();
    });
  });

  describe('file header', () => {
    it('shows file name', async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/video.mp4');

      expect(await screen.findByText('video.mp4')).toBeInTheDocument();
    });

    it('shows file size', async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/video.mp4');

      // 100MB file
      expect(await screen.findByText(/100.*MB/i)).toBeInTheDocument();
    });

    it('shows correct status label for pending', async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/video.mp4');

      expect(await screen.findByText(/waiting/i)).toBeInTheDocument();
    });
  });

  describe('status states', () => {
    it('shows extracting status with progress', async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/video.mp4');
      mediaContextValue?.updateFileStatus('/test/path/video.mp4', 'extracting', 30);

      // Multiple elements contain "extracting" text
      const extractingElements = await screen.findAllByText(/extracting/i);
      expect(extractingElements.length).toBeGreaterThan(0);
      // Multiple progressbars may be present
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('shows transcribing status with progress', async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/video.mp4');
      mediaContextValue?.updateFileStatus('/test/path/video.mp4', 'transcribing', 60);

      // Multiple elements contain "transcribing" text
      const transcribingElements = await screen.findAllByText(/transcribing/i);
      expect(transcribingElements.length).toBeGreaterThan(0);
      // Multiple progressbars may be present
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
    });

    it('shows completed status', async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/video.mp4');
      mediaContextValue?.setTranscription('/test/path/video.mp4', {
        segments: mockSegments,
        fullText: 'Test transcription',
        language: 'en',
        duration: 60,
      });

      expect(await screen.findByText(/completed/i)).toBeInTheDocument();
    });

    it('shows error status with message', async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');

      await waitFor(() => {
        mediaContextValue?.selectFile('/test/path/video.mp4');
        mediaContextValue?.updateFileStatus('/test/path/video.mp4', 'error', 0, 'Test error');
      });

      expect(await screen.findByText('Test error')).toBeInTheDocument();
    });
  });

  describe('transcription display', () => {
    beforeEach(async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      await waitFor(() => {
        mediaContextValue?.selectFile('/test/path/video.mp4');
        mediaContextValue?.setTranscription('/test/path/video.mp4', {
          segments: mockSegments,
          fullText: 'Hello world, this is a test.',
          language: 'en',
          duration: 60,
        });
      });
    });

    it('shows Script tab with transcription text', async () => {
      // Script tab should be active by default
      expect(await screen.findByText('Hello world, this is a test.')).toBeInTheDocument();
    });

    it('shows language metadata', async () => {
      // Language is displayed as "Language: en" in a p element
      const languageText = await screen.findByText((_content, element) => {
        // Look for a p element specifically containing "Language:" to avoid matching parent elements
        return (
          element?.tagName === 'P' &&
          element?.textContent?.includes('Language:') &&
          element?.textContent?.includes('en')
        );
      });
      expect(languageText).toBeInTheDocument();
    });

    it('shows duration metadata', async () => {
      // Duration is displayed as "Duration: 1:00"
      expect(await screen.findByText(/Duration:/)).toBeInTheDocument();
    });

    it('switches to Segments tab', async () => {
      const segmentsTab = await screen.findByRole('tab', { name: /segments/i });
      fireEvent.click(segmentsTab);

      // Should show timestamps (each timestamp is in separate elements)
      await waitFor(() => {
        expect(screen.getByText(/0:00/)).toBeInTheDocument();
      });
    });
  });

  describe('actions', () => {
    it('calls openPath when play button is clicked', async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/video.mp4');

      const playButton = await screen.findByLabelText(/open in external player/i);
      fireEvent.click(playButton);

      expect(openPath).toHaveBeenCalledWith('/test/path/video.mp4');
    });

    it('shows retranscribe button for completed files', async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/video.mp4');
      mediaContextValue?.setTranscription('/test/path/video.mp4', {
        segments: [],
        fullText: 'Test',
      });

      expect(await screen.findByLabelText(/re-transcribe/i)).toBeInTheDocument();
    });

    it('calls retranscribeFile when retranscribe button is clicked', async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/video.mp4');
      mediaContextValue?.setTranscription('/test/path/video.mp4', {
        segments: [],
        fullText: 'Test',
      });

      const retranscribeButton = await screen.findByLabelText(/re-transcribe/i);
      fireEvent.click(retranscribeButton);

      // Status should be reset to pending
      const file = mediaContextValue?.getSelectedFile();
      expect(file?.status).toBe('pending');
    });

    it('shows retranscribe button for error files', async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/video.mp4');
      mediaContextValue?.updateFileStatus('/test/path/video.mp4', 'error', 0, 'Failed');

      expect(await screen.findByLabelText(/re-transcribe/i)).toBeInTheDocument();
    });
  });

  describe('file size formatting', () => {
    it('formats bytes correctly', async () => {
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
        path: '/test/path',
        name: 'path',
        is_dir: true,
        size: 0,
        modified: Date.now(),
        extension: null,
        children: [
          {
            path: '/test/path/small.mp4',
            name: 'small.mp4',
            is_dir: false,
            size: 500,
            modified: Date.now(),
            extension: 'mp4',
            children: [],
          },
        ],
      });

      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/small.mp4');

      expect(await screen.findByText(/500.*bytes/i)).toBeInTheDocument();
    });

    it('formats KB correctly', async () => {
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
        path: '/test/path',
        name: 'path',
        is_dir: true,
        size: 0,
        modified: Date.now(),
        extension: null,
        children: [
          {
            path: '/test/path/medium.mp4',
            name: 'medium.mp4',
            is_dir: false,
            size: 1024 * 50,
            modified: Date.now(),
            extension: 'mp4',
            children: [],
          },
        ],
      });

      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/medium.mp4');

      expect(await screen.findByText(/50.*kb/i)).toBeInTheDocument();
    });
  });

  describe('icon display', () => {
    it('shows video icon for video files', async () => {
      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/video.mp4');

      // Should have a video icon (title "Video")
      expect(await screen.findByTitle('Video')).toBeInTheDocument();
    });

    it('shows audio icon for audio files', async () => {
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
        path: '/test/path',
        name: 'path',
        is_dir: true,
        size: 0,
        modified: Date.now(),
        extension: null,
        children: [
          {
            path: '/test/path/audio.mp3',
            name: 'audio.mp3',
            is_dir: false,
            size: 1024,
            modified: Date.now(),
            extension: 'mp3',
            children: [],
          },
        ],
      });

      render(<Inspector />, { wrapper });

      await mediaContextValue?.setRootDirectory('/test/path');
      mediaContextValue?.selectFile('/test/path/audio.mp3');

      expect(await screen.findByTitle('Audio')).toBeInTheDocument();
    });
  });
});
