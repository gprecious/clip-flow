import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri APIs for browser testing
    await page.addInitScript(() => {
      // Mock window.__TAURI_INTERNALS__
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          // Mock responses for common commands
          switch (cmd) {
            case 'scan_media_directory_tree':
              return {
                path: '/mock/path',
                name: 'path',
                is_dir: true,
                size: 0,
                modified: Date.now(),
                extension: null,
                children: [],
              };
            case 'start_watching_directory':
            case 'stop_watching_directory':
              return undefined;
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

      // Mock Tauri event APIs
      (window as unknown as Record<string, unknown>).__TAURI_INVOKE__ = async () => null;
    });

    await page.goto('/');
  });

  test('displays application logo', async ({ page }) => {
    // The app should have a logo with "Clip-Flow" text in sidebar
    await expect(page.getByText('Clip-Flow')).toBeVisible();
  });

  test('displays home heading', async ({ page }) => {
    // Home page heading
    await expect(page.getByRole('heading', { name: /home/i, level: 1 })).toBeVisible();
  });

  test('shows empty state when no folder is selected', async ({ page }) => {
    // Should show welcome message or select folder prompt
    await expect(page.getByText(/welcome to clip-flow|select.*folder|no.*directory/i).first()).toBeVisible();
  });

  test('shows select folder button', async ({ page }) => {
    // Select folder button should be visible
    await expect(page.getByRole('button', { name: /select.*folder/i }).first()).toBeVisible();
  });

  test('navigates to settings via sidebar', async ({ page }) => {
    // Click on settings button in sidebar
    const settingsButton = page.getByRole('button', { name: /settings/i });
    await expect(settingsButton).toBeVisible();
    await settingsButton.click();
    // Should show settings page heading
    await expect(page.getByRole('heading', { name: /settings/i, level: 1 })).toBeVisible();
  });

  test('navigates to models via sidebar', async ({ page }) => {
    // Click on model manager button in sidebar
    const modelsButton = page.getByRole('button', { name: /model manager/i });
    await expect(modelsButton).toBeVisible();
    await modelsButton.click();
    // Should show transcription tab (models page content)
    await expect(page.getByRole('tab', { name: /transcription/i })).toBeVisible();
  });

  test('sidebar navigation is present', async ({ page }) => {
    // Check for navigation elements
    const nav = page.locator('nav, [role="navigation"]');
    await expect(nav.first()).toBeVisible();
  });
});
