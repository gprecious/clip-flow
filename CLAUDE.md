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

## Remote Server (Local Network)

- **IP**: ***REDACTED_IP***
- **User**: root
- **Password**: ***REDACTED***
- **Key file**: /Users/taejin/Documents/dev/qplace/***REDACTED*** (참고용, 비밀번호 인증 사용)
- **OS**: Debian 12 (Proxmox VE)
- **DAS 드라이브**: /dev/sdb1 (7.3TB, ext4) → /mnt/das 에 마운트

### SSH 접속 명령어
```bash
sshpass -p '***REDACTED***' ssh root@***REDACTED_IP***
```

### DAS 드라이브 구조
- `/mnt/das/media` - 미디어 파일
- `/mnt/das/images` - 이미지
- `/mnt/das/dump` - 덤프
- `/mnt/das/import` - 가져오기
- `/mnt/das/private` - 개인 파일
- `/mnt/das/template` - 템플릿

### 맥북에서 네트워크 드라이브 연결 (SMB)
- **SMB 주소**: smb://***REDACTED_IP***/das
- **사용자**: tjej
- **비밀번호**: ***REDACTED***
- **마운트 위치**: /Volumes/das

**Finder에서 연결:**
1. Finder → 이동 → 서버에 연결 (⌘K)
2. `smb://***REDACTED_IP***/das` 입력
3. 사용자: tjej, 비밀번호: ***REDACTED***

**터미널에서 연결:**
```bash
open "smb://tjej@***REDACTED_IP***/das"
```
