export interface QueueStats {
  pending: number;
  active: number;
  completed: number;
  error: number;
  total: number;
}

export interface QueueManagerOptions {
  concurrency: number;
  onStatsChange?: (stats: QueueStats) => void;
}

export class QueueManager {
  private pending: Map<string, () => Promise<void>> = new Map();
  private active: Set<string> = new Set();
  private completed: Set<string> = new Set();
  private errors: Map<string, Error> = new Map();
  private concurrency: number;
  private onStatsChange?: (stats: QueueStats) => void;

  constructor(options: QueueManagerOptions) {
    this.concurrency = options.concurrency;
    this.onStatsChange = options.onStatsChange;
  }

  /**
   * Add a task to the queue
   */
  enqueue(id: string, task: () => Promise<void>): void {
    // Skip if already in queue or completed
    if (this.pending.has(id) || this.active.has(id) || this.completed.has(id)) {
      return;
    }

    this.pending.set(id, task);
    this.notifyStatsChange();
    this.processNext();
  }

  /**
   * Remove a pending task from the queue
   */
  dequeue(id: string): void {
    if (this.pending.has(id)) {
      this.pending.delete(id);
      this.notifyStatsChange();
    }
  }

  /**
   * Check if an item is in the queue (pending or active)
   */
  has(id: string): boolean {
    return this.pending.has(id) || this.active.has(id);
  }

  /**
   * Check if an item is currently being processed
   */
  isActive(id: string): boolean {
    return this.active.has(id);
  }

  /**
   * Get current queue statistics
   */
  getStats(): QueueStats {
    return {
      pending: this.pending.size,
      active: this.active.size,
      completed: this.completed.size,
      error: this.errors.size,
      total: this.pending.size + this.active.size + this.completed.size + this.errors.size,
    };
  }

  /**
   * Clear all completed and error items (keeps pending and active)
   */
  clearCompleted(): void {
    this.completed.clear();
    this.errors.clear();
    this.notifyStatsChange();
  }

  /**
   * Remove an item from completed/errors to allow re-queueing
   */
  resetItem(id: string): void {
    const wasCompleted = this.completed.delete(id);
    const wasError = this.errors.delete(id);
    if (wasCompleted || wasError) {
      this.notifyStatsChange();
    }
  }

  /**
   * Reset the queue completely
   */
  clear(): void {
    this.pending.clear();
    this.active.clear();
    this.completed.clear();
    this.errors.clear();
    this.notifyStatsChange();
  }

  /**
   * Process the next item in the queue
   */
  private async processNext(): Promise<void> {
    // Check if we can process more items
    if (this.active.size >= this.concurrency) {
      return;
    }

    // Get next pending item
    const iterator = this.pending.entries().next();
    if (iterator.done) {
      return; // No pending items
    }

    const [id, task] = iterator.value;

    // Move from pending to active
    this.pending.delete(id);
    this.active.add(id);
    this.notifyStatsChange();

    try {
      await task();
      // Move to completed
      this.active.delete(id);
      this.completed.add(id);
    } catch (error) {
      // Move to errors
      this.active.delete(id);
      this.errors.set(id, error instanceof Error ? error : new Error(String(error)));
    } finally {
      this.notifyStatsChange();
      // Process next item
      this.processNext();
    }
  }

  private notifyStatsChange(): void {
    this.onStatsChange?.(this.getStats());
  }
}

export default QueueManager;
