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
  validateClaudeKey: vi.fn(),
  validateClaudeKeyDirect: vi.fn(),
  fetchClaudeModels: vi.fn(),
  fetchClaudeModelsDirect: vi.fn(),
  checkOllama: vi.fn(),
  listOllamaModels: vi.fn(),
  pullOllamaModel: vi.fn(),
  deleteOllamaModel: vi.fn(),
}));

import * as tauriModule from '@/lib/tauri';

// Mock model data
const mockModelsStatus: ModelStatus[] = [
  { id: 'tiny', name: 'Tiny', description: 'tiny', size_display: '78 MB', installed: true, path: '/models/tiny' },
  { id: 'base', name: 'Base', description: 'base', size_display: '148 MB', installed: true, path: '/models/base' },
  { id: 'small', name: 'Small', description: 'small', size_display: '488 MB', installed: false, path: null },
  { id: 'medium', name: 'Medium', description: 'medium', size_display: '1.5 GB', installed: true, path: '/models/medium' },
  { id: 'large-v3', name: 'Large v3', description: 'largeV3', size_display: '3.1 GB', installed: false, path: null },
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

  describe('OpenAI Whisper file size limit info', () => {
    it('shows 25MB file size limit info when OpenAI provider is selected', async () => {
      // Set transcription provider to OpenAI and mock API key
      localStorage.setItem('clip-flow-settings', JSON.stringify({ transcriptionProvider: 'openai' }));
      vi.mocked(tauriModule.getApiKeyMasked).mockResolvedValue('sk-...xxx');

      render(<ModelsPage />, { wrapper });

      // Click on OpenAI provider to ensure it's selected
      const openaiButton = await screen.findByText(/OpenAI Whisper API/i);
      fireEvent.click(openaiButton);

      // Should show file size limit info (25MB)
      await waitFor(() => {
        expect(screen.getByText(/25\s*MB/i)).toBeInTheDocument();
      });
    });

    it('does not show file size limit info when local provider is selected', async () => {
      // Set transcription provider to local (default)
      localStorage.setItem('clip-flow-settings', JSON.stringify({ transcriptionProvider: 'local' }));

      render(<ModelsPage />, { wrapper });

      await waitFor(() => {
        expect(screen.getByText('Base')).toBeInTheDocument();
      });

      // Should NOT show file size limit warning for local whisper
      // The 25MB limit text should only appear in OpenAI section
      const localSection = screen.getByText(/Local \(whisper\.cpp\)/i).closest('button');
      expect(localSection?.textContent).not.toMatch(/25\s*MB/i);
    });
  });

  describe('Claude API Key - Save and Validate', () => {
    const mockClaudeModels = [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Most intelligent model', created_at: '2024-10-22' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', description: 'Fast model', created_at: '2024-10-22' },
    ];

    // Helper to navigate to Claude provider in LLM section
    const navigateToClaudeProvider = async () => {
      // Click LLM tab first
      const llmTab = await screen.findByRole('tab', { name: /LLM/i });
      fireEvent.click(llmTab);

      // Wait for LLM section to load and find provider buttons
      await waitFor(() => {
        expect(screen.getByText('Ollama')).toBeInTheDocument();
      });

      // Find Claude button by looking for the button containing "Claude" text
      // The button structure has "Claude" in a span and "Opus, Sonnet, Haiku" in a p
      const buttons = screen.getAllByRole('button');
      const claudeButton = buttons.find(button =>
        button.textContent?.includes('Claude') &&
        button.textContent?.includes('Opus, Sonnet, Haiku')
      );

      if (!claudeButton) {
        throw new Error('Claude provider button not found');
      }

      fireEvent.click(claudeButton);

      // Wait for Claude API Key card to appear
      await waitFor(() => {
        expect(screen.getByText(/Claude API Key/i)).toBeInTheDocument();
      });
    };

    beforeEach(() => {
      vi.mocked(tauriModule.storeApiKey).mockResolvedValue(undefined);
      vi.mocked(tauriModule.validateClaudeKey).mockResolvedValue(true);
      vi.mocked(tauriModule.validateClaudeKeyDirect).mockResolvedValue(true);
      vi.mocked(tauriModule.fetchClaudeModels).mockResolvedValue(mockClaudeModels);
      vi.mocked(tauriModule.fetchClaudeModelsDirect).mockResolvedValue(mockClaudeModels);
    });

    it('saves Claude API key and validates successfully', async () => {
      // No key initially, then returns masked key after save
      let saveHappened = false;
      vi.mocked(tauriModule.getApiKeyMasked).mockImplementation(async () => {
        if (saveHappened) return 'sk-a...xyz';
        return null;
      });
      vi.mocked(tauriModule.storeApiKey).mockImplementation(async () => {
        saveHappened = true;
        return undefined;
      });
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });
      vi.mocked(tauriModule.validateClaudeKeyDirect).mockResolvedValue(true);

      render(<ModelsPage />, { wrapper });

      await navigateToClaudeProvider();

      // Find the input field and enter API key
      const apiKeyInput = await screen.findByPlaceholderText(/sk-ant-/i);
      fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-test-key-12345' } });

      // Click save button
      const saveButton = screen.getByRole('button', { name: /save|저장/i });
      fireEvent.click(saveButton);

      // Verify storeApiKey was called
      await waitFor(() => {
        expect(tauriModule.storeApiKey).toHaveBeenCalledWith('claude', 'sk-ant-test-key-12345');
      });

      // Verify validateClaudeKeyDirect was called with the key directly (bypasses keychain)
      await waitFor(() => {
        expect(tauriModule.validateClaudeKeyDirect).toHaveBeenCalledWith('sk-ant-test-key-12345');
      });
    });

    it('shows validation state during API key validation', async () => {
      // No key initially, then returns masked key after save
      let saveHappened = false;
      vi.mocked(tauriModule.getApiKeyMasked).mockImplementation(async () => {
        if (saveHappened) return 'sk-a...xyz';
        return null;
      });
      vi.mocked(tauriModule.storeApiKey).mockImplementation(async () => {
        saveHappened = true;
        return undefined;
      });
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });
      // Make validateClaudeKeyDirect slow to observe loading state
      vi.mocked(tauriModule.validateClaudeKeyDirect).mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve(true), 100))
      );

      render(<ModelsPage />, { wrapper });

      await navigateToClaudeProvider();

      const apiKeyInput = await screen.findByPlaceholderText(/sk-ant-/i);
      fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-test-key' } });

      const saveButton = screen.getByRole('button', { name: /save|저장/i });
      fireEvent.click(saveButton);

      // Button should be disabled during validation
      await waitFor(() => {
        expect(saveButton).toBeDisabled();
      });
    });

    it('shows "사용 가능" badge when API key is valid', async () => {
      // No key initially, then returns masked key after save
      vi.mocked(tauriModule.getApiKeyMasked)
        .mockResolvedValueOnce(null)  // Initial load for OpenAI
        .mockResolvedValueOnce(null)  // Initial load for Claude
        .mockResolvedValue('sk-a...xyz');  // After save
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });
      vi.mocked(tauriModule.validateClaudeKeyDirect).mockResolvedValue(true);

      render(<ModelsPage />, { wrapper });

      await navigateToClaudeProvider();

      const apiKeyInput = await screen.findByPlaceholderText(/sk-ant-/i);
      fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-valid-key' } });

      const saveButton = screen.getByRole('button', { name: /save|저장/i });
      fireEvent.click(saveButton);

      // Wait for validation to complete and check for success badge
      await waitFor(() => {
        const badges = screen.getAllByText(/사용 가능|available/i);
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('shows "Invalid" badge when API key validation fails', async () => {
      // No key initially - use mockImplementation to return null for initial loads
      let saveHappened = false;
      vi.mocked(tauriModule.getApiKeyMasked).mockImplementation(async () => {
        if (saveHappened) return 'sk-a...xyz';
        return null;
      });
      vi.mocked(tauriModule.storeApiKey).mockImplementation(async () => {
        saveHappened = true;
        return undefined;
      });
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });
      vi.mocked(tauriModule.validateClaudeKeyDirect).mockResolvedValue(false);

      render(<ModelsPage />, { wrapper });

      await navigateToClaudeProvider();

      const apiKeyInput = await screen.findByPlaceholderText(/sk-ant-/i);
      fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-invalid-key' } });

      const saveButton = screen.getByRole('button', { name: /save|저장/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        // The component shows "Invalid" badge and/or "API key is invalid" text for invalid keys
        const badges = screen.queryAllByText(/invalid/i);
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('handles validateClaudeKeyDirect error gracefully', async () => {
      // No key initially - use mockImplementation to return null for initial loads
      let saveHappened = false;
      vi.mocked(tauriModule.getApiKeyMasked).mockImplementation(async () => {
        if (saveHappened) return 'sk-a...xyz';
        return null;
      });
      vi.mocked(tauriModule.storeApiKey).mockImplementation(async () => {
        saveHappened = true;
        return undefined;
      });
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });
      vi.mocked(tauriModule.validateClaudeKeyDirect).mockRejectedValue(
        new Error('Process failed: Network error')
      );

      render(<ModelsPage />, { wrapper });

      await navigateToClaudeProvider();

      const apiKeyInput = await screen.findByPlaceholderText(/sk-ant-/i);
      fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-test-key' } });

      const saveButton = screen.getByRole('button', { name: /save|저장/i });
      fireEvent.click(saveButton);

      // Should handle error and show invalid message
      await waitFor(() => {
        // The component shows "Invalid" badge and "API key is invalid" text for validation errors
        const badges = screen.queryAllByText(/invalid/i);
        expect(badges.length).toBeGreaterThan(0);
      });
    });

    it('loads Claude models after successful validation', async () => {
      // No key initially
      vi.mocked(tauriModule.getApiKeyMasked)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockResolvedValue('sk-a...xyz');
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });
      vi.mocked(tauriModule.validateClaudeKeyDirect).mockResolvedValue(true);
      vi.mocked(tauriModule.fetchClaudeModels).mockResolvedValue(mockClaudeModels);

      render(<ModelsPage />, { wrapper });

      await navigateToClaudeProvider();

      const apiKeyInput = await screen.findByPlaceholderText(/sk-ant-/i);
      fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-valid-key' } });

      const saveButton = screen.getByRole('button', { name: /save|저장/i });
      fireEvent.click(saveButton);

      // Wait for models to be loaded directly with the key (bypasses keychain)
      await waitFor(() => {
        expect(tauriModule.fetchClaudeModelsDirect).toHaveBeenCalledWith('sk-ant-valid-key');
      });

      // Check if model names are displayed
      await waitFor(() => {
        expect(screen.getByText(/Claude 3.5 Sonnet/i)).toBeInTheDocument();
      });
    });

    it('does not call storeApiKey for empty input', async () => {
      // Ensure no key is saved initially
      vi.mocked(tauriModule.getApiKeyMasked).mockResolvedValue(null);
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });

      render(<ModelsPage />, { wrapper });

      await navigateToClaudeProvider();

      const apiKeyInput = await screen.findByPlaceholderText(/sk-ant-/i);
      fireEvent.change(apiKeyInput, { target: { value: '   ' } }); // whitespace only

      const saveButton = screen.getByRole('button', { name: /save|저장/i });
      fireEvent.click(saveButton);

      // storeApiKey should not be called for empty/whitespace input
      await waitFor(() => {
        expect(tauriModule.storeApiKey).not.toHaveBeenCalled();
      });
    });

    it('calls validateClaudeKeyDirect sequentially after storeApiKey completes', async () => {
      const callOrder: string[] = [];

      vi.mocked(tauriModule.storeApiKey).mockImplementation(async () => {
        callOrder.push('storeApiKey');
        return undefined;
      });

      // No key initially, then returns key after save
      vi.mocked(tauriModule.getApiKeyMasked)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null)
        .mockImplementation(async () => {
          callOrder.push('getApiKeyMasked');
          return 'sk-a...xyz';
        });
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: false });

      vi.mocked(tauriModule.validateClaudeKeyDirect).mockImplementation(async () => {
        callOrder.push('validateClaudeKeyDirect');
        return true;
      });

      render(<ModelsPage />, { wrapper });

      await navigateToClaudeProvider();

      const apiKeyInput = await screen.findByPlaceholderText(/sk-ant-/i);
      fireEvent.change(apiKeyInput, { target: { value: 'sk-ant-test-key' } });

      const saveButton = screen.getByRole('button', { name: /save|저장/i });
      fireEvent.click(saveButton);

      await waitFor(() => {
        // storeApiKey should be called first
        expect(callOrder.indexOf('storeApiKey')).toBeLessThan(callOrder.indexOf('validateClaudeKeyDirect'));
      });
    });

    it('deletes Claude API key successfully', async () => {
      // Setup: show masked key (simulating existing saved key)
      vi.mocked(tauriModule.getApiKeyStatus).mockResolvedValue({ openai: false, claude: true });
      vi.mocked(tauriModule.getApiKeyMasked).mockResolvedValue('sk-a...xyz');
      vi.mocked(tauriModule.validateClaudeKeyDirect).mockResolvedValue(true);
      vi.mocked(tauriModule.deleteApiKey).mockResolvedValue(undefined);

      render(<ModelsPage />, { wrapper });

      await navigateToClaudeProvider();

      // Wait for masked key to be displayed
      await waitFor(() => {
        expect(screen.getByText(/sk-a\.\.\.xyz/i)).toBeInTheDocument();
      });

      // Click remove button
      const removeButton = screen.getByRole('button', { name: /remove|삭제/i });
      fireEvent.click(removeButton);

      await waitFor(() => {
        expect(tauriModule.deleteApiKey).toHaveBeenCalledWith('claude');
      });
    });
  });
});
