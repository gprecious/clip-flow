// Media and FFmpeg types
export interface MediaInfo {
  format: string;
  duration: number;
  has_video: boolean;
  has_audio: boolean;
}

// Whisper model types
export interface WhisperModel {
  id: string;
  name: string;
  size_bytes: number;
  size_display: string;
  url: string;
  sha256: string | null;
}

export interface ModelStatus {
  id: string;
  name: string;
  size_display: string;
  installed: boolean;
  path: string | null;
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  percent: number;
  model_id: string;
}

export interface WhisperInstallProgress {
  percent: number;
  message: string;
}

// Transcription types
export interface TranscriptionSegment {
  start: number;
  end: number;
  text: string;
}

export interface TranscriptionResult {
  segments: TranscriptionSegment[];
  full_text: string;
  language: string | null;
  duration: number;
}

export interface TranscriptionProgress {
  stage: 'extracting' | 'transcribing' | 'complete';
  progress: number;
  message: string;
}

// Ollama types
export interface OllamaModel {
  name: string;
  size: number;
  modified_at: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface StorySegment {
  index: number;
  reason: string;
}

// Cloud API types
export interface ApiKeyStatus {
  openai: boolean;
  claude: boolean;
}

export interface OpenAIModel {
  id: string;
  name: string;
  description: string;
}

export interface ClaudeModel {
  id: string;
  name: string;
  description: string;
}

export interface OpenAITranscriptionResult {
  text: string;
  language: string | null;
  duration: number | null;
  segments: TranscriptionSegment[] | null;
}

export interface ChatMessageInput {
  role: string;
  content: string;
}

// Directory types
export interface FileEntry {
  path: string;
  name: string;
  size: number;
  is_dir: boolean;
  modified: number | null;
  extension: string | null;
}

export interface DirectoryNode {
  path: string;
  name: string;
  is_dir: boolean;
  size: number;
  modified: number | null;
  extension: string | null;
  children: DirectoryNode[];
}

export type FileChangeEvent =
  | { type: 'Created'; path: string }
  | { type: 'Modified'; path: string }
  | { type: 'Removed'; path: string };
