import { listen, type UnlistenFn } from '@tauri-apps/api/event';
import type { DownloadProgress, TranscriptionProgress, FileChangeEvent, WhisperInstallProgress } from './types';

/**
 * Listen for FFmpeg progress events
 */
export function onFfmpegProgress(
  callback: (progress: number) => void
): Promise<UnlistenFn> {
  return listen<number>('ffmpeg:progress', (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for model download progress events
 */
export function onModelDownloadProgress(
  callback: (progress: DownloadProgress) => void
): Promise<UnlistenFn> {
  return listen<DownloadProgress>('model:download-progress', (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for transcription progress events
 */
export function onTranscriptionProgress(
  callback: (progress: TranscriptionProgress) => void
): Promise<UnlistenFn> {
  return listen<TranscriptionProgress>('transcription:progress', (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for file change events from directory watcher
 */
export function onFileChange(
  callback: (event: FileChangeEvent) => void
): Promise<UnlistenFn> {
  return listen<FileChangeEvent>('file-change', (event) => {
    callback(event.payload);
  });
}

/**
 * Listen for whisper.cpp installation progress events
 */
export function onWhisperInstallProgress(
  callback: (progress: WhisperInstallProgress) => void
): Promise<UnlistenFn> {
  return listen<WhisperInstallProgress>('whisper:install-progress', (event) => {
    callback(event.payload);
  });
}
