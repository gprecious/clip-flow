import { test, expect } from '@playwright/test';

test.describe('Models Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri APIs for browser testing
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          switch (cmd) {
            case 'check_whisper_available':
              return true;
            case 'get_models_status':
              return [
                { name: 'tiny', installed: false, size: '75MB' },
                { name: 'base', installed: true, size: '142MB' },
                { name: 'small', installed: true, size: '466MB' },
                { name: 'medium', installed: false, size: '1.5GB' },
                { name: 'large', installed: false, size: '2.9GB' },
              ];
            case 'get_api_key_status':
              return { openai: false, claude: false };
            case 'check_ollama':
              return true;
            case 'list_ollama_models':
              return [];
            default:
              return null;
          }
        },
      };
    });

    await page.goto('/models');
  });

  test('displays transcription and LLM tabs', async ({ page }) => {
    // ModelsPage uses Tabs with "Transcription" and "LLM" tabs
    await expect(page.getByRole('tab', { name: /transcription/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /llm/i })).toBeVisible();
  });

  test('shows transcription provider section', async ({ page }) => {
    // Wait for content to load and look for provider options
    await expect(
      page.getByText(/transcription provider/i).first()
    ).toBeVisible();
  });

  test('shows local whisper option', async ({ page }) => {
    // Look for local whisper provider button
    await expect(page.getByText(/local.*whisper/i).first()).toBeVisible();
  });

  test('shows OpenAI whisper option', async ({ page }) => {
    // Look for OpenAI whisper provider button
    await expect(page.getByText(/openai.*whisper/i).first()).toBeVisible();
  });

  test('can switch to LLM tab', async ({ page }) => {
    const llmTab = page.getByRole('tab', { name: /llm/i });
    await llmTab.click();
    await expect(llmTab).toHaveAttribute('aria-selected', 'true');
  });

  test('shows LLM provider section when LLM tab is active', async ({ page }) => {
    // Switch to LLM tab
    await page.getByRole('tab', { name: /llm/i }).click();

    // Look for LLM provider content
    await expect(page.getByText(/llm provider/i).first()).toBeVisible();
  });
});
