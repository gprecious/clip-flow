import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { HomePage } from './HomePage';
import { mockDirectoryNode } from '@/test/mocks/media-data';
import { MediaProvider, useMedia } from '@/context/MediaContext';
import { SettingsProvider } from '@/context/SettingsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import type { ReactNode } from 'react';

// Mock @tauri-apps/plugin-dialog
vi.mock('@tauri-apps/plugin-dialog', () => ({
  open: vi.fn(),
}));

// Mock @/lib/tauri
vi.mock('@/lib/tauri', () => ({
  scanMediaDirectoryTree: vi.fn(),
  startWatchingDirectory: vi.fn(),
  stopWatchingDirectory: vi.fn(),
  onFileChange: vi.fn(() => Promise.resolve(() => {})),
  onTranscriptionProgress: vi.fn(() => Promise.resolve(() => {})),
  transcribeMedia: vi.fn(),
  getInstalledModels: vi.fn(),
  checkWhisperAvailable: vi.fn(),
  getApiKeyStatus: vi.fn(),
  openaiTranscribe: vi.fn(),
}));

import { open } from '@tauri-apps/plugin-dialog';
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

describe('HomePage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mediaContextValue = null;
    vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue(mockDirectoryNode);
    vi.mocked(tauriModule.startWatchingDirectory).mockResolvedValue(undefined);
    vi.mocked(tauriModule.stopWatchingDirectory).mockResolvedValue(undefined);
    vi.mocked(tauriModule.onFileChange).mockResolvedValue(() => {});
    vi.mocked(tauriModule.onTranscriptionProgress).mockResolvedValue(() => {});
    vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(false);
    vi.mocked(tauriModule.getInstalledModels).mockResolvedValue([]);
    vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });
  });

  describe('Change Folder Button', () => {
    it('renders change folder button when directory is selected', async () => {
      render(<HomePage />, { wrapper });

      // Set directory using context
      await mediaContextValue?.setRootDirectory('/test/path');

      await waitFor(() => {
        expect(screen.getByTitle(/change folder|폴더 변경/i)).toBeInTheDocument();
      });
    });

    it('does not render change folder button when no directory selected', () => {
      render(<HomePage />, { wrapper });
      expect(screen.queryByTitle(/change folder|폴더 변경/i)).not.toBeInTheDocument();
    });

    it('opens folder picker when change folder button clicked', async () => {
      vi.mocked(open).mockResolvedValue('/new/path');

      render(<HomePage />, { wrapper });

      // Set directory using context
      await mediaContextValue?.setRootDirectory('/test/path');

      await waitFor(() => {
        expect(screen.getByTitle(/change folder|폴더 변경/i)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTitle(/change folder|폴더 변경/i));

      await waitFor(() => {
        expect(open).toHaveBeenCalledWith({
          directory: true,
          multiple: false,
          title: expect.any(String),
        });
      });
    });

    it('updates directory when new folder selected', async () => {
      vi.mocked(open).mockResolvedValue('/new/path');

      render(<HomePage />, { wrapper });

      // Set initial directory
      await mediaContextValue?.setRootDirectory('/test/path');

      await waitFor(() => {
        expect(screen.getByTitle(/change folder|폴더 변경/i)).toBeInTheDocument();
      });

      // Reset mock to track new call
      vi.mocked(tauriModule.scanMediaDirectoryTree).mockClear();

      fireEvent.click(screen.getByTitle(/change folder|폴더 변경/i));

      await waitFor(() => {
        expect(tauriModule.scanMediaDirectoryTree).toHaveBeenCalledWith('/new/path');
      });
    });
  });
});
