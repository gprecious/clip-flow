import { test, expect } from '@playwright/test';

test.describe('Transcription Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri APIs with files for browser testing
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          switch (cmd) {
            case 'scan_media_directory_tree':
              return {
                path: '/mock/videos',
                name: 'videos',
                is_dir: true,
                size: 0,
                modified: Date.now(),
                extension: null,
                children: [
                  {
                    path: '/mock/videos/test-video.mp4',
                    name: 'test-video.mp4',
                    is_dir: false,
                    size: 1024 * 1024 * 50,
                    modified: Date.now(),
                    extension: 'mp4',
                    children: [],
                  },
                  {
                    path: '/mock/videos/audio.mp3',
                    name: 'audio.mp3',
                    is_dir: false,
                    size: 1024 * 1024 * 5,
                    modified: Date.now(),
                    extension: 'mp3',
                    children: [],
                  },
                ],
              };
            case 'start_watching_directory':
            case 'stop_watching_directory':
              return undefined;
            case 'check_whisper_available':
              return true;
            case 'get_installed_models':
              return ['base'];
            case 'get_api_key_status':
              return { openai: false, claude: false };
            case 'transcribe_media':
              return {
                segments: [
                  { start: 0, end: 5, text: 'Hello, this is a test transcription.' },
                  { start: 5, end: 10, text: 'The audio quality is good.' },
                ],
                full_text: 'Hello, this is a test transcription. The audio quality is good.',
                language: 'en',
                duration: 10,
              };
            default:
              return null;
          }
        },
      };

      // Mock localStorage to simulate folder selection
      localStorage.setItem('clip-flow-media-root-path', '/mock/videos');
    });

    await page.goto('/');
  });

  test('shows files in list', async ({ page }) => {
    // Wait for file list to load and check for file buttons
    await expect(page.getByRole('button', { name: 'test-video.mp4' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'audio.mp3' })).toBeVisible();
  });

  test('shows file count in header', async ({ page }) => {
    // Should show "Files (2)" in heading
    await expect(page.getByRole('heading', { name: /files.*2/i })).toBeVisible();
  });

  test('file selection updates inspector', async ({ page }) => {
    // Click on a file in the tree
    const fileButton = page.getByRole('button', { name: 'test-video.mp4' });
    await fileButton.click();

    // Inspector should show file heading (h3 specifically)
    await expect(page.getByRole('heading', { name: 'test-video.mp4', level: 3 })).toBeVisible();
    // And file size
    await expect(page.getByText('50 MB')).toBeVisible();
  });

  test('shows transcription tabs when file selected', async ({ page }) => {
    // Click on a file first
    await page.getByRole('button', { name: 'test-video.mp4' }).click();

    // Look for tabs (Script, Segments)
    await expect(page.getByRole('tab', { name: /script/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /segments/i })).toBeVisible();
  });

  test('can switch between tabs', async ({ page }) => {
    // Click on a file first
    await page.getByRole('button', { name: 'test-video.mp4' }).click();

    const segmentsTab = page.getByRole('tab', { name: /segments/i });
    const scriptTab = page.getByRole('tab', { name: /script/i });

    // Switch to segments tab
    await segmentsTab.click();
    await expect(segmentsTab).toHaveAttribute('aria-selected', 'true');

    // Switch back to script tab
    await scriptTab.click();
    await expect(scriptTab).toHaveAttribute('aria-selected', 'true');
  });

  test('shows transcription content', async ({ page }) => {
    // Click on a file
    await page.getByRole('button', { name: 'test-video.mp4' }).click();

    // Should show transcription text
    await expect(page.getByText(/Hello, this is a test transcription/i)).toBeVisible();
  });

  test('shows watching status', async ({ page }) => {
    // Should show "Watching" status for the directory
    await expect(page.getByText('Watching')).toBeVisible();
  });
});
