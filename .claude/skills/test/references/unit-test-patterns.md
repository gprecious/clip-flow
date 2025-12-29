# Unit Test Patterns (Vitest)

## Basic Component Test

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with default props', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click</Button>);
    fireEvent.click(screen.getByRole('button'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when loading', () => {
    render(<Button loading>Loading</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('applies variant classes', () => {
    render(<Button variant="destructive">Delete</Button>);
    expect(screen.getByRole('button')).toHaveClass('bg-destructive');
  });
});
```

## Context Testing Pattern

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MediaProvider, useMedia } from './MediaContext';
import { mockDirectoryNode } from '@/test/mocks/media-data';
import type { ReactNode } from 'react';

// Mock Tauri module BEFORE importing components
vi.mock('@/lib/tauri', () => ({
  scanMediaDirectoryTree: vi.fn(),
  startWatchingDirectory: vi.fn(),
  stopWatchingDirectory: vi.fn(),
  onFileChange: vi.fn(() => Promise.resolve(() => {})),
}));

import * as tauriModule from '@/lib/tauri';

const wrapper = ({ children }: { children: ReactNode }) => (
  <MediaProvider>{children}</MediaProvider>
);

describe('MediaContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue(mockDirectoryNode);
  });

  it('provides initial state', () => {
    const { result } = renderHook(() => useMedia(), { wrapper });

    expect(result.current.state.rootPath).toBeNull();
    expect(result.current.state.isLoading).toBe(false);
  });

  it('scans directory when setRootDirectory is called', async () => {
    const { result } = renderHook(() => useMedia(), { wrapper });

    await act(async () => {
      await result.current.setRootDirectory('/test/path');
    });

    expect(tauriModule.scanMediaDirectoryTree).toHaveBeenCalledWith('/test/path');
    expect(result.current.state.rootPath).toBe('/test/path');
  });

  it('handles scan error gracefully', async () => {
    vi.mocked(tauriModule.scanMediaDirectoryTree).mockRejectedValue(
      new Error('Directory not found')
    );

    const { result } = renderHook(() => useMedia(), { wrapper });

    await act(async () => {
      await result.current.setRootDirectory('/invalid/path');
    });

    expect(result.current.state.error).toBe('Directory not found');
  });
});
```

## Hook Testing Pattern

```typescript
import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAutoTranscribe } from './useAutoTranscribe';
import { AllProviders } from '@/test/test-utils';

describe('useAutoTranscribe', () => {
  const wrapper = AllProviders;

  it('returns initial state', () => {
    const { result } = renderHook(() => useAutoTranscribe(), { wrapper });

    expect(result.current.isProcessing).toBe(false);
    expect(result.current.queue).toEqual([]);
  });

  it('adds files to queue', () => {
    const { result } = renderHook(() => useAutoTranscribe(), { wrapper });

    act(() => {
      result.current.addToQueue('/path/to/file.mp4');
    });

    expect(result.current.queue).toContain('/path/to/file.mp4');
  });

  it('processes queue items', async () => {
    const { result } = renderHook(() => useAutoTranscribe(), { wrapper });

    act(() => {
      result.current.addToQueue('/path/to/file.mp4');
    });

    await act(async () => {
      await result.current.startProcessing();
    });

    expect(result.current.isProcessing).toBe(true);
  });
});
```

## Testing Async Operations

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AllProviders } from '@/test/test-utils';
import { FileList } from './FileList';

describe('FileList', () => {
  it('shows loading then content', async () => {
    render(<FileList />, { wrapper: AllProviders });

    // Initially shows loading
    expect(screen.getByText(/loading/i)).toBeInTheDocument();

    // Wait for content
    await waitFor(() => {
      expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
    });

    expect(await screen.findByText('video.mp4')).toBeInTheDocument();
  });

  it('shows error message on failure', async () => {
    // Mock to throw error
    vi.mocked(tauriModule.scanMediaDirectory).mockRejectedValue(
      new Error('Failed to load')
    );

    render(<FileList />, { wrapper: AllProviders });

    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

## Testing User Events with userEvent

```typescript
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchInput } from './SearchInput';

describe('SearchInput', () => {
  it('calls onSearch after typing', async () => {
    const user = userEvent.setup();
    const onSearch = vi.fn();

    render(<SearchInput onSearch={onSearch} />);

    await user.type(screen.getByRole('textbox'), 'hello');

    expect(onSearch).toHaveBeenCalledWith('hello');
  });

  it('clears input on escape', async () => {
    const user = userEvent.setup();

    render(<SearchInput />);
    const input = screen.getByRole('textbox');

    await user.type(input, 'hello');
    await user.keyboard('{Escape}');

    expect(input).toHaveValue('');
  });
});
```

## Testing Multiple Elements

```typescript
it('renders list correctly', async () => {
  render(<MediaList />, { wrapper: AllProviders });

  const items = await screen.findAllByRole('listitem');
  expect(items).toHaveLength(3);
});

it('filters items correctly', async () => {
  render(<MediaList filter="video" />, { wrapper: AllProviders });

  const items = await screen.findAllByRole('listitem');
  items.forEach(item => {
    expect(item).toHaveTextContent(/\.mp4|\.mov|\.avi/);
  });
});
```

## Testing Ref Forwarding

```typescript
it('forwards ref correctly', () => {
  const ref = vi.fn();
  render(<Button ref={ref}>Click</Button>);

  expect(ref).toHaveBeenCalled();
  expect(ref.mock.calls[0][0]).toBeInstanceOf(HTMLButtonElement);
});

// Or using createRef
it('forwards ref with createRef', () => {
  const ref = React.createRef<HTMLButtonElement>();
  render(<Button ref={ref}>Click</Button>);

  expect(ref.current).toBeInstanceOf(HTMLButtonElement);
});
```

## Snapshot Testing

```typescript
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Badge } from './Badge';

describe('Badge', () => {
  it('matches snapshot', () => {
    const { container } = render(<Badge variant="success">Done</Badge>);
    expect(container.firstChild).toMatchSnapshot();
  });
});
```

## Testing Context with Custom Wrapper

```typescript
import { render } from '@testing-library/react';
import { ThemeProvider, useTheme } from './ThemeContext';

// Capture context value for assertions
let capturedContext: ReturnType<typeof useTheme> | null = null;

function ContextCapture({ children }: { children: React.ReactNode }) {
  capturedContext = useTheme();
  return <>{children}</>;
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider>
    <ContextCapture>{children}</ContextCapture>
  </ThemeProvider>
);

it('provides theme value', () => {
  render(<div />, { wrapper });
  expect(capturedContext?.theme).toBe('light');
});
```
