// Types
export type {
  MediaInfo,
  WhisperModel,
  ModelStatus,
  DownloadProgress,
  WhisperInstallProgress,
  TranscriptionSegment,
  TranscriptionResult,
  TranscriptionProgress,
  OllamaModel,
  ChatMessage,
  StorySegment,
  // Cloud API types
  ApiKeyStatus,
  OpenAIModel,
  ClaudeModel,
  OpenAITranscriptionResult,
  ChatMessageInput,
  // Directory types
  FileEntry,
  DirectoryNode,
  FileChangeEvent,
} from './types';

// Commands
export {
  // FFmpeg
  checkFfmpeg,
  getFfmpegVersion,
  getMediaInfo,
  extractAudio,
  getMediaDuration,
  // Models
  getAvailableModels,
  getInstalledModels,
  getModelsStatus,
  isModelInstalled,
  downloadModel,
  deleteModel,
  getModelsDirectory,
  // Transcription
  transcribeMedia,
  transcribeAudio,
  checkWhisperAvailable,
  installWhisperCpp,
  // Ollama
  checkOllama,
  listOllamaModels,
  ollamaGenerate,
  ollamaChat,
  summarizeText,
  extractStoryOrder,
  pullOllamaModel,
  deleteOllamaModel,
  // Cloud API Key Management
  storeApiKey,
  getApiKeyMasked,
  deleteApiKey,
  getApiKeyStatus,
  // OpenAI
  validateOpenaiKey,
  openaiTranscribe,
  openaiChat,
  openaiSummarize,
  getOpenaiModels,
  // Claude
  validateClaudeKey,
  claudeChat,
  claudeSummarize,
  getClaudeModels,
  // Directory
  scanMediaDirectory,
  scanMediaDirectoryTree,
  startWatchingDirectory,
  stopWatchingDirectory,
  getWatchedDirectory,
  isMediaFile,
} from './commands';

// Events
export {
  onFfmpegProgress,
  onModelDownloadProgress,
  onTranscriptionProgress,
  onFileChange,
  onWhisperInstallProgress,
} from './events';
