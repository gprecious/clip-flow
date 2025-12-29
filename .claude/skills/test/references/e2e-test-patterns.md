# E2E Test Patterns (Playwright)

## Basic Page Test with Tauri Mocking

```typescript
import { test, expect } from '@playwright/test';

test.describe('Home Page', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri APIs via __TAURI_INTERNALS__
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
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

    await page.goto('/');
  });

  test('displays main heading', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });

  test('shows empty state when no directory selected', async ({ page }) => {
    await expect(page.getByText(/select a folder/i)).toBeVisible();
  });
});
```

## Testing Navigation

```typescript
test.describe('Navigation', () => {
  test('navigates to settings page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /settings/i }).click();

    await expect(page).toHaveURL('/settings');
    await expect(page.getByRole('heading', { name: /settings/i })).toBeVisible();
  });

  test('navigates back to home', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('link', { name: /home/i }).click();

    await expect(page).toHaveURL('/');
  });
});
```

## Testing Form Interactions

```typescript
test.describe('Settings Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string, args?: unknown) => {
          switch (cmd) {
            case 'store_api_key':
              return true;
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

  test('saves API key', async ({ page }) => {
    await page.getByLabel(/openai api key/i).fill('sk-test-key');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText(/saved/i)).toBeVisible();
  });

  test('validates API key format', async ({ page }) => {
    await page.getByLabel(/openai api key/i).fill('invalid-key');
    await page.getByRole('button', { name: /save/i }).click();

    await expect(page.getByText(/invalid/i)).toBeVisible();
  });
});
```

## Testing Select/Dropdown

```typescript
test('changes theme setting', async ({ page }) => {
  await page.goto('/settings');

  const themeSelect = page.getByRole('combobox', { name: /theme/i });
  await themeSelect.click();
  await page.getByRole('option', { name: /dark/i }).click();

  // Verify theme applied
  await expect(page.locator('html')).toHaveClass(/dark/);
});
```

## Testing Modal Dialogs

```typescript
test.describe('Modal', () => {
  test('opens modal on button click', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /add folder/i }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('closes modal with close button', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /add folder/i }).click();
    await page.getByRole('button', { name: /close/i }).click();

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });

  test('closes modal with escape key', async ({ page }) => {
    await page.goto('/');

    await page.getByRole('button', { name: /add folder/i }).click();
    await page.keyboard.press('Escape');

    await expect(page.getByRole('dialog')).not.toBeVisible();
  });
});
```

## Testing Dynamic Content

```typescript
test.describe('Transcription', () => {
  test('shows progress during transcription', async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          if (cmd === 'transcribe_media') {
            // Simulate async operation
            await new Promise(r => setTimeout(r, 100));
            return {
              text: 'Hello world',
              segments: [{ start: 0, end: 1, text: 'Hello world' }],
              language: 'en',
              duration: 1,
            };
          }
          return null;
        },
      };
    });

    await page.goto('/');

    // Trigger transcription
    await page.getByRole('button', { name: /transcribe/i }).click();

    // Check progress shows
    await expect(page.getByRole('progressbar')).toBeVisible();

    // Wait for completion
    await expect(page.getByText(/completed/i)).toBeVisible({ timeout: 10000 });
  });
});
```

## Testing Keyboard Navigation

```typescript
test('supports keyboard navigation', async ({ page }) => {
  await page.goto('/');

  // Tab through elements
  await page.keyboard.press('Tab');
  const firstFocusable = page.locator(':focus');
  await expect(firstFocusable).toBeVisible();

  // Press Enter to activate
  await page.keyboard.press('Enter');

  // Verify action happened
});

test('escape closes dropdowns', async ({ page }) => {
  await page.goto('/');

  await page.getByRole('button', { name: /menu/i }).click();
  await expect(page.getByRole('menu')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByRole('menu')).not.toBeVisible();
});
```

## Testing File List

```typescript
test.describe('File Tree', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          if (cmd === 'scan_media_directory_tree') {
            return {
              path: '/mock/videos',
              name: 'videos',
              is_dir: true,
              size: 0,
              modified: Date.now(),
              extension: null,
              children: [
                {
                  path: '/mock/videos/video1.mp4',
                  name: 'video1.mp4',
                  is_dir: false,
                  size: 1024 * 1024,
                  modified: Date.now(),
                  extension: 'mp4',
                  children: [],
                },
                {
                  path: '/mock/videos/video2.mov',
                  name: 'video2.mov',
                  is_dir: false,
                  size: 2048 * 1024,
                  modified: Date.now(),
                  extension: 'mov',
                  children: [],
                },
              ],
            };
          }
          return null;
        },
      };
    });
  });

  test('displays file list', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByText('video1.mp4')).toBeVisible();
    await expect(page.getByText('video2.mov')).toBeVisible();
  });

  test('selects file on click', async ({ page }) => {
    await page.goto('/');

    await page.getByText('video1.mp4').click();
    await expect(page.getByText('video1.mp4').locator('..')).toHaveClass(/selected/);
  });
});
```

## Testing Responsive Design

```typescript
test.describe('Responsive Layout', () => {
  test('sidebar collapses on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto('/');

    // Sidebar should be hidden
    await expect(page.getByRole('navigation')).not.toBeVisible();

    // Menu button should be visible
    await expect(page.getByRole('button', { name: /menu/i })).toBeVisible();
  });

  test('sidebar visible on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');

    await expect(page.getByRole('navigation')).toBeVisible();
  });
});
```

## Testing with localStorage

```typescript
test.describe('Persistence', () => {
  test('remembers last selected directory', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lastDirectory', '/saved/path');
    });

    await page.goto('/');

    // Should restore from localStorage
    await expect(page.getByText('/saved/path')).toBeVisible();
  });
});
```

## Visual Regression Testing

```typescript
test('matches visual snapshot', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page).toHaveScreenshot('home-page.png');
});

test('dark mode snapshot', async ({ page }) => {
  await page.goto('/');
  await page.emulateMedia({ colorScheme: 'dark' });

  await expect(page).toHaveScreenshot('home-page-dark.png');
});
```

## Running E2E Tests

```bash
# Run all E2E tests
npm run test:e2e

# Run with UI mode (interactive)
npm run test:e2e:ui

# Run headed (see browser)
npm run test:e2e:headed

# Run specific test file
npm run test:e2e -- home.spec.ts

# Run tests matching pattern
npm run test:e2e -- -g "navigation"

# Debug mode
npm run test:e2e -- --debug
```
