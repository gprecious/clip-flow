import { test, expect } from '@playwright/test';

test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri APIs for browser testing
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          switch (cmd) {
            case 'check_whisper_available':
              return false;
            case 'get_installed_models':
              return [];
            case 'get_api_key_status':
              return { openai: false, claude: false };
            default:
              return null;
          }
        },
      };
    });

    await page.goto('/settings');
  });

  test('displays settings page heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('shows theme selection', async ({ page }) => {
    // Look for theme label
    await expect(page.getByText('Theme')).toBeVisible();
    // Theme combobox should be visible
    await expect(page.getByRole('combobox', { name: /theme/i })).toBeVisible();
  });

  test('shows language selection', async ({ page }) => {
    // Look for language label
    await expect(page.getByText('Language').first()).toBeVisible();
    // Language combobox should be visible
    await expect(page.getByRole('combobox', { name: /language/i })).toBeVisible();
  });

  test('can change theme via combobox', async ({ page }) => {
    // Find theme combobox and change it
    const themeSelect = page.getByRole('combobox', { name: /theme/i });
    await expect(themeSelect).toBeVisible();

    // Select Dark option
    await themeSelect.selectOption('Dark');
    await expect(themeSelect).toHaveValue('dark');
  });

  test('shows transcription language section', async ({ page }) => {
    // Settings page has "Transcription Language" section
    await expect(page.getByText('Transcription Language')).toBeVisible();
  });

  test('shows about section', async ({ page }) => {
    // Look for About heading
    await expect(page.getByRole('heading', { name: /about/i })).toBeVisible();
    // Version info should be visible
    await expect(page.getByText('Version')).toBeVisible();
  });

  test('navigates to home via sidebar', async ({ page }) => {
    // Navigation uses buttons in sidebar
    const homeButton = page.getByRole('button', { name: /home/i });
    await expect(homeButton).toBeVisible();
    await homeButton.click();
    // Should navigate to home (URL changes or heading changes)
    await expect(page.getByRole('heading', { name: /home/i, level: 1 })).toBeVisible();
  });
});
