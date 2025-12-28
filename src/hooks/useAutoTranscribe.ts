import { useEffect, useRef, useCallback, useMemo } from 'react';
import { useMedia, type MediaFile } from '@/context/MediaContext';
import { useSettings } from '@/context/SettingsContext';
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

type TranscriptionMethod = 'whisper-local' | 'openai' | 'none';

/**
 * Hook that automatically transcribes files when they are added.
 * Uses Whisper AI for transcription.
 */
export function useAutoTranscribe() {
  const { getAllFiles, updateFileStatus, setTranscription, resetAllTranscriptions } = useMedia();
  const { settings, hasLanguageChanged, markLanguageAsUsed } = useSettings();
  const processingRef = useRef<Set<string>>(new Set());
  const currentFileRef = useRef<string | null>(null);
  const languageCheckRef = useRef<boolean>(false);

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

    // Process each pending file
    pendingFiles.forEach((file) => {
      processingRef.current.add(file.path);
      processFile(file);
    });

    async function processFile(file: MediaFile) {
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

        updateFileStatus(filePath, 'extracting', 0);

        let transcription: MediaFile['transcription'];

        // Get language from settings (undefined for 'auto' to let Whisper auto-detect)
        const language = settings.transcriptionLanguage === 'auto'
          ? undefined
          : settings.transcriptionLanguage;

        if (method === 'openai') {
          // Use OpenAI Whisper API
          console.log('[AutoTranscribe] Using OpenAI Whisper API with language:', language);
          updateFileStatus(filePath, 'transcribing', 10);

          const result = await openaiTranscribe(filePath, language);
          console.log('[AutoTranscribe] OpenAI transcription complete:', result);

          transcription = {
            segments: result.segments || [],
            fullText: result.text,
            language: result.language || undefined,
            duration: result.duration || undefined,
          };
        } else {
          // Use local whisper.cpp
          console.log('[AutoTranscribe] Getting installed models...');
          const installedModels = await getInstalledModels();
          console.log('[AutoTranscribe] Installed models:', installedModels);

          let modelId = DEFAULT_MODEL_ID;

          if (installedModels.length > 0) {
            const hasDefault = installedModels.includes(DEFAULT_MODEL_ID);
            modelId = hasDefault ? DEFAULT_MODEL_ID : installedModels[0];
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
          };
        }

        setTranscription(filePath, transcription);
      } catch (error) {
        console.error('[AutoTranscribe] Error:', error);
        updateFileStatus(
          filePath,
          'error',
          0,
          error instanceof Error ? error.message : 'Unknown error'
        );
      } finally {
        currentFileRef.current = null;
        processingRef.current.delete(filePath);
      }
    }

    async function determineTranscriptionMethod(): Promise<TranscriptionMethod> {
      // First, check if local whisper.cpp is available with models
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

      // Fallback to OpenAI if API key is configured
      try {
        const apiStatus = await getApiKeyStatus();
        if (apiStatus.openai) {
          return 'openai';
        }
      } catch (error) {
        console.warn('[AutoTranscribe] OpenAI API check failed:', error);
      }

      return 'none';
    }
  }, [pendingFiles, updateFileStatus, setTranscription, settings.transcriptionLanguage]);
}

export default useAutoTranscribe;
