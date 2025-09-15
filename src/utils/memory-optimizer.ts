/**
 * Memory optimization utilities
 */

interface WeakValueMapEntry<V extends object> {
  ref: WeakRef<V>;
  size: number;
}

/**
 * Map that holds weak references to values for automatic garbage collection
 */
export class WeakValueMap<K, V extends object> {
  private map: Map<K, WeakValueMapEntry<V>> = new Map();
  private finalizationRegistry: FinalizationRegistry<K>;
  private totalSize = 0;

  constructor(private maxSize: number = 50 * 1024 * 1024) { // 50MB default
    this.finalizationRegistry = new FinalizationRegistry((key: K) => {
      this.handleFinalization(key);
    });
  }

  /**
   * Set value with weak reference
   */
  set(key: K, value: V, size: number = 0): void {
    // Remove existing entry if present
    this.delete(key);

    // Check size constraints
    if (size > this.maxSize) {
      return; // Don't store items larger than max size
    }

    // Make room if needed
    while (this.totalSize + size > this.maxSize && this.map.size > 0) {
      // Remove oldest entry
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        this.delete(firstKey);
      }
    }

    // Create weak reference
    const ref = new WeakRef(value);
    this.map.set(key, { ref, size });
    this.totalSize += size;

    // Register for cleanup notification
    this.finalizationRegistry.register(value, key, value);
  }

  /**
   * Get value if still in memory
   */
  get(key: K): V | undefined {
    const entry = this.map.get(key);
    if (!entry) return undefined;

    const value = entry.ref.deref();
    if (!value) {
      // Value was garbage collected
      this.delete(key);
      return undefined;
    }

    return value;
  }

  /**
   * Delete entry
   */
  delete(key: K): boolean {
    const entry = this.map.get(key);
    if (!entry) return false;

    const value = entry.ref.deref();
    if (value) {
      this.finalizationRegistry.unregister(value);
    }

    this.totalSize -= entry.size;
    return this.map.delete(key);
  }

  /**
   * Handle finalization when object is garbage collected
   */
  private handleFinalization(key: K): void {
    const entry = this.map.get(key);
    if (entry) {
      this.totalSize -= entry.size;
      this.map.delete(key);
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    let activeCount = 0;
    let deadCount = 0;

    for (const [key, entry] of this.map.entries()) {
      if (entry.ref.deref()) {
        activeCount++;
      } else {
        deadCount++;
        this.delete(key);
      }
    }

    return {
      activeEntries: activeCount,
      deadEntries: deadCount,
      totalSize: this.totalSize,
      maxSize: this.maxSize
    };
  }

  /**
   * Clear all entries
   */
  clear(): void {
    for (const [_key, entry] of this.map.entries()) {
      const value = entry.ref.deref();
      if (value) {
        this.finalizationRegistry.unregister(value);
      }
    }
    this.map.clear();
    this.totalSize = 0;
  }
}

/**
 * Object pool for reusing expensive objects
 */
export class ObjectPool<T> {
  private pool: T[] = [];
  private inUse: Set<T> = new Set();
  private createFn: () => T;
  private resetFn?: (obj: T) => void;
  private maxSize: number;

  constructor(options: {
    create: () => T;
    reset?: (obj: T) => void;
    maxSize?: number;
    initialSize?: number;
  }) {
    this.createFn = options.create;
    this.resetFn = options.reset;
    this.maxSize = options.maxSize || 100;

    // Pre-populate pool
    const initialSize = options.initialSize || 0;
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }

  /**
   * Acquire object from pool
   */
  acquire(): T {
    let obj = this.pool.pop();

    if (!obj) {
      obj = this.createFn();
    }

    this.inUse.add(obj);
    return obj;
  }

  /**
   * Release object back to pool
   */
  release(obj: T): void {
    if (!this.inUse.has(obj)) {
      return; // Object not from this pool
    }

    this.inUse.delete(obj);

    // Reset object if reset function provided
    if (this.resetFn) {
      this.resetFn(obj);
    }

    // Add back to pool if not at max capacity
    if (this.pool.length < this.maxSize) {
      this.pool.push(obj);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    return {
      available: this.pool.length,
      inUse: this.inUse.size,
      total: this.pool.length + this.inUse.size
    };
  }

  /**
   * Clear pool
   */
  clear(): void {
    this.pool = [];
    this.inUse.clear();
  }
}

/**
 * Memory-efficient buffer pool
 */
export class BufferPool {
  private pools: Map<number, Buffer[]> = new Map();
  private readonly sizes = [
    1024,      // 1KB
    4096,      // 4KB
    16384,     // 16KB
    65536,     // 64KB
    262144,    // 256KB
    1048576    // 1MB
  ];

  /**
   * Get buffer of at least the specified size
   */
  acquire(minSize: number): Buffer {
    // Find appropriate size bucket
    const size = this.sizes.find(s => s >= minSize) || minSize;

    // Get or create pool for this size
    let pool = this.pools.get(size);
    if (!pool) {
      pool = [];
      this.pools.set(size, pool);
    }

    // Get buffer from pool or allocate new one
    let buffer = pool.pop();
    if (!buffer) {
      buffer = Buffer.allocUnsafe(size);
    }

    return buffer;
  }

  /**
   * Return buffer to pool
   */
  release(buffer: Buffer): void {
    const size = buffer.length;

    // Only pool standard sizes
    if (!this.sizes.includes(size)) {
      return;
    }

    let pool = this.pools.get(size);
    if (!pool) {
      pool = [];
      this.pools.set(size, pool);
    }

    // Limit pool size
    if (pool.length < 10) {
      // Clear buffer before returning to pool
      buffer.fill(0);
      pool.push(buffer);
    }
  }

  /**
   * Get pool statistics
   */
  getStats() {
    const stats: Record<string, number> = {};

    for (const [size, pool] of this.pools.entries()) {
      stats[`${size}B`] = pool.length;
    }

    return stats;
  }

  /**
   * Clear all pools
   */
  clear(): void {
    this.pools.clear();
  }
}

/**
 * Lazy value loader for deferred computation
 */
export class LazyValue<T> {
  private value?: T;
  private loading = false;
  private error?: Error;
  private loadPromise?: Promise<T>;

  constructor(
    private loader: () => T | Promise<T>,
    private options: {
      ttl?: number;
      errorRetry?: boolean;
    } = {}
  ) {}

  /**
   * Get value, loading if necessary
   */
  async get(): Promise<T> {
    // Return cached value if available
    if (this.value !== undefined && !this.isExpired()) {
      return this.value;
    }

    // Return cached error if retry disabled
    if (this.error && !this.options.errorRetry) {
      throw this.error;
    }

    // If already loading, wait for completion
    if (this.loading && this.loadPromise) {
      return this.loadPromise;
    }

    // Start loading
    this.loading = true;
    this.error = undefined;

    this.loadPromise = Promise.resolve()
      .then(() => this.loader())
      .then(value => {
        this.value = value;
        this.loading = false;
        this.setExpiration();
        return value;
      })
      .catch(error => {
        this.error = error;
        this.loading = false;
        throw error;
      });

    return this.loadPromise;
  }

  /**
   * Check if value is loaded
   */
  isLoaded(): boolean {
    return this.value !== undefined && !this.isExpired();
  }

  /**
   * Clear cached value
   */
  clear(): void {
    this.value = undefined;
    this.error = undefined;
    this.loading = false;
    this.loadPromise = undefined;
  }

  private expirationTime?: number;

  private setExpiration(): void {
    if (this.options.ttl) {
      this.expirationTime = Date.now() + this.options.ttl;
    }
  }

  private isExpired(): boolean {
    if (!this.expirationTime) return false;
    return Date.now() > this.expirationTime;
  }
}

/**
 * Memory pressure monitor
 */
export class MemoryMonitor {
  private checkInterval?: NodeJS.Timeout;
  private callbacks: Array<(pressure: number) => void> = [];
  private lastPressure = 0;

  constructor(
    private thresholds = {
      low: 0.5,    // 50% memory usage
      medium: 0.7, // 70% memory usage
      high: 0.85   // 85% memory usage
    }
  ) {}

  /**
   * Start monitoring memory
   */
  start(intervalMs: number = 5000): void {
    if (this.checkInterval) return;

    this.checkInterval = setInterval(() => {
      this.checkMemory();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
  }

  /**
   * Register callback for memory pressure changes
   */
  onPressure(callback: (pressure: number) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Check current memory pressure
   */
  private checkMemory(): void {
    const usage = process.memoryUsage();
    const totalMemory = usage.heapTotal;
    const usedMemory = usage.heapUsed;
    const pressure = usedMemory / totalMemory;

    // Notify if pressure changed significantly
    if (Math.abs(pressure - this.lastPressure) > 0.05) {
      this.lastPressure = pressure;
      this.callbacks.forEach(cb => cb(pressure));
    }

    // Force garbage collection if pressure is high
    if (pressure > this.thresholds.high && global.gc) {
      global.gc();
    }
  }

  /**
   * Get current memory stats
   */
  getStats() {
    const usage = process.memoryUsage();
    const pressure = usage.heapUsed / usage.heapTotal;

    return {
      pressure,
      level: this.getPressureLevel(pressure),
      heapUsed: usage.heapUsed,
      heapTotal: usage.heapTotal,
      rss: usage.rss,
      external: usage.external
    };
  }

  /**
   * Get pressure level
   */
  private getPressureLevel(pressure: number): 'low' | 'medium' | 'high' | 'critical' {
    if (pressure < this.thresholds.low) return 'low';
    if (pressure < this.thresholds.medium) return 'medium';
    if (pressure < this.thresholds.high) return 'high';
    return 'critical';
  }
}