# Tauri Mocking Guide

## Available Mock Commands

The following Tauri commands are mocked in `@/test/mocks/tauri.ts`:

### Directory Commands
| Command | Description |
|---------|-------------|
| `scan_media_directory` | Scan files in directory |
| `scan_media_directory_tree` | Scan files recursively |
| `start_watching_directory` | Start file watcher |
| `stop_watching_directory` | Stop file watcher |
| `get_watched_directory` | Get current watched path |
| `is_media_file` | Check if file is media |

### Transcription Commands
| Command | Description |
|---------|-------------|
| `transcribe_media` | Transcribe media file |
| `transcribe_audio` | Transcribe audio only |
| `check_whisper_available` | Check whisper.cpp installed |
| `install_whisper_cpp` | Install whisper.cpp |

### Model Commands
| Command | Description |
|---------|-------------|
| `get_available_models` | List downloadable models |
| `get_installed_models` | List installed models |
| `get_models_status` | Get model install status |
| `download_model` | Download a model |
| `delete_model` | Delete a model |

### API Key Commands
| Command | Description |
|---------|-------------|
| `store_api_key` | Store API key securely |
| `get_api_key_masked` | Get masked key |
| `delete_api_key` | Delete API key |
| `get_api_key_status` | Check key exists |

### External Service Commands
| Command | Description |
|---------|-------------|
| `validate_openai_key` | Validate OpenAI key |
| `openai_transcribe` | Transcribe via OpenAI |
| `openai_chat` | Chat via OpenAI |
| `claude_chat` | Chat via Claude |
| `check_ollama` | Check Ollama running |
| `list_ollama_models` | List Ollama models |
| `ollama_generate` | Generate via Ollama |
| `pull_ollama_model` | Pull Ollama model |
| `delete_ollama_model` | Delete Ollama model |

### FFmpeg Commands
| Command | Description |
|---------|-------------|
| `check_ffmpeg_available` | Check FFmpeg installed |
| `extract_audio` | Extract audio from video |

## Unit Test Mocking Pattern

### Step 1: Mock BEFORE Imports

```typescript
import { vi } from 'vitest';

// 1. Mock BEFORE importing components that use Tauri
vi.mock('@/lib/tauri', () => ({
  scanMediaDirectoryTree: vi.fn(),
  startWatchingDirectory: vi.fn(),
  stopWatchingDirectory: vi.fn(),
  onFileChange: vi.fn(() => Promise.resolve(() => {})),
  checkWhisperAvailable: vi.fn(),
  getInstalledModels: vi.fn(),
}));
```

### Step 2: Import Mocked Module

```typescript
// 2. Import mocked module for access
import * as tauriModule from '@/lib/tauri';
```

### Step 3: Configure in beforeEach

```typescript
import { mockDirectoryNode } from '@/test/mocks/media-data';

beforeEach(() => {
  vi.clearAllMocks();

  // 3. Set up mock implementations
  vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue(mockDirectoryNode);
  vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(true);
  vi.mocked(tauriModule.getInstalledModels).mockResolvedValue(['base', 'small']);
});
```

## Using mockResponses Helpers

```typescript
import { mockResponses, setupTauriMocks } from '@/test/mocks/tauri';

beforeEach(() => {
  setupTauriMocks();

  // Directory mocks
  mockResponses.emptyDirectory();
  // or
  mockResponses.directoryWithFiles([
    { name: 'video.mp4', size: 1024 * 1024 },
    { name: 'audio.mp3', size: 512 * 1024 },
  ]);

  // Model mocks
  mockResponses.whisperAvailable(true);
  mockResponses.installedModels(['base', 'small', 'medium']);
  mockResponses.modelsStatus({
    base: { installed: true, size: 140 },
    small: { installed: true, size: 470 },
    large: { installed: false },
  });

  // API key mocks
  mockResponses.apiKeyStatus('openai', true);

  // Transcription mocks
  mockResponses.transcriptionSuccess('Hello world', [
    { start: 0, end: 1.5, text: 'Hello' },
    { start: 1.5, end: 3, text: 'world' },
  ]);
  // or for error
  mockResponses.transcriptionError('Model not found');

  // Ollama mocks
  mockResponses.ollamaRunning(true);
  mockResponses.ollamaModels(['llama2', 'codellama']);
});
```

## Mocking Individual Commands

```typescript
import { mockTauriCommands } from '@/test/mocks/tauri';

// Mock to return specific value
mockTauriCommands.transcribe_media.mockResolvedValue({
  text: 'Transcribed text here',
  segments: [{ start: 0, end: 5, text: 'Transcribed text here' }],
  language: 'en',
  duration: 5,
});

// Mock to throw error
mockTauriCommands.download_model.mockRejectedValue(
  new Error('Network error')
);

// Mock with implementation
mockTauriCommands.extract_audio.mockImplementation(async (args) => {
  if (args.input_path.includes('corrupt')) {
    throw new Error('Corrupt file');
  }
  return '/tmp/output.wav';
});
```

## E2E Test Mocking (Playwright)

For Playwright E2E tests, mock via `page.addInitScript`:

```typescript
test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as Record<string, unknown>).__TAURI_INTERNALS__ = {
      invoke: async (cmd: string, args?: unknown) => {
        switch (cmd) {
          case 'scan_media_directory_tree':
            return {
              path: '/mock/path',
              name: 'path',
              is_dir: true,
              size: 0,
              modified: Date.now(),
              extension: null,
              children: [
                {
                  path: '/mock/path/video.mp4',
                  name: 'video.mp4',
                  is_dir: false,
                  size: 1024 * 1024,
                  modified: Date.now(),
                  extension: 'mp4',
                  children: [],
                },
              ],
            };

          case 'transcribe_media':
            return {
              text: 'Hello world',
              segments: [{ start: 0, end: 1, text: 'Hello world' }],
              language: 'en',
              duration: 1,
            };

          case 'check_whisper_available':
            return true;

          case 'get_installed_models':
            return ['base', 'small'];

          case 'get_api_key_status':
            return { openai: true, claude: false };

          case 'check_ffmpeg_available':
            return true;

          default:
            console.warn('Unmocked Tauri command:', cmd);
            return null;
        }
      },
    };
  });

  await page.goto('/');
});
```

## Common Mock Data Imports

```typescript
import {
  // Files
  mockPendingFile,        // MediaFile in 'pending' status
  mockCompletedFile,      // MediaFile with transcription
  mockExtractingFile,     // MediaFile in 'extracting' status
  mockTranscribingFile,   // MediaFile in 'transcribing' status
  mockErrorFile,          // MediaFile in 'error' status
  mockAudioFile,          // Audio file (no extraction needed)

  // Folders
  mockEmptyFolder,        // Empty MediaFolder
  mockFolderWithFiles,    // MediaFolder with children
  mockNestedFolder,       // Nested folder structure

  // Directory nodes (Tauri response)
  mockDirectoryNode,      // DirectoryNode from Tauri
  mockNestedDirectoryNode, // Nested DirectoryNode

  // Segments
  mockSegments,           // TranscriptionSegment[]

  // Factory functions
  createMockMediaFile,    // Create custom MediaFile
  createMockFolder,       // Create custom MediaFolder
} from '@/test/mocks/media-data';
```

## Mock Factory Functions

```typescript
import { createMockMediaFile, createMockFolder } from '@/test/mocks/media-data';

// Create custom media file
const customFile = createMockMediaFile({
  id: 'custom-1',
  name: 'my-video.mp4',
  path: '/custom/path/my-video.mp4',
  status: 'completed',
  transcription: {
    text: 'Custom transcription',
    segments: [],
    language: 'ko',
    duration: 120,
  },
});

// Create custom folder
const customFolder = createMockFolder({
  id: 'folder-1',
  name: 'My Folder',
  path: '/custom/path',
  children: [customFile],
});
```

## Testing Tauri Event Listeners

```typescript
import { vi } from 'vitest';

vi.mock('@/lib/tauri', () => ({
  onFileChange: vi.fn((callback) => {
    // Store callback for later invocation
    (global as any).__fileChangeCallback = callback;
    return Promise.resolve(() => {});
  }),
}));

// In test
it('responds to file changes', async () => {
  render(<FileWatcher />, { wrapper: AllProviders });

  // Simulate file change event
  await act(async () => {
    (global as any).__fileChangeCallback({
      path: '/new/file.mp4',
      event: 'create',
    });
  });

  expect(screen.getByText('file.mp4')).toBeInTheDocument();
});
```

## Complete Test Example

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { AllProviders } from '@/test/test-utils';
import { mockDirectoryNode, mockCompletedFile } from '@/test/mocks/media-data';

// Mock Tauri before imports
vi.mock('@/lib/tauri', () => ({
  scanMediaDirectoryTree: vi.fn(),
  startWatchingDirectory: vi.fn(),
  stopWatchingDirectory: vi.fn(),
  onFileChange: vi.fn(() => Promise.resolve(() => {})),
  transcribeMedia: vi.fn(),
  checkWhisperAvailable: vi.fn(),
  getInstalledModels: vi.fn(),
}));

import * as tauriModule from '@/lib/tauri';
import { MediaList } from './MediaList';

describe('MediaList', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mocks
    vi.mocked(tauriModule.scanMediaDirectoryTree).mockResolvedValue(mockDirectoryNode);
    vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(true);
    vi.mocked(tauriModule.getInstalledModels).mockResolvedValue(['base']);
  });

  it('displays files from directory', async () => {
    render(<MediaList />, { wrapper: AllProviders });

    await waitFor(() => {
      expect(screen.getByText('video.mp4')).toBeInTheDocument();
    });
  });

  it('handles transcription', async () => {
    vi.mocked(tauriModule.transcribeMedia).mockResolvedValue({
      text: 'Hello world',
      segments: [],
      language: 'en',
      duration: 10,
    });

    render(<MediaList />, { wrapper: AllProviders });

    // ... trigger transcription and assert
  });

  it('shows error when whisper unavailable', async () => {
    vi.mocked(tauriModule.checkWhisperAvailable).mockResolvedValue(false);

    render(<MediaList />, { wrapper: AllProviders });

    await waitFor(() => {
      expect(screen.getByText(/whisper not installed/i)).toBeInTheDocument();
    });
  });
});
```
