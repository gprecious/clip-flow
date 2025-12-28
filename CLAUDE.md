# Clip-Flow Development Guidelines

## Project Overview

Clip-Flow is a desktop application built with:
- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Rust + Tauri v2
- **Testing**: Vitest (unit), Playwright (E2E), Rust tests

## Testing Requirements

### General Rules

1. **All new features MUST include tests** - No PR should be merged without corresponding test coverage
2. **Follow existing patterns** - Look at similar test files for reference
3. **Test behavior, not implementation** - Focus on what the code does, not how it does it

---

## Frontend Unit Tests (Vitest)

### File Naming Convention
```
src/
  components/
    features/
      ComponentName/
        ComponentName.tsx
        ComponentName.test.tsx  # Test file
    ui/
      Button/
        Button.tsx
        Button.test.tsx
  context/
    SomeContext.tsx
    SomeContext.test.tsx
  hooks/
    useCustomHook.ts
    useCustomHook.test.tsx  # Use .tsx if JSX is needed
  lib/
    utils/
      helper.ts
      helper.test.ts
```

### Running Tests
```bash
# Run all tests
npm run test

# Run tests in watch mode
npm run test:watch

# Run specific test file
npm run test -- src/components/ui/Button/Button.test.tsx
```

### Tauri Mocking Pattern

Since Tauri commands don't work in test environment, mock them at the top of test files:

```typescript
import { vi } from 'vitest';

// Mock the @/lib/tauri module BEFORE other imports
vi.mock('@/lib/tauri', () => ({
  scanMediaDirectoryTree: vi.fn(),
  startWatchingDirectory: vi.fn(),
  stopWatchingDirectory: vi.fn(),
  onFileChange: vi.fn(() => Promise.resolve(() => {})),
  // Add other commands as needed
}));

// Then import the mocked module
import * as tauriModule from '@/lib/tauri';

// In beforeEach, set up mock implementations
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue({
    path: '/test/path',
    name: 'path',
    is_dir: true,
    size: 0,
    modified: Date.now(),
    extension: null,
    children: [],
  });
});
```

### Test Wrapper for Components

Use the providers from `@/test/test-utils.tsx`:

```typescript
import { render } from '@testing-library/react';
import { AllProviders } from '@/test/test-utils';

// For components that need all providers
render(<MyComponent />, { wrapper: AllProviders });

// Or create a custom wrapper if accessing context values:
let contextValue: ReturnType<typeof useMyContext> | null = null;

function ContextCapture({ children }) {
  const value = useMyContext();
  contextValue = value;
  return <>{children}</>;
}

const wrapper = ({ children }) => (
  <AllProviders>
    <ContextCapture>{children}</ContextCapture>
  </AllProviders>
);
```

### Test Mock Data

Use the mock data from `@/test/mocks/media-data.ts`:

```typescript
import { mockDirectoryNode, mockSegments } from '@/test/mocks/media-data';
```

---

## E2E Tests (Playwright)

### File Location
```
e2e/
  home.spec.ts
  settings.spec.ts
  models.spec.ts
  transcription.spec.ts
```

### Running E2E Tests
```bash
# Run E2E tests
npm run test:e2e

# Run with UI mode
npm run test:e2e:ui

# Run headed (visible browser)
npm run test:e2e:headed
```

### E2E Test Pattern

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Mock Tauri APIs for browser testing
    await page.addInitScript(() => {
      (window as any).__TAURI_INTERNALS__ = {
        invoke: async (cmd: string) => {
          switch (cmd) {
            case 'command_name':
              return mockData;
            default:
              return null;
          }
        },
      };
    });

    await page.goto('/');
  });

  test('should do something', async ({ page }) => {
    await expect(page.getByText(/expected text/i)).toBeVisible();
  });
});
```

---

## Rust Backend Tests

### Location
Tests are written as `#[cfg(test)]` modules within each source file:

```rust
// src/services/my_service.rs

pub fn my_function() -> Result<String, Error> {
    // Implementation
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[test]
    fn test_my_function_success() {
        let result = my_function();
        assert!(result.is_ok());
    }

    #[test]
    fn test_my_function_error_case() {
        // Test error handling
    }
}
```

### Running Rust Tests
```bash
# From src-tauri directory
cargo test

# Run specific test
cargo test test_name

# Run with output
cargo test -- --nocapture
```

### Test Dependencies
The following are available for tests in `Cargo.toml`:
- `tempfile = "3"` - For creating temporary directories/files

---

## Test Checklist for PRs

Before submitting a PR, ensure:

- [ ] Unit tests added for new functions/components
- [ ] Tests pass locally (`npm run test` and `cargo test`)
- [ ] No console errors in tests
- [ ] Mocks are properly set up for Tauri commands
- [ ] Test file follows naming convention (`*.test.tsx` or `*.test.ts`)
- [ ] Tests cover both success and error cases
- [ ] Integration tests added for complex features

---

## Common Test Patterns

### Testing Context Updates

```typescript
it('updates state correctly', async () => {
  const { result } = renderHook(() => useMyContext(), { wrapper });

  await act(async () => {
    await result.current.someAction();
  });

  expect(result.current.state.value).toBe(expectedValue);
});
```

### Testing Async Operations

```typescript
it('handles async operation', async () => {
  render(<MyComponent />, { wrapper });

  // Wait for async content
  expect(await screen.findByText('Loaded')).toBeInTheDocument();
});
```

### Testing User Interactions

```typescript
it('responds to user click', async () => {
  render(<MyComponent />, { wrapper });

  const button = screen.getByRole('button', { name: /submit/i });
  fireEvent.click(button);

  await waitFor(() => {
    expect(screen.getByText('Success')).toBeInTheDocument();
  });
});
```

### Testing Multiple Elements

```typescript
it('renders list correctly', async () => {
  render(<MyList />, { wrapper });

  const items = await screen.findAllByRole('listitem');
  expect(items).toHaveLength(3);
});
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Run unit tests | `npm run test` |
| Run unit tests (watch) | `npm run test:watch` |
| Run E2E tests | `npm run test:e2e` |
| Run Rust tests | `cargo test` (in src-tauri) |
| Run all checks | `npm run test && cargo test` |
