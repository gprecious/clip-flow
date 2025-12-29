---
name: test
description: Run tests and generate test files for the Clip-Flow project. Use when the user wants to (1) run all tests or specific test types (unit, E2E, Rust), (2) generate new test files following project conventions, (3) help with Tauri API mocking patterns, (4) create test data mocks, (5) check test coverage, or (6) debug failing tests. Supports Vitest for React/TypeScript unit tests, Playwright for E2E tests, and cargo test for Rust backend tests.
---

# Test Skill for Clip-Flow

Run tests and generate test files following Clip-Flow project conventions.

## Quick Commands

### Run Tests

```bash
# Run all unit tests
npm run test

# Run unit tests in watch mode
npm run test:watch

# Run with coverage report
npm run test:coverage

# Run E2E tests
npm run test:e2e

# Run E2E with UI mode
npm run test:e2e:ui

# Run E2E headed (visible browser)
npm run test:e2e:headed

# Run Rust tests (from src-tauri directory)
cd src-tauri && cargo test
```

### Run Specific Tests

```bash
# Run specific unit test file
npm run test -- src/components/ui/Button/Button.test.tsx

# Run tests matching pattern
npm run test -- --grep "MediaContext"

# Run specific E2E test
npm run test:e2e -- home.spec.ts

# Run specific Rust test
cd src-tauri && cargo test test_name
```

## Test File Generation Workflow

1. **Determine test type** - Unit test (.test.tsx), E2E test (.spec.ts), or Rust test
2. **Check for similar existing tests** - Use as reference for patterns
3. **Generate test file** - Follow naming conventions and import patterns
4. **Add appropriate mocks** - Use project's mock utilities

### Unit Test File Naming

| Source File | Test File |
|-------------|-----------|
| `src/components/ui/Button/Button.tsx` | `src/components/ui/Button/Button.test.tsx` |
| `src/components/features/FileTree/FileTree.tsx` | `src/components/features/FileTree/FileTree.test.tsx` |
| `src/context/ThemeContext.tsx` | `src/context/ThemeContext.test.tsx` |
| `src/hooks/useAutoTranscribe.ts` | `src/hooks/useAutoTranscribe.test.tsx` |
| `src/lib/utils/helper.ts` | `src/lib/utils/helper.test.ts` |
| `src/pages/HomePage.tsx` | `src/pages/HomePage.test.tsx` |

### E2E Test File Naming

E2E tests go in `e2e/` directory: `e2e/{feature}.spec.ts`

## Test Utilities

### Provider Wrappers

Import from `@/test/test-utils`:

```typescript
import { render, AllProviders, MinimalProviders, RouterOnly } from '@/test/test-utils';

// Full integration test (all providers)
render(<Component />, { wrapper: AllProviders });

// Without MediaProvider (lighter weight)
render(<Component />, { wrapper: 'minimal' });

// Router only (minimal)
render(<Component />, { wrapper: 'router' });
```

### Mock Data

Import from `@/test/mocks/media-data`:

```typescript
import {
  mockSegments,           // TranscriptionSegment[]
  mockPendingFile,        // MediaFile in pending state
  mockCompletedFile,      // MediaFile with transcription
  mockErrorFile,          // MediaFile in error state
  mockDirectoryNode,      // DirectoryNode from Tauri
  mockFolderWithFiles,    // MediaFolder
  createMockMediaFile,    // Factory function
  createMockFolder,       // Factory function
} from '@/test/mocks/media-data';
```

### Tauri Command Mocking

Import from `@/test/mocks/tauri`:

```typescript
import { mockTauriCommands, mockResponses, setupTauriMocks } from '@/test/mocks/tauri';

beforeEach(() => {
  setupTauriMocks();
  mockResponses.whisperAvailable(true);
  mockResponses.installedModels(['base', 'small']);
});
```

## Essential Imports for Tests

### Unit Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AllProviders } from '@/test/test-utils';
```

### Hook Test Template

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { AllProviders } from '@/test/test-utils';
```

### E2E Test Template

```typescript
import { test, expect } from '@playwright/test';
```

## Resources

For detailed patterns and examples, see:

- **Unit Test Patterns**: `references/unit-test-patterns.md` - Vitest component, hook, and context testing
- **E2E Test Patterns**: `references/e2e-test-patterns.md` - Playwright browser testing
- **Rust Test Patterns**: `references/rust-test-patterns.md` - cargo test patterns
- **Tauri Mocking Guide**: `references/tauri-mocking-guide.md` - Complete mocking reference
