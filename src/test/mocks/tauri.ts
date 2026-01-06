import { vi, type Mock } from 'vitest';

// Type for Tauri command mock functions
type MockFn = Mock<(args?: unknown) => Promise<unknown>>;

/**
 * Mock implementations for all Tauri commands
 */
export const mockTauriCommands: Record<string, MockFn> = {
  // Directory commands
  scan_media_directory: vi.fn(),
  scan_media_directory_tree: vi.fn(),
  start_watching_directory: vi.fn(),
  stop_watching_directory: vi.fn(),
  get_watched_directory: vi.fn(),
  is_media_file: vi.fn(),

  // Transcription commands
  transcribe_media: vi.fn(),
  transcribe_audio: vi.fn(),
  check_whisper_available: vi.fn(),
  install_whisper_cpp: vi.fn(),

  // Model commands
  get_available_models: vi.fn(),
  get_installed_models: vi.fn(),
  get_models_status: vi.fn(),
  download_model: vi.fn(),
  delete_model: vi.fn(),

  // API key commands
  store_api_key: vi.fn(),
  get_api_key_masked: vi.fn(),
  delete_api_key: vi.fn(),
  get_api_key_status: vi.fn(),

  // OpenAI commands
  validate_openai_key: vi.fn(),
  openai_transcribe: vi.fn(),
  openai_chat: vi.fn(),

  // Claude commands
  claude_chat: vi.fn(),

  // Ollama commands
  check_ollama: vi.fn(),
  list_ollama_models: vi.fn(),
  ollama_generate: vi.fn(),
  pull_ollama_model: vi.fn(),
  delete_ollama_model: vi.fn(),

  // FFmpeg commands
  check_ffmpeg: vi.fn(),
  get_ffmpeg_version: vi.fn(),
  get_media_info: vi.fn(),
  get_media_duration: vi.fn(),
  extract_audio: vi.fn(),

  // Additional model commands
  is_model_installed: vi.fn(),
  get_models_directory: vi.fn(),

  // Additional Ollama commands
  ollama_chat: vi.fn(),
  summarize_text: vi.fn(),
  extract_story_order: vi.fn(),

  // Additional OpenAI commands
  validate_openai_key_direct: vi.fn(),
  openai_summarize: vi.fn(),
  fetch_openai_models: vi.fn(),
  fetch_openai_models_direct: vi.fn(),

  // Additional Claude commands
  validate_claude_key: vi.fn(),
  validate_claude_key_direct: vi.fn(),
  claude_summarize: vi.fn(),
  get_claude_models: vi.fn(),
  fetch_claude_models: vi.fn(),
  fetch_claude_models_direct: vi.fn(),
};

/**
 * Set up Tauri mock to intercept invoke calls
 * Call this in beforeEach() to reset mocks between tests
 */
export function setupTauriMocks() {
  const tauriCore = require('@tauri-apps/api/core');

  tauriCore.invoke.mockImplementation((cmd: string, args?: unknown) => {
    const mockFn = mockTauriCommands[cmd];
    if (mockFn) {
      return mockFn(args);
    }
    console.warn(`Unmocked Tauri command: ${cmd}`);
    return Promise.reject(new Error(`Unmocked Tauri command: ${cmd}`));
  });
}

/**
 * Reset all Tauri command mocks
 */
export function resetTauriMocks() {
  Object.values(mockTauriCommands).forEach((mock) => mock.mockReset());
}

/**
 * Helper to set up common mock responses
 */
export const mockResponses = {
  // Directory scanning
  emptyDirectory: () => {
    mockTauriCommands.scan_media_directory_tree.mockResolvedValue({
      path: '/test/path',
      name: 'path',
      is_dir: true,
      size: 0,
      modified: Date.now(),
      extension: null,
      children: [],
    });
  },

  directoryWithFiles: (files: Array<{ name: string; size?: number; extension?: string }>) => {
    mockTauriCommands.scan_media_directory_tree.mockResolvedValue({
      path: '/test/path',
      name: 'path',
      is_dir: true,
      size: 0,
      modified: Date.now(),
      extension: null,
      children: files.map((file) => ({
        path: `/test/path/${file.name}`,
        name: file.name,
        is_dir: false,
        size: file.size ?? 1024 * 1024,
        modified: Date.now(),
        extension: file.extension ?? file.name.split('.').pop() ?? null,
        children: [],
      })),
    });
  },

  // Whisper availability
  whisperAvailable: (available: boolean = true) => {
    mockTauriCommands.check_whisper_available.mockResolvedValue(available);
  },

  // Models
  installedModels: (models: string[]) => {
    mockTauriCommands.get_installed_models.mockResolvedValue(models);
  },

  modelsStatus: (status: Record<string, { installed: boolean; size?: number }>) => {
    mockTauriCommands.get_models_status.mockResolvedValue(status);
  },

  // API keys
  apiKeyStatus: (provider: string, hasKey: boolean) => {
    mockTauriCommands.get_api_key_status.mockResolvedValue({ [provider]: hasKey });
  },

  // Transcription result
  transcriptionSuccess: (text: string, segments?: Array<{ start: number; end: number; text: string }>) => {
    mockTauriCommands.transcribe_media.mockResolvedValue({
      text,
      segments: segments ?? [{ start: 0, end: 1, text }],
      language: 'en',
      duration: 60,
    });
  },

  transcriptionError: (error: string) => {
    mockTauriCommands.transcribe_media.mockRejectedValue(new Error(error));
  },

  // Ollama
  ollamaRunning: (running: boolean = true) => {
    mockTauriCommands.check_ollama.mockResolvedValue(running);
  },

  ollamaModels: (models: string[]) => {
    mockTauriCommands.list_ollama_models.mockResolvedValue(
      models.map((name) => ({ name, size: 1024 * 1024 * 1024 }))
    );
  },
};
