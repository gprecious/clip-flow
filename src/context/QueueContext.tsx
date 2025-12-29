import { createContext, useContext, useRef, useState, useCallback, useMemo, type ReactNode } from 'react';
import { QueueManager, type QueueStats } from '@/lib/queue';

const TRANSCRIPTION_CONCURRENCY = 2;
const SUMMARIZATION_CONCURRENCY = 3;

const initialStats: QueueStats = {
  pending: 0,
  active: 0,
  completed: 0,
  error: 0,
  total: 0,
};

interface QueueContextValue {
  // Transcription queue
  enqueueTranscription: (id: string, task: () => Promise<void>) => void;
  hasTranscription: (id: string) => boolean;
  transcriptionStats: QueueStats;

  // Summarization queue
  enqueueSummarization: (id: string, task: () => Promise<void>) => void;
  hasSummarization: (id: string) => boolean;
  resetSummarization: (id: string) => void;
  summarizationStats: QueueStats;

  // Combined stats
  isProcessing: boolean;
  overallProgress: number;

  // Clear completed items
  clearCompleted: () => void;
}

const QueueContext = createContext<QueueContextValue | null>(null);

interface QueueProviderProps {
  children: ReactNode;
}

export function QueueProvider({ children }: QueueProviderProps) {
  const [transcriptionStats, setTranscriptionStats] = useState<QueueStats>(initialStats);
  const [summarizationStats, setSummarizationStats] = useState<QueueStats>(initialStats);

  // Create queue managers with refs to persist across renders
  const transcriptionQueueRef = useRef<QueueManager | null>(null);
  const summarizationQueueRef = useRef<QueueManager | null>(null);

  // Initialize transcription queue
  if (!transcriptionQueueRef.current) {
    transcriptionQueueRef.current = new QueueManager({
      concurrency: TRANSCRIPTION_CONCURRENCY,
      onStatsChange: setTranscriptionStats,
    });
  }

  // Initialize summarization queue
  if (!summarizationQueueRef.current) {
    summarizationQueueRef.current = new QueueManager({
      concurrency: SUMMARIZATION_CONCURRENCY,
      onStatsChange: setSummarizationStats,
    });
  }

  const enqueueTranscription = useCallback((id: string, task: () => Promise<void>) => {
    transcriptionQueueRef.current?.enqueue(id, task);
  }, []);

  const hasTranscription = useCallback((id: string) => {
    return transcriptionQueueRef.current?.has(id) ?? false;
  }, []);

  const enqueueSummarization = useCallback((id: string, task: () => Promise<void>) => {
    summarizationQueueRef.current?.enqueue(id, task);
  }, []);

  const hasSummarization = useCallback((id: string) => {
    return summarizationQueueRef.current?.has(id) ?? false;
  }, []);

  const resetSummarization = useCallback((id: string) => {
    summarizationQueueRef.current?.resetItem(id);
  }, []);

  const clearCompleted = useCallback(() => {
    transcriptionQueueRef.current?.clearCompleted();
    summarizationQueueRef.current?.clearCompleted();
  }, []);

  // Calculate combined stats
  const isProcessing = useMemo(() => {
    return (
      transcriptionStats.pending > 0 ||
      transcriptionStats.active > 0 ||
      summarizationStats.pending > 0 ||
      summarizationStats.active > 0
    );
  }, [transcriptionStats, summarizationStats]);

  const overallProgress = useMemo(() => {
    const totalTasks =
      transcriptionStats.total + summarizationStats.total;

    if (totalTasks === 0) return 0;

    const completedTasks =
      transcriptionStats.completed +
      transcriptionStats.error +
      summarizationStats.completed +
      summarizationStats.error;

    return Math.round((completedTasks / totalTasks) * 100);
  }, [transcriptionStats, summarizationStats]);

  const value = useMemo<QueueContextValue>(
    () => ({
      enqueueTranscription,
      hasTranscription,
      transcriptionStats,
      enqueueSummarization,
      hasSummarization,
      resetSummarization,
      summarizationStats,
      isProcessing,
      overallProgress,
      clearCompleted,
    }),
    [
      enqueueTranscription,
      hasTranscription,
      transcriptionStats,
      enqueueSummarization,
      hasSummarization,
      resetSummarization,
      summarizationStats,
      isProcessing,
      overallProgress,
      clearCompleted,
    ]
  );

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>;
}

export function useQueue(): QueueContextValue {
  const context = useContext(QueueContext);
  if (!context) {
    throw new Error('useQueue must be used within a QueueProvider');
  }
  return context;
}

export default QueueContext;
