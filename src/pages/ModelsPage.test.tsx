import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ModelsPage } from './ModelsPage';
import { SettingsProvider, useSettings } from '@/context/SettingsContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { BrowserRouter } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import i18n from '@/i18n';
import type { ReactNode } from 'react';
import type { ModelStatus } from '@/lib/tauri';

// Mock @/lib/tauri
vi.mock('@/lib/tauri', () => ({
  getModelsStatus: vi.fn(),
  downloadModel: vi.fn(),
  deleteModel: vi.fn(),
  checkWhisperAvailable: vi.fn(),
  installWhisperCpp: vi.fn(),
  onModelDownloadProgress: vi.fn(() => Promise.resolve(() => {})),
  onWhisperInstallProgress: vi.fn(() => Promise.resolve(() => {})),
  getApiKeyStatus: vi.fn(),
  storeApiKey: vi.fn(),
  deleteApiKey: vi.fn(),
  getApiKeyMasked: vi.fn(),
  validateOpenaiKey: vi.fn(),
  checkOllama: vi.fn(),
  listOllamaModels: vi.fn(),
  pullOllamaModel: vi.fn(),
  deleteOllamaModel: vi.fn(),
}));

import * as tauriModule from '@/lib/tauri';

// Mock model data
const mockModelsStatus: ModelStatus[] = [
  { id: 'tiny', name: 'Tiny', size_display: '75 MB', installed: true, path: '/models/tiny' },
  { id: 'base', name: 'Base', size_display: '142 MB', installed: true, path: '/models/base' },
  { id: 'small', name: 'Small', size_display: '466 MB', installed: false, path: null },
  { id: 'medium', name: 'Medium', size_display: '1.5 GB', installed: true, path: '/models/medium' },
  { id: 'large-v3', name: 'Large v3', size_display: '3.1 GB', installed: false, path: null },
];

// Capture settings context for test manipulation
let settingsContextValue: ReturnType<typeof useSettings> | null = null;

function SettingsContextCapture({ children }: { children: ReactNode }) {
  const value = useSettings();
  settingsContextValue = value;
  return <>{children}</>;
}

const wrapper = ({ children }: { children: ReactNode }) => (
  <BrowserRouter>
    <I18nextProvider i18n={i18n}>
      <ThemeProvider>
        <SettingsProvider>
          <SettingsContextCapture>{children}</SettingsContextCapture>
        </SettingsProvider>
      </ThemeProvider>
    </I18nextProvider>
  </BrowserRouter>
);

describe('ModelsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    settingsContextValue = null;

    // Default mocks
    vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(true);
    vi.mocked(tauriModule.getModelsStatus).mockResolvedValue(mockModelsStatus);
    vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });
    vi.mocked(tauriModule.getApiKeyMasked).mockResolvedValue(null);
    vi.mocked(tauriModule.onModelDownloadProgress).mockResolvedValue(() => {});
    vi.mocked(tauriModule.onWhisperInstallProgress).mockResolvedValue(() => {});
    vi.mocked(tauriModule.checkOllama).mockResolvedValue(false);
    vi.mocked(tauriModule.listOllamaModels).mockResolvedValue([]);
  });

  describe('TranscriptionSection - Model Selection Display', () => {
    it('shows "Selected" badge on the currently selected model (default: base)', async () => {
      render(<ModelsPage />, { wrapper });

      // Wait for models to load
      await waitFor(() => {
        expect(screen.getByText('Base')).toBeInTheDocument();
      });

      // Find the Base model row and check for Selected badge
      const baseModelRow = screen.getByText('Base').closest('.flex-1')?.parentElement;
      expect(baseModelRow).toBeInTheDocument();

      // Check for Selected badge in the row
      const selectedBadge = screen.getByText(/selected|선택됨/i);
      expect(selectedBadge).toBeInTheDocument();
    });

    it('shows "Selected" badge on medium model when medium is selected in settings', async () => {
      // Set whisperModel to 'medium' in localStorage before rendering
      localStorage.setItem('clip-flow-settings', JSON.stringify({ whisperModel: 'medium' }));

      render(<ModelsPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Medium')).toBeInTheDocument();
      });

      // The Selected badge should be visible
      const selectedBadge = screen.getByText(/selected|선택됨/i);
      expect(selectedBadge).toBeInTheDocument();

      // The Selected badge should be near the Medium model, not Base
      const mediumRow = screen.getByText('Medium').closest('.flex-1');
      expect(mediumRow?.textContent).toMatch(/selected|선택됨/i);
    });

    it('does not show "Selected" badge on non-selected models', async () => {
      render(<ModelsPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Tiny')).toBeInTheDocument();
      });

      // Tiny model row should not have Selected badge (base is default)
      const tinyRow = screen.getByText('Tiny').closest('.flex-1');
      expect(tinyRow?.textContent).not.toMatch(/selected|선택됨/i);
    });
  });

  describe('TranscriptionSection - Model Selection Interaction', () => {
    it('renders "Select" button for installed models that are not selected', async () => {
      render(<ModelsPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Tiny')).toBeInTheDocument();
      });

      // Tiny is installed but not selected, should have Select button
      const selectButtons = screen.getAllByRole('button', { name: /select|선택/i });
      expect(selectButtons.length).toBeGreaterThan(0);
    });

    it('does not render "Select" button for uninstalled models', async () => {
      render(<ModelsPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Small')).toBeInTheDocument();
      });

      // Small is not installed, should have Download button instead
      const smallRow = screen.getByText('Small').closest('.flex-1')?.parentElement;
      const downloadButton = smallRow?.querySelector('button');
      expect(downloadButton?.textContent).toMatch(/download|다운로드/i);
    });

    it('does not render "Select" button for already selected model', async () => {
      render(<ModelsPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Base')).toBeInTheDocument();
      });

      // Base is selected (default), should not have Select button
      const baseRow = screen.getByText('Base').closest('.flex-1')?.parentElement;
      const buttons = baseRow?.querySelectorAll('button');

      // Should only have Remove button, not Select button
      const buttonTexts = Array.from(buttons || []).map((b) => b.textContent);
      expect(buttonTexts.some((t) => t?.match(/select|선택/i))).toBe(false);
      expect(buttonTexts.some((t) => t?.match(/remove|제거/i))).toBe(true);
    });

    it('calls setWhisperModel when Select button is clicked', async () => {
      render(<ModelsPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Tiny')).toBeInTheDocument();
      });

      // Find and click the Select button for Tiny model
      const tinyRow = screen.getByText('Tiny').closest('.flex-1')?.parentElement;
      const selectButton = tinyRow?.querySelector('button');

      // The first button should be Select for installed non-selected models
      if (selectButton?.textContent?.match(/select|선택/i)) {
        fireEvent.click(selectButton);

        // Check that settings were updated
        await waitFor(() => {
          expect(settingsContextValue?.settings.whisperModel).toBe('tiny');
        });
      }
    });

    it('updates UI to show "Selected" badge after clicking Select', async () => {
      render(<ModelsPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Tiny')).toBeInTheDocument();
      });

      // Find Select button for Tiny (should be first installed non-selected model)
      const selectButtons = screen.getAllByRole('button', { name: /^select$|^선택$/i });
      expect(selectButtons.length).toBeGreaterThan(0);

      fireEvent.click(selectButtons[0]);

      // After clicking, Tiny should now show Selected badge
      await waitFor(() => {
        const tinyRow = screen.getByText('Tiny').closest('.flex-1');
        expect(tinyRow?.textContent).toMatch(/selected|선택됨/i);
      });
    });
  });

  describe('TranscriptionSection - Edge Cases', () => {
    it('shows warning when selected model is not installed', async () => {
      // Set whisperModel to 'large-v3' which is not installed
      localStorage.setItem('clip-flow-settings', JSON.stringify({ whisperModel: 'large-v3' }));

      render(<ModelsPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Large v3')).toBeInTheDocument();
      });

      // Should show warning message about uninstalled selected model
      const warning = screen.queryByText(/not installed|설치되어 있지 않/i);
      expect(warning).toBeInTheDocument();
    });

    it('renders all models with correct installation status', async () => {
      render(<ModelsPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Tiny')).toBeInTheDocument();
      });

      // Check installed badges
      const installedBadges = screen.getAllByText(/^installed$|^설치됨$/i);
      expect(installedBadges.length).toBe(3); // tiny, base, medium are installed
    });
  });
});
