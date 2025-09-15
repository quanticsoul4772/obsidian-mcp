/**
 * Performance monitoring utilities for obsidian-mcp
 */

interface PerformanceMetrics {
  operation: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  memoryUsed?: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

interface MemorySnapshot {
  rss: number;
  heapTotal: number;
  heapUsed: number;
  external: number;
  arrayBuffers: number;
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetrics> = new Map();
  private operationCounts: Map<string, number> = new Map();
  private operationTimes: Map<string, number[]> = new Map();
  private memoryCheckInterval?: NodeJS.Timeout;
  private lastMemorySnapshot?: MemorySnapshot;

  constructor(private enabled: boolean = true) {
    if (this.enabled) {
      this.startMemoryMonitoring();
    }
  }

  /**
   * Start tracking an operation
   */
  startOperation(operationId: string, operation: string, metadata?: Record<string, unknown>): void {
    if (!this.enabled) return;

    this.metrics.set(operationId, {
      operation,
      startTime: Date.now(),
      success: false,
      metadata
    });

    // Track operation count
    const count = this.operationCounts.get(operation) || 0;
    this.operationCounts.set(operation, count + 1);
  }

  /**
   * End tracking an operation
   */
  endOperation(operationId: string, success: boolean = true): PerformanceMetrics | undefined {
    if (!this.enabled) return undefined;

    const metric = this.metrics.get(operationId);
    if (!metric) return undefined;

    metric.endTime = Date.now();
    metric.duration = metric.endTime - metric.startTime;
    metric.success = success;
    metric.memoryUsed = this.getCurrentMemoryUsage();

    // Track operation times
    const times = this.operationTimes.get(metric.operation) || [];
    times.push(metric.duration);
    this.operationTimes.set(metric.operation, times);

    // Clean up old metrics to prevent memory leak
    if (this.metrics.size > 1000) {
      const oldestKey = this.metrics.keys().next().value;
      if (oldestKey) this.metrics.delete(oldestKey);
    }

    return metric;
  }

  /**
   * Get performance statistics
   */
  getStatistics(): Record<string, unknown> {
    const stats: Record<string, any> = {};

    for (const [operation, times] of this.operationTimes.entries()) {
      if (times.length === 0) continue;

      const sorted = [...times].sort((a, b) => a - b);
      const sum = sorted.reduce((a, b) => a + b, 0);
      const avg = sum / sorted.length;
      const median = sorted[Math.floor(sorted.length / 2)];
      const p95 = sorted[Math.floor(sorted.length * 0.95)];
      const p99 = sorted[Math.floor(sorted.length * 0.99)];

      stats[operation] = {
        count: this.operationCounts.get(operation) || 0,
        avgDuration: Math.round(avg),
        medianDuration: Math.round(median),
        p95Duration: Math.round(p95),
        p99Duration: Math.round(p99),
        minDuration: sorted[0],
        maxDuration: sorted[sorted.length - 1]
      };
    }

    return {
      operations: stats,
      memory: this.lastMemorySnapshot,
      totalOperations: Array.from(this.operationCounts.values()).reduce((a, b) => a + b, 0)
    };
  }

  /**
   * Get current memory usage
   */
  private getCurrentMemoryUsage(): number {
    const usage = process.memoryUsage();
    return usage.heapUsed;
  }

  /**
   * Start monitoring memory
   */
  private startMemoryMonitoring(): void {
    // Update memory snapshot every 30 seconds
    this.memoryCheckInterval = setInterval(() => {
      const usage = process.memoryUsage();
      this.lastMemorySnapshot = {
        rss: usage.rss,
        heapTotal: usage.heapTotal,
        heapUsed: usage.heapUsed,
        external: usage.external,
        arrayBuffers: usage.arrayBuffers
      };
    }, 30000);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
    }
    this.metrics.clear();
    this.operationCounts.clear();
    this.operationTimes.clear();
  }

  /**
   * Reset statistics
   */
  reset(): void {
    this.metrics.clear();
    this.operationCounts.clear();
    this.operationTimes.clear();
  }

  /**
   * Create a timed function wrapper
   */
  wrapFunction<T extends (...args: any[]) => any>(
    fn: T,
    operation: string
  ): T {
    if (!this.enabled) return fn;

    return ((...args: Parameters<T>) => {
      const operationId = `${operation}-${Date.now()}-${Math.random()}`;
      this.startOperation(operationId, operation);

      try {
        const result = fn(...args);

        // Handle promises
        if (result instanceof Promise) {
          return result
            .then((value) => {
              this.endOperation(operationId, true);
              return value;
            })
            .catch((error) => {
              this.endOperation(operationId, false);
              throw error;
            });
        }

        this.endOperation(operationId, true);
        return result;
      } catch (error) {
        this.endOperation(operationId, false);
        throw error;
      }
    }) as T;
  }

  /**
   * Format bytes to human readable
   */
  static formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
  }

  /**
   * Format duration to human readable
   */
  static formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(2)}s`;
    return `${(ms / 60000).toFixed(2)}m`;
  }
}

/**
 * Singleton instance for global performance monitoring
 */
export const globalMonitor = new PerformanceMonitor(
  process.env.PERF_MONITORING === 'true'
);

/**
 * Decorator for monitoring async methods
 */
export function monitored(operation?: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    const operationName = operation || `${target.constructor.name}.${propertyKey}`;

    descriptor.value = async function (...args: any[]) {
      const operationId = `${operationName}-${Date.now()}`;
      globalMonitor.startOperation(operationId, operationName);

      try {
        const result = await originalMethod.apply(this, args);
        globalMonitor.endOperation(operationId, true);
        return result;
      } catch (error) {
        globalMonitor.endOperation(operationId, false);
        throw error;
      }
    };

    return descriptor;
  };
}

/**
 * Batch processing optimizer
 */
export class BatchProcessor<T, R> {
  private queue: Array<{ item: T; resolve: (value: R) => void; reject: (error: any) => void }> = [];
  private processing = false;
  private processTimer?: NodeJS.Timeout;

  constructor(
    private processor: (items: T[]) => Promise<R[]>,
    private options: {
      maxBatchSize: number;
      maxWaitTime: number;
      concurrency?: number;
    } = {
      maxBatchSize: 100,
      maxWaitTime: 100
    }
  ) {}

  /**
   * Add item to batch queue
   */
  async add(item: T): Promise<R> {
    return new Promise((resolve, reject) => {
      this.queue.push({ item, resolve, reject });

      // Process immediately if batch is full
      if (this.queue.length >= this.options.maxBatchSize) {
        this.processBatch();
      } else {
        // Schedule batch processing
        if (!this.processTimer) {
          this.processTimer = setTimeout(() => {
            this.processBatch();
          }, this.options.maxWaitTime);
        }
      }
    });
  }

  /**
   * Process current batch
   */
  private async processBatch(): Promise<void> {
    if (this.processing || this.queue.length === 0) return;

    this.processing = true;
    if (this.processTimer) {
      clearTimeout(this.processTimer);
      this.processTimer = undefined;
    }

    // Take items from queue
    const batch = this.queue.splice(0, this.options.maxBatchSize);
    const items = batch.map(b => b.item);

    try {
      const results = await this.processor(items);

      // Resolve promises
      batch.forEach((b, i) => {
        b.resolve(results[i]);
      });
    } catch (error) {
      // Reject all promises in batch
      batch.forEach(b => {
        b.reject(error);
      });
    } finally {
      this.processing = false;

      // Process next batch if queue has items
      if (this.queue.length > 0) {
        setImmediate(() => this.processBatch());
      }
    }
  }

  /**
   * Flush remaining items
   */
  async flush(): Promise<void> {
    while (this.queue.length > 0 || this.processing) {
      await this.processBatch();
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }
}