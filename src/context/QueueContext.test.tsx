import { describe, it, expect, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { QueueProvider, useQueue } from './QueueContext';
import type { ReactNode } from 'react';

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueueProvider>{children}</QueueProvider>
);

describe('QueueContext', () => {
  describe('useQueue hook', () => {
    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useQueue());
      }).toThrow('useQueue must be used within a QueueProvider');

      consoleSpy.mockRestore();
    });

    it('should provide initial stats', () => {
      const { result } = renderHook(() => useQueue(), { wrapper });

      expect(result.current.transcriptionStats).toEqual({
        pending: 0,
        active: 0,
        completed: 0,
        error: 0,
        total: 0,
      });

      expect(result.current.summarizationStats).toEqual({
        pending: 0,
        active: 0,
        completed: 0,
        error: 0,
        total: 0,
      });

      expect(result.current.isProcessing).toBe(false);
      expect(result.current.overallProgress).toBe(0);
    });

    it('should enqueue transcription tasks', async () => {
      const { result } = renderHook(() => useQueue(), { wrapper });

      act(() => {
        result.current.enqueueTranscription('file-1', async () => {
          await delay(50);
        });
      });

      await waitFor(() => {
        expect(result.current.isProcessing).toBe(true);
      });

      expect(result.current.hasTranscription('file-1')).toBe(true);
    });

    it('should enqueue summarization tasks', async () => {
      const { result } = renderHook(() => useQueue(), { wrapper });

      act(() => {
        result.current.enqueueSummarization('file-1', async () => {
          await delay(50);
        });
      });

      await waitFor(() => {
        expect(result.current.isProcessing).toBe(true);
      });

      expect(result.current.hasSummarization('file-1')).toBe(true);
    });

    it('should calculate overall progress correctly', async () => {
      const { result } = renderHook(() => useQueue(), { wrapper });

      act(() => {
        result.current.enqueueTranscription('file-1', async () => {
          await delay(20);
        });
        result.current.enqueueTranscription('file-2', async () => {
          await delay(20);
        });
      });

      // Wait for tasks to complete
      await waitFor(
        () => {
          expect(result.current.overallProgress).toBe(100);
        },
        { timeout: 200 }
      );
    });

    it('should limit transcription concurrency to 2', async () => {
      const { result } = renderHook(() => useQueue(), { wrapper });
      let activeCount = 0;
      let maxActive = 0;

      const createTask = () => async () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await delay(30);
        activeCount--;
      };

      act(() => {
        result.current.enqueueTranscription('file-1', createTask());
        result.current.enqueueTranscription('file-2', createTask());
        result.current.enqueueTranscription('file-3', createTask());
        result.current.enqueueTranscription('file-4', createTask());
      });

      await waitFor(
        () => {
          expect(result.current.transcriptionStats.completed).toBe(4);
        },
        { timeout: 500 }
      );

      expect(maxActive).toBe(2);
    });

    it('should limit summarization concurrency to 3', async () => {
      const { result } = renderHook(() => useQueue(), { wrapper });
      let activeCount = 0;
      let maxActive = 0;

      const createTask = () => async () => {
        activeCount++;
        maxActive = Math.max(maxActive, activeCount);
        await delay(30);
        activeCount--;
      };

      act(() => {
        result.current.enqueueSummarization('file-1', createTask());
        result.current.enqueueSummarization('file-2', createTask());
        result.current.enqueueSummarization('file-3', createTask());
        result.current.enqueueSummarization('file-4', createTask());
        result.current.enqueueSummarization('file-5', createTask());
      });

      await waitFor(
        () => {
          expect(result.current.summarizationStats.completed).toBe(5);
        },
        { timeout: 500 }
      );

      expect(maxActive).toBe(3);
    });

    it('should clear completed items', async () => {
      const { result } = renderHook(() => useQueue(), { wrapper });

      act(() => {
        result.current.enqueueTranscription('file-1', async () => {});
      });

      await waitFor(() => {
        expect(result.current.transcriptionStats.completed).toBe(1);
      });

      act(() => {
        result.current.clearCompleted();
      });

      expect(result.current.transcriptionStats.completed).toBe(0);
    });

    it('should update isProcessing when tasks complete', async () => {
      const { result } = renderHook(() => useQueue(), { wrapper });

      expect(result.current.isProcessing).toBe(false);

      act(() => {
        result.current.enqueueTranscription('file-1', async () => {
          await delay(30);
        });
      });

      await waitFor(() => {
        expect(result.current.isProcessing).toBe(true);
      });

      await waitFor(
        () => {
          expect(result.current.isProcessing).toBe(false);
        },
        { timeout: 200 }
      );
    });
  });
});
