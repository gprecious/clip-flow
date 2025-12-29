import { invoke } from '@tauri-apps/api/core';
import type {
  MediaInfo,
  WhisperModel,
  ModelStatus,
  TranscriptionResult,
  OllamaModel,
  ChatMessage,
  StorySegment,
  TranscriptionSegment,
  ApiKeyStatus,
  OpenAIModel,
  ClaudeModel,
  OpenAITranscriptionResult,
  ChatMessageInput,
  FileEntry,
  DirectoryNode,
} from './types';

// =============================================================================
// FFmpeg Commands
// =============================================================================

/**
 * Check if FFmpeg is available on the system
 */
export async function checkFfmpeg(): Promise<boolean> {
  return invoke<boolean>('check_ffmpeg');
}

/**
 * Get FFmpeg version string
 */
export async function getFfmpegVersion(): Promise<string> {
  return invoke<string>('get_ffmpeg_version');
}

/**
 * Get media file information (format, duration, codecs)
 */
export async function getMediaInfo(path: string): Promise<MediaInfo> {
  return invoke<MediaInfo>('get_media_info', { path });
}

/**
 * Extract audio from a media file
 * @param inputPath Path to the input media file
 * @param outputPath Optional output path (defaults to temp directory)
 * @returns Path to the extracted audio file
 */
export async function extractAudio(
  inputPath: string,
  outputPath?: string
): Promise<string> {
  return invoke<string>('extract_audio', { inputPath, outputPath });
}

/**
 * Get media file duration in seconds
 */
export async function getMediaDuration(path: string): Promise<number> {
  return invoke<number>('get_media_duration', { path });
}

// =============================================================================
// Model Management Commands
// =============================================================================

/**
 * Get list of available Whisper models
 */
export async function getAvailableModels(): Promise<WhisperModel[]> {
  return invoke<WhisperModel[]>('get_available_models');
}

/**
 * Get list of installed model IDs
 */
export async function getInstalledModels(): Promise<string[]> {
  return invoke<string[]>('get_installed_models');
}

/**
 * Get status of all models (combining available + installed info)
 */
export async function getModelsStatus(): Promise<ModelStatus[]> {
  return invoke<ModelStatus[]>('get_models_status');
}

/**
 * Check if a specific model is installed
 */
export async function isModelInstalled(modelId: string): Promise<boolean> {
  return invoke<boolean>('is_model_installed', { modelId });
}

/**
 * Download a Whisper model
 * Listen for 'model:download-progress' events for progress updates
 */
export async function downloadModel(modelId: string): Promise<string> {
  return invoke<string>('download_model', { modelId });
}

/**
 * Delete a downloaded model
 */
export async function deleteModel(modelId: string): Promise<void> {
  return invoke<void>('delete_model', { modelId });
}

/**
 * Get the models directory path
 */
export async function getModelsDirectory(): Promise<string> {
  return invoke<string>('get_models_directory');
}

// =============================================================================
// Transcription Commands
// =============================================================================

/**
 * Transcribe a media file (extracts audio first, then transcribes)
 * Listen for 'transcription:progress' events for progress updates
 */
export async function transcribeMedia(
  filePath: string,
  modelId: string,
  language?: string
): Promise<TranscriptionResult> {
  return invoke<TranscriptionResult>('transcribe_media', {
    filePath,
    modelId,
    language,
  });
}

/**
 * Transcribe an audio file directly (must be WAV format)
 * Listen for 'transcription:progress' events for progress updates
 */
export async function transcribeAudio(
  audioPath: string,
  modelId: string,
  language?: string
): Promise<TranscriptionResult> {
  return invoke<TranscriptionResult>('transcribe_audio', {
    audioPath,
    modelId,
    language,
  });
}

/**
 * Check if Whisper service is available
 */
export async function checkWhisperAvailable(): Promise<boolean> {
  return invoke<boolean>('check_whisper_available');
}

/**
 * Install whisper.cpp binary
 * Listen for 'whisper:install-progress' events for progress updates
 * @returns Path to the installed binary
 */
export async function installWhisperCpp(): Promise<string> {
  return invoke<string>('install_whisper_cpp');
}

// =============================================================================
// Ollama Commands
// =============================================================================

/**
 * Check if Ollama is running
 */
export async function checkOllama(): Promise<boolean> {
  return invoke<boolean>('check_ollama');
}

/**
 * Get list of available Ollama models
 */
export async function listOllamaModels(): Promise<OllamaModel[]> {
  return invoke<OllamaModel[]>('list_ollama_models');
}

/**
 * Generate text completion with Ollama
 */
export async function ollamaGenerate(
  model: string,
  prompt: string
): Promise<string> {
  return invoke<string>('ollama_generate', { model, prompt });
}

/**
 * Chat with Ollama
 */
export async function ollamaChat(
  model: string,
  messages: ChatMessage[]
): Promise<string> {
  return invoke<string>('ollama_chat', { model, messages });
}

/**
 * Summarize text using Ollama
 */
export async function summarizeText(
  model: string,
  text: string,
  language: string
): Promise<string> {
  return invoke<string>('summarize_text', { model, text, language });
}

/**
 * Extract story order from transcription segments
 */
export async function extractStoryOrder(
  model: string,
  segments: TranscriptionSegment[]
): Promise<StorySegment[]> {
  return invoke<StorySegment[]>('extract_story_order', { model, segments });
}

/**
 * Pull/download an Ollama model
 */
export async function pullOllamaModel(modelName: string): Promise<void> {
  return invoke<void>('pull_ollama_model', { modelName });
}

/**
 * Delete an Ollama model
 */
export async function deleteOllamaModel(modelName: string): Promise<void> {
  return invoke<void>('delete_ollama_model', { modelName });
}

// =============================================================================
// Cloud API Key Management Commands
// =============================================================================

/**
 * Store an API key securely in the system keychain
 */
export async function storeApiKey(
  provider: 'openai' | 'claude',
  apiKey: string
): Promise<void> {
  return invoke<void>('store_api_key', { provider, apiKey });
}

/**
 * Get a masked version of an API key for display
 */
export async function getApiKeyMasked(
  provider: 'openai' | 'claude'
): Promise<string | null> {
  return invoke<string | null>('get_api_key_masked', { provider });
}

/**
 * Delete an API key from the system keychain
 */
export async function deleteApiKey(
  provider: 'openai' | 'claude'
): Promise<void> {
  return invoke<void>('delete_api_key', { provider });
}

/**
 * Get status of which API keys are configured
 */
export async function getApiKeyStatus(): Promise<ApiKeyStatus> {
  return invoke<ApiKeyStatus>('get_api_key_status');
}

// =============================================================================
// OpenAI Commands
// =============================================================================

/**
 * Validate OpenAI API key
 */
export async function validateOpenaiKey(): Promise<boolean> {
  return invoke<boolean>('validate_openai_key');
}

/**
 * Transcribe audio using OpenAI Whisper API
 */
export async function openaiTranscribe(
  audioPath: string,
  language?: string
): Promise<OpenAITranscriptionResult> {
  return invoke<OpenAITranscriptionResult>('openai_transcribe', {
    audioPath,
    language,
  });
}

/**
 * Chat with OpenAI GPT
 */
export async function openaiChat(
  model: string,
  messages: ChatMessageInput[],
  temperature?: number,
  maxTokens?: number
): Promise<string> {
  return invoke<string>('openai_chat', {
    model,
    messages,
    temperature,
    maxTokens,
  });
}

/**
 * Summarize text using OpenAI GPT
 */
export async function openaiSummarize(
  text: string,
  language: string,
  model: string
): Promise<string> {
  return invoke<string>('openai_summarize', { text, language, model });
}

/**
 * Get available OpenAI models (static list)
 */
export async function getOpenaiModels(): Promise<OpenAIModel[]> {
  return invoke<OpenAIModel[]>('get_openai_models');
}

/**
 * Fetch available OpenAI models from API (dynamic, sorted by newest)
 */
export async function fetchOpenaiModels(): Promise<OpenAIModel[]> {
  return invoke<OpenAIModel[]>('fetch_openai_models');
}

// =============================================================================
// Claude Commands
// =============================================================================

/**
 * Validate Claude API key
 */
export async function validateClaudeKey(): Promise<boolean> {
  return invoke<boolean>('validate_claude_key');
}

/**
 * Chat with Claude
 */
export async function claudeChat(
  model: string,
  messages: ChatMessageInput[],
  system?: string,
  temperature?: number,
  maxTokens?: number
): Promise<string> {
  return invoke<string>('claude_chat', {
    model,
    messages,
    system,
    temperature,
    maxTokens,
  });
}

/**
 * Summarize text using Claude
 */
export async function claudeSummarize(
  text: string,
  language: string,
  model: string
): Promise<string> {
  return invoke<string>('claude_summarize', { text, language, model });
}

/**
 * Get available Claude models (static list)
 */
export async function getClaudeModels(): Promise<ClaudeModel[]> {
  return invoke<ClaudeModel[]>('get_claude_models');
}

/**
 * Fetch available Claude models from API (dynamic, sorted by newest)
 */
export async function fetchClaudeModels(): Promise<ClaudeModel[]> {
  return invoke<ClaudeModel[]>('fetch_claude_models');
}

// =============================================================================
// Directory Commands
// =============================================================================

/**
 * Scan a directory for media files (flat list)
 */
export async function scanMediaDirectory(path: string): Promise<FileEntry[]> {
  return invoke<FileEntry[]>('scan_media_directory', { path });
}

/**
 * Scan a directory for media files (tree structure)
 */
export async function scanMediaDirectoryTree(path: string): Promise<DirectoryNode> {
  return invoke<DirectoryNode>('scan_media_directory_tree', { path });
}

/**
 * Start watching a directory for file changes
 * Listen for 'file-change' events for updates
 */
export async function startWatchingDirectory(path: string): Promise<void> {
  return invoke<void>('start_watching_directory', { path });
}

/**
 * Stop watching the current directory
 */
export async function stopWatchingDirectory(): Promise<void> {
  return invoke<void>('stop_watching_directory');
}

/**
 * Get the currently watched directory path
 */
export async function getWatchedDirectory(): Promise<string | null> {
  return invoke<string | null>('get_watched_directory');
}

/**
 * Check if a file is a supported media file
 */
export async function isMediaFile(path: string): Promise<boolean> {
  return invoke<boolean>('is_media_file', { path });
}
