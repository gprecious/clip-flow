# Clip-Flow Development Guidelines

## Project Overview

- **Frontend**: React 19 + TypeScript + Vite
- **Backend**: Rust + Tauri v2
- **Testing**: Vitest (unit), Playwright (E2E), Rust tests

## Testing Rules

1. **All new features MUST include tests**
2. **Follow existing patterns** - Look at similar test files for reference
3. **Auto-update tests on code changes**:
   - Update existing test files if the change affects tested behavior
   - Add new test cases for new functionality
   - Update mock data in `@/test/mocks/` when types change

## File Structure

```
src/
  components/features/ComponentName/ComponentName.test.tsx
  components/ui/Button/Button.test.tsx
  context/SomeContext.test.tsx
  hooks/useCustomHook.test.tsx
  lib/utils/helper.test.ts

e2e/
  home.spec.ts
  settings.spec.ts

src-tauri/src/services/
  my_service.rs  # Contains #[cfg(test)] mod tests {}
```

## Frontend Tests (Vitest)

### Tauri Mocking (Required)

Tauri commands must be mocked. Always mock `@/lib/tauri` BEFORE other imports:

```typescript
import { vi } from 'vitest';

vi.mock('@/lib/tauri', () => ({
  someCommand: vi.fn(),
  onEvent: vi.fn(() => Promise.resolve(() => {})),
}));

import * as tauriModule from '@/lib/tauri';

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(tauriModule.someCommand).mockResolvedValue(mockData);
});
```

### Component Rendering

```typescript
import { render } from '@testing-library/react';
import { AllProviders } from '@/test/test-utils';

render(<MyComponent />, { wrapper: AllProviders });
```

### Mock Data

Use existing mocks from `@/test/mocks/media-data.ts`

## E2E Tests (Playwright)

Mock Tauri APIs via `page.addInitScript`:

```typescript
await page.addInitScript(() => {
  (window as any).__TAURI_INTERNALS__ = {
    invoke: async (cmd: string) => { /* return mock data */ },
  };
});
```

## Rust Tests

Write tests as `#[cfg(test)]` modules within source files. Use `tempfile` crate for temp directories.
