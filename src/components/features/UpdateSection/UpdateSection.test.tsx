import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { UpdateSection } from './UpdateSection';
import * as hooks from '@/hooks';
import * as SettingsContext from '@/context/SettingsContext';

// Mock the hooks
vi.mock('@/hooks', async () => {
  const actual = await vi.importActual<typeof hooks>('@/hooks');
  return {
    ...actual,
    useAutoUpdate: vi.fn(),
  };
});

vi.mock('@/context/SettingsContext', async () => {
  const actual = await vi.importActual<typeof SettingsContext>('@/context/SettingsContext');
  return {
    ...actual,
    useSettings: vi.fn(),
  };
});

const mockUseAutoUpdate = vi.mocked(hooks.useAutoUpdate);
const mockUseSettings = vi.mocked(SettingsContext.useSettings);

const defaultAutoUpdateState = {
  checking: false,
  updateAvailable: null,
  downloading: false,
  downloadProgress: 0,
  downloadTotal: null,
  error: null,
  installed: false,
  checkForUpdates: vi.fn(),
  downloadAndInstall: vi.fn(),
  restartApp: vi.fn(),
  dismissUpdate: vi.fn(),
};

const defaultSettings = {
  settings: {
    autoUpdateEnabled: true,
    transcriptionProvider: 'local' as const,
    transcriptionLanguage: 'auto',
    whisperModel: 'base',
    openaiWhisperModel: 'whisper-1',
    llmProvider: 'ollama' as const,
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
};

describe('UpdateSection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAutoUpdate.mockReturnValue(defaultAutoUpdateState);
    mockUseSettings.mockReturnValue(defaultSettings);
  });

  describe('rendering', () => {
    it('should render Updates card', () => {
      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByText('Updates')).toBeInTheDocument();
    });

    it('should render auto-update toggle', () => {
      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByText('Automatic Updates')).toBeInTheDocument();
    });
  });

  describe('auto-update toggle', () => {
    it('should reflect enabled state from settings', () => {
      mockUseSettings.mockReturnValue({
        ...defaultSettings,
        settings: { ...defaultSettings.settings, autoUpdateEnabled: true },
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      const toggle = screen.getByRole('checkbox');
      expect(toggle).toBeChecked();
    });

    it('should reflect disabled state from settings', () => {
      mockUseSettings.mockReturnValue({
        ...defaultSettings,
        settings: { ...defaultSettings.settings, autoUpdateEnabled: false },
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      const toggle = screen.getByRole('checkbox');
      expect(toggle).not.toBeChecked();
    });

    it('should call setAutoUpdateEnabled on toggle', () => {
      const setAutoUpdateEnabled = vi.fn();
      mockUseSettings.mockReturnValue({
        ...defaultSettings,
        setAutoUpdateEnabled,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      const toggle = screen.getByRole('checkbox');
      fireEvent.click(toggle);

      expect(setAutoUpdateEnabled).toHaveBeenCalledWith(false);
    });
  });

  describe('checking state', () => {
    it('should show checking message when checking for updates', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        checking: true,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByText('Checking for updates...')).toBeInTheDocument();
    });

    it('should disable Check Now button when checking', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        checking: true,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      const checkButton = screen.getByRole('button', { name: 'Check Now' });
      expect(checkButton).toBeDisabled();
    });
  });

  describe('up to date state', () => {
    it('should show up to date message when no update available', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        updateAvailable: null,
        checking: false,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByText('You are up to date')).toBeInTheDocument();
    });

    it('should show Check Now button', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        updateAvailable: null,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByRole('button', { name: 'Check Now' })).toBeInTheDocument();
    });

    it('should call checkForUpdates when Check Now clicked', () => {
      const checkForUpdates = vi.fn();
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        checkForUpdates,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      const checkButton = screen.getByRole('button', { name: 'Check Now' });
      fireEvent.click(checkButton);

      expect(checkForUpdates).toHaveBeenCalledTimes(1);
    });
  });

  describe('update available state', () => {
    const updateAvailable = {
      version: '2.0.0',
      currentVersion: '1.0.0',
      date: '2024-06-01',
      body: 'New features and improvements',
    };

    it('should show update notification', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        updateAvailable,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByText('Update Available')).toBeInTheDocument();
    });

    it('should display version number', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        updateAvailable,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByText(/Version 2.0.0 is available/)).toBeInTheDocument();
    });

    it('should display release notes', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        updateAvailable,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByText('New features and improvements')).toBeInTheDocument();
    });

    it('should show Download and Install button', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        updateAvailable,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByRole('button', { name: 'Download and Install' })).toBeInTheDocument();
    });

    it('should call downloadAndInstall when button clicked', () => {
      const downloadAndInstall = vi.fn();
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        updateAvailable,
        downloadAndInstall,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      const downloadButton = screen.getByRole('button', { name: 'Download and Install' });
      fireEvent.click(downloadButton);

      expect(downloadAndInstall).toHaveBeenCalledTimes(1);
    });

    it('should show dismiss button', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        updateAvailable,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });

    it('should call dismissUpdate when dismiss clicked', () => {
      const dismissUpdate = vi.fn();
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        updateAvailable,
        dismissUpdate,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      const dismissButton = screen.getByRole('button', { name: 'Close' });
      fireEvent.click(dismissButton);

      expect(dismissUpdate).toHaveBeenCalledTimes(1);
    });

    it('should not show release notes if body is null', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        updateAvailable: { ...updateAvailable, body: null },
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.queryByText('New features and improvements')).not.toBeInTheDocument();
    });
  });

  describe('downloading state', () => {
    it('should show downloading message', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        downloading: true,
        downloadProgress: 500,
        downloadTotal: 1000,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByText('Downloading update...')).toBeInTheDocument();
    });

    it('should show progress bar', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        downloading: true,
        downloadProgress: 500,
        downloadTotal: 1000,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByRole('progressbar')).toBeInTheDocument();
    });

    it('should calculate progress percentage correctly', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        downloading: true,
        downloadProgress: 500,
        downloadTotal: 1000,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '50');
    });

    it('should handle zero total gracefully', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        downloading: true,
        downloadProgress: 0,
        downloadTotal: null,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '0');
    });
  });

  describe('installed state', () => {
    it('should show installed message', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        installed: true,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByText('Update installed. Restart to apply changes.')).toBeInTheDocument();
    });

    it('should show Restart Now button', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        installed: true,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByRole('button', { name: 'Restart Now' })).toBeInTheDocument();
    });

    it('should call restartApp when Restart Now clicked', () => {
      const restartApp = vi.fn();
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        installed: true,
        restartApp,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      const restartButton = screen.getByRole('button', { name: 'Restart Now' });
      fireEvent.click(restartButton);

      expect(restartApp).toHaveBeenCalledTimes(1);
    });
  });

  describe('error state', () => {
    it('should display error message', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        error: 'Failed to download update',
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByText('Failed to download update')).toBeInTheDocument();
    });

    it('should show error with error styling', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        error: 'Network error',
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      const errorElement = screen.getByText('Network error');
      expect(errorElement.closest('div')).toHaveClass('bg-red-50');
    });
  });

  describe('state priority', () => {
    it('should show downloading over update available', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        updateAvailable: {
          version: '2.0.0',
          currentVersion: '1.0.0',
          date: null,
          body: null,
        },
        downloading: true,
        downloadProgress: 500,
        downloadTotal: 1000,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByText('Downloading update...')).toBeInTheDocument();
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument();
    });

    it('should show installed over update available and downloading', () => {
      mockUseAutoUpdate.mockReturnValue({
        ...defaultAutoUpdateState,
        updateAvailable: {
          version: '2.0.0',
          currentVersion: '1.0.0',
          date: null,
          body: null,
        },
        downloading: false,
        installed: true,
      });

      render(<UpdateSection />, { wrapper: 'minimal' });
      expect(screen.getByText('Update installed. Restart to apply changes.')).toBeInTheDocument();
      expect(screen.queryByText('Update Available')).not.toBeInTheDocument();
    });
  });
});
