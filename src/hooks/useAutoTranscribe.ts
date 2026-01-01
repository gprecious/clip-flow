import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useMedia, type MediaFile } from '@/context/MediaContext';
import { useSettings } from '@/context/SettingsContext';
import { useQueue } from '@/context/QueueContext';
import {
  transcribeMedia,
  getInstalledModels,
  checkWhisperAvailable,
  onTranscriptionProgress,
  getApiKeyStatus,
  openaiTranscribe,
  type TranscriptionProgress,
} from '@/lib/tauri';

const DEFAULT_MODEL_ID = 'base';

// OpenAI Whisper API file size limit: 25MB
const OPENAI_MAX_FILE_SIZE = 25 * 1024 * 1024; // 26,214,400 bytes

type TranscriptionMethod = 'whisper-local' | 'openai' | 'none';

/**
 * Hook that automatically transcribes files when they are added.
 * Uses Whisper AI for transcription.
 */
export function useAutoTranscribe() {
  const { t } = useTranslation();
  const { getAllFiles, updateFileStatus, setTranscription, resetAllTranscriptions } = useMedia();
  const { settings, hasLanguageChanged, markLanguageAsUsed } = useSettings();
  const { enqueueTranscription, hasTranscription } = useQueue();
  const processingRef = useRef<Set<string>>(new Set());
  const currentFileRef = useRef<string | null>(null);
  const languageCheckRef = useRef<boolean>(false);

  // Helper function to get localized error message
  const getLocalizedErrorMessage = useCallback((error: unknown): string => {
    let errorMessage = 'Unknown error';

    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object' && 'message' in error) {
      errorMessage = String((error as { message: unknown }).message);
    }

    // Map known error messages to localized versions
    if (errorMessage.includes('does not contain an audio stream')) {
      return t('errors.noAudioStream', 'This video does not contain an audio stream');
    }

    if (errorMessage.includes('exceeds 25MB') || errorMessage.includes('file size limit')) {
      return t('errors.fileTooLargeForOpenAI', 'File size exceeds 25MB. OpenAI Whisper API only supports files up to 25MB.');
    }

    return errorMessage;
  }, [t]);

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  // Get only pending files that haven't been processed yet
  const pendingFiles = useMemo(() => {
    const allFiles = getAllFiles();
    return allFiles.filter(
      (file) => file.status === 'pending' && !processingRef.current.has(file.path)
    );
  }, [getAllFiles]);

  // Handle transcription progress events
  const handleProgress = useCallback(
    (progress: TranscriptionProgress) => {
      const filePath = currentFileRef.current;
      if (!filePath) return;

      if (progress.stage === 'extracting') {
        updateFileStatus(filePath, 'extracting', Math.round(progress.progress));
      } else if (progress.stage === 'transcribing') {
        updateFileStatus(filePath, 'transcribing', Math.round(progress.progress));
      }
    },
    [updateFileStatus]
  );

  useEffect(() => {
    // Set up progress listener
    let unsubscribe: (() => void) | undefined;

    const setupListener = async () => {
      try {
        unsubscribe = await onTranscriptionProgress(handleProgress);
      } catch (error) {
        console.error('Failed to set up transcription progress listener:', error);
      }
    };

    setupListener();

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [handleProgress]);

  // Check for language changes on mount (after refresh)
  useEffect(() => {
    if (languageCheckRef.current) return;
    languageCheckRef.current = true;

    console.log('[AutoTranscribe] Checking language change...');
    console.log('[AutoTranscribe] Current language:', settings.transcriptionLanguage);
    console.log('[AutoTranscribe] Has language changed:', hasLanguageChanged());

    if (hasLanguageChanged()) {
      console.log('[AutoTranscribe] Language changed, resetting all transcriptions');
      // Clear the processing ref to allow re-processing of all files
      processingRef.current.clear();
      resetAllTranscriptions();
    }
    // Mark current language as used for future comparisons
    markLanguageAsUsed();
    console.log('[AutoTranscribe] Language marked as used:', settings.transcriptionLanguage);
  }, [hasLanguageChanged, markLanguageAsUsed, resetAllTranscriptions, settings.transcriptionLanguage]);

  useEffect(() => {
    console.log('[AutoTranscribe] Pending files to process:', pendingFiles.length);

    // Process each pending file through queue (limits concurrent processing)
    pendingFiles.forEach((file) => {
      // Skip if already in queue
      if (hasTranscription(file.path)) {
        return;
      }
      processingRef.current.add(file.path);
      enqueueTranscription(file.path, () => processFile(file));
    });

    async function processFile(file: MediaFile): Promise<void> {
      const filePath = file.path;
      currentFileRef.current = filePath;

      console.log('[AutoTranscribe] Processing file:', filePath);

      try {
        // Determine which transcription method to use
        const method = await determineTranscriptionMethod();
        console.log('[AutoTranscribe] Using method:', method);

        if (method === 'none') {
          throw new Error(
            'No transcription service available. Please either:\n' +
            '1. Install whisper.cpp and download a model, or\n' +
            '2. Configure an OpenAI API key in Settings'
          );
        }

        // Check file size limit for OpenAI Whisper API
        if (method === 'openai' && file.size > OPENAI_MAX_FILE_SIZE) {
          const formattedSize = formatFileSize(file.size);
          throw new Error(
            `File size (${formattedSize}) exceeds 25MB. OpenAI Whisper API file size limit exceeded.`
          );
        }

        updateFileStatus(filePath, 'extracting', 0);

        let transcription: MediaFile['transcription'];

        // Get language from settings (undefined for 'auto' to let Whisper auto-detect)
        const language = settings.transcriptionLanguage === 'auto'
          ? undefined
          : settings.transcriptionLanguage;

        if (method === 'openai') {
          // Use OpenAI Whisper API
          const openaiModel = settings.openaiWhisperModel || 'whisper-1';
          console.log('[AutoTranscribe] Using OpenAI Whisper API with language:', language, 'model:', openaiModel);
          updateFileStatus(filePath, 'transcribing', 10);

          const result = await openaiTranscribe(filePath, language, openaiModel);
          console.log('[AutoTranscribe] OpenAI transcription complete:', result);

          transcription = {
            segments: result.segments || [],
            fullText: result.text,
            language: result.language || undefined,
            duration: result.duration || undefined,
            metadata: {
              provider: 'openai',
              model: openaiModel,
              transcribedAt: Date.now(),
            },
          };
        } else {
          // Use local whisper.cpp
          console.log('[AutoTranscribe] Getting installed models...');
          const installedModels = await getInstalledModels();
          console.log('[AutoTranscribe] Installed models:', installedModels);
          console.log('[AutoTranscribe] Settings whisperModel:', settings.whisperModel);

          // Use model from settings, with fallback logic
          let modelId = settings.whisperModel || DEFAULT_MODEL_ID;

          if (installedModels.length > 0) {
            // Check if selected model is installed
            if (!installedModels.includes(modelId)) {
              // Fallback: use default if installed, otherwise first available
              const hasDefault = installedModels.includes(DEFAULT_MODEL_ID);
              modelId = hasDefault ? DEFAULT_MODEL_ID : installedModels[0];
              console.warn(`[AutoTranscribe] Selected model "${settings.whisperModel}" not installed, falling back to "${modelId}"`);
            }
          } else {
            throw new Error('No Whisper models installed. Please download a model first.');
          }

          console.log('[AutoTranscribe] Starting transcription with model:', modelId, 'language:', language);

          const result = await transcribeMedia(filePath, modelId, language);
          console.log('[AutoTranscribe] Transcription complete:', result);

          transcription = {
            segments: result.segments.map((s) => ({
              start: s.start,
              end: s.end,
              text: s.text,
            })),
            fullText: result.full_text,
            language: result.language || undefined,
            duration: result.duration,
            metadata: {
              provider: 'local',
              model: modelId,
              transcribedAt: Date.now(),
            },
          };
        }

        setTranscription(filePath, transcription);
      } catch (error) {
        console.error('[AutoTranscribe] Error:', error);
        updateFileStatus(
          filePath,
          'error',
          0,
          getLocalizedErrorMessage(error)
        );
      } finally {
        currentFileRef.current = null;
        processingRef.current.delete(filePath);
      }
    }

    async function determineTranscriptionMethod(): Promise<TranscriptionMethod> {
      const preferredProvider = settings.transcriptionProvider; // 'local' | 'openai'

      // 1. 사용자가 OpenAI 선택한 경우
      if (preferredProvider === 'openai') {
        try {
          const apiStatus = await getApiKeyStatus();
          if (apiStatus.openai) {
            return 'openai';
          }
          // API 키 없으면 로컬로 fallback
          console.warn('[AutoTranscribe] OpenAI selected but no API key, falling back to local');
        } catch (error) {
          console.warn('[AutoTranscribe] OpenAI API check failed:', error);
        }
      }

      // 2. 로컬 사용 (기본값 또는 fallback)
      try {
        const whisperAvailable = await checkWhisperAvailable();
        if (whisperAvailable) {
          const installedModels = await getInstalledModels();
          if (installedModels.length > 0) {
            return 'whisper-local';
          }
        }
      } catch (error) {
        console.warn('[AutoTranscribe] Local whisper check failed:', error);
      }

      // 3. 로컬도 안되면 OpenAI fallback
      if (preferredProvider === 'local') {
        try {
          const apiStatus = await getApiKeyStatus();
          if (apiStatus.openai) {
            return 'openai';
          }
        } catch (error) {
          console.warn('[AutoTranscribe] OpenAI fallback check failed:', error);
        }
      }

      return 'none';
    }
  }, [pendingFiles, updateFileStatus, setTranscription, settings.transcriptionLanguage, settings.transcriptionProvider, settings.openaiWhisperModel, settings.whisperModel, enqueueTranscription, hasTranscription, getLocalizedErrorMessage]);
}

export default useAutoTranscribe;
