import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { QueueManager, type QueueStats } from './QueueManager';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

describe('QueueManager', () => {
  let queue: QueueManager;
  let statsCallback: Mock<(stats: QueueStats) => void>;

  beforeEach(() => {
    statsCallback = vi.fn<(stats: QueueStats) => void>();
    queue = new QueueManager({
      concurrency: 2,
      onStatsChange: statsCallback,
    });
  });

  it('should respect concurrency limit', async () => {
    const executing: string[] = [];
    const completed: string[] = [];

    // Enqueue 5 items
    for (let i = 0; i < 5; i++) {
      queue.enqueue(`item-${i}`, async () => {
        executing.push(`item-${i}`);
        await delay(50);
        executing.splice(executing.indexOf(`item-${i}`), 1);
        completed.push(`item-${i}`);
      });
    }

    // After a short delay, at most 2 should be executing
    await delay(10);
    expect(executing.length).toBeLessThanOrEqual(2);

    // Wait for all to complete
    await delay(200);
    expect(completed.length).toBe(5);
  });

  it('should process items in FIFO order', async () => {
    const order: string[] = [];

    queue.enqueue('first', async () => {
      order.push('first');
    });
    queue.enqueue('second', async () => {
      order.push('second');
    });
    queue.enqueue('third', async () => {
      order.push('third');
    });

    await delay(50);
    expect(order).toEqual(['first', 'second', 'third']);
  });

  it('should handle errors without stopping queue', async () => {
    const results: string[] = [];

    queue.enqueue('success-1', async () => {
      results.push('success-1');
    });
    queue.enqueue('error', async () => {
      throw new Error('Test error');
    });
    queue.enqueue('success-2', async () => {
      results.push('success-2');
    });

    await delay(50);
    expect(results).toEqual(['success-1', 'success-2']);

    const stats = queue.getStats();
    expect(stats.error).toBe(1);
    expect(stats.completed).toBe(2);
  });

  it('should not add duplicate items', () => {
    queue.enqueue('item-1', async () => {});
    queue.enqueue('item-1', async () => {}); // Duplicate
    queue.enqueue('item-2', async () => {});

    const stats = queue.getStats();
    // item-1 might be active or completed, item-2 should be pending or active
    expect(stats.pending + stats.active).toBeLessThanOrEqual(2);
  });

  it('should report correct stats', async () => {
    queue.enqueue('item-1', async () => {
      await delay(30);
    });
    queue.enqueue('item-2', async () => {
      await delay(30);
    });
    queue.enqueue('item-3', async () => {
      await delay(30);
    });

    await delay(10);
    let stats = queue.getStats();
    expect(stats.active).toBe(2); // Concurrency limit
    expect(stats.pending).toBe(1);

    await delay(100);
    stats = queue.getStats();
    expect(stats.completed).toBe(3);
    expect(stats.active).toBe(0);
    expect(stats.pending).toBe(0);
  });

  it('should call onStatsChange callback', async () => {
    queue.enqueue('item-1', async () => {
      await delay(10);
    });

    await delay(50);

    expect(statsCallback).toHaveBeenCalled();
    const lastCall = statsCallback.mock.calls[statsCallback.mock.calls.length - 1][0] as QueueStats;
    expect(lastCall.completed).toBe(1);
  });

  it('should check if item exists with has()', () => {
    queue.enqueue('item-1', async () => {
      return delay(100);
    });

    expect(queue.has('item-1')).toBe(true);
    expect(queue.has('item-2')).toBe(false);
  });

  it('should check if item is active with isActive()', async () => {
    queue.enqueue('item-1', async () => {
      await delay(100);
    });

    await delay(10);
    expect(queue.isActive('item-1')).toBe(true);

    await delay(150);
    expect(queue.isActive('item-1')).toBe(false);
  });

  it('should dequeue pending items', () => {
    // With concurrency 2, first 2 will start immediately
    queue.enqueue('item-1', async (): Promise<void> => { await delay(100); });
    queue.enqueue('item-2', async (): Promise<void> => { await delay(100); });
    queue.enqueue('item-3', async (): Promise<void> => { await delay(100); });

    // item-3 should be pending
    queue.dequeue('item-3');

    const stats = queue.getStats();
    expect(stats.pending).toBe(0);
  });

  it('should clear completed items', async () => {
    queue.enqueue('item-1', async () => {});

    await delay(20);

    let stats = queue.getStats();
    expect(stats.completed).toBe(1);

    queue.clearCompleted();

    stats = queue.getStats();
    expect(stats.completed).toBe(0);
  });

  it('should clear all items', async () => {
    queue.enqueue('item-1', async (): Promise<void> => { await delay(100); });
    queue.enqueue('item-2', async (): Promise<void> => { await delay(100); });
    queue.enqueue('item-3', async (): Promise<void> => { await delay(100); });

    await delay(10);
    queue.clear();

    const stats = queue.getStats();
    expect(stats.total).toBe(0);
  });
});
