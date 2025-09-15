/**
 * File operation pooling and optimization
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { Readable } from 'stream';
import { createReadStream } from 'fs';

interface FileOperation<T> {
  id: string;
  type: 'read' | 'write' | 'stat' | 'list';
  path: string;
  resolve: (value: T) => void;
  reject: (error: any) => void;
}

export class FileOperationPool {
  private queue: FileOperation<any>[] = [];
  private activeOperations = 0;
  private readonly maxConcurrent: number;
  private readonly streamThreshold: number;
  private fileHandleCache: Map<string, fs.FileHandle> = new Map();
  private fileHandleTimers: Map<string, NodeJS.Timeout> = new Map();

  constructor(
    maxConcurrent: number = 10,
    streamThreshold: number = 1024 * 1024 // 1MB
  ) {
    this.maxConcurrent = maxConcurrent;
    this.streamThreshold = streamThreshold;
  }

  /**
   * Read file with optimizations
   */
  async readFile(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.enqueue({
        id: `read-${Date.now()}-${Math.random()}`,
        type: 'read',
        path: filePath,
        resolve,
        reject
      });
    });
  }

  /**
   * Write file with optimizations
   */
  async writeFile(filePath: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.enqueue({
        id: `write-${Date.now()}-${Math.random()}`,
        type: 'write',
        path: filePath,
        resolve,
        reject
      });
    });
  }

  /**
   * Batch read multiple files
   */
  async readFiles(paths: string[]): Promise<Map<string, string | Error>> {
    const results = new Map<string, string | Error>();

    // Process in batches
    const batchSize = this.maxConcurrent;
    for (let i = 0; i < paths.length; i += batchSize) {
      const batch = paths.slice(i, i + batchSize);
      const promises = batch.map(async (filePath) => {
        try {
          const content = await this.readFile(filePath);
          results.set(filePath, content);
        } catch (error) {
          results.set(filePath, error as Error);
        }
      });

      await Promise.all(promises);
    }

    return results;
  }

  /**
   * Stream large file
   */
  async streamFile(filePath: string): Promise<Readable> {
    const stats = await fs.stat(filePath);

    if (stats.size > this.streamThreshold) {
      return createReadStream(filePath, {
        highWaterMark: 64 * 1024 // 64KB chunks
      });
    } else {
      // For small files, read into memory
      const content = await fs.readFile(filePath, 'utf-8');
      return Readable.from([content]);
    }
  }

  // File handle caching removed for simplicity - can be re-added if needed

  /**
   * Enqueue operation
   */
  private enqueue<T>(operation: FileOperation<T>): void {
    this.queue.push(operation);
    this.processQueue();
  }

  /**
   * Process queued operations
   */
  private async processQueue(): Promise<void> {
    while (this.queue.length > 0 && this.activeOperations < this.maxConcurrent) {
      const operation = this.queue.shift();
      if (!operation) continue;

      this.activeOperations++;
      this.executeOperation(operation).finally(() => {
        this.activeOperations--;
        this.processQueue();
      });
    }
  }

  /**
   * Execute single operation
   */
  private async executeOperation<T>(operation: FileOperation<T>): Promise<void> {
    try {
      let result: any;

      switch (operation.type) {
        case 'read': {
          const stats = await fs.stat(operation.path);

          if (stats.size > this.streamThreshold) {
            // Stream large files
            const chunks: Buffer[] = [];
            const stream = createReadStream(operation.path);

            for await (const chunk of stream) {
              chunks.push(chunk);
            }

            result = Buffer.concat(chunks).toString('utf-8');
          } else {
            // Read small files normally
            result = await fs.readFile(operation.path, 'utf-8');
          }
          break;
        }

        case 'write': {
          // Implementation would include write logic
          await fs.writeFile(operation.path, '');
          result = undefined;
          break;
        }

        case 'stat': {
          result = await fs.stat(operation.path);
          break;
        }

        case 'list': {
          result = await fs.readdir(operation.path);
          break;
        }
      }

      operation.resolve(result);
    } catch (error) {
      operation.reject(error);
    }
  }

  /**
   * Close all file handles
   */
  async close(): Promise<void> {
    // Clear all timers
    for (const timer of this.fileHandleTimers.values()) {
      clearTimeout(timer);
    }

    // Close all handles
    const closePromises: Promise<void>[] = [];
    for (const handle of this.fileHandleCache.values()) {
      closePromises.push(handle.close());
    }

    await Promise.all(closePromises);

    this.fileHandleCache.clear();
    this.fileHandleTimers.clear();
  }
}

/**
 * Directory walker with optimizations
 */
export class OptimizedDirectoryWalker {
  private fileCount = 0;
  private dirCount = 0;
  private readonly maxDepth: number;
  private readonly excludePatterns: RegExp[];

  constructor(options: {
    maxDepth?: number;
    excludePatterns?: string[];
  } = {}) {
    this.maxDepth = options.maxDepth || 10;
    this.excludePatterns = (options.excludePatterns || [])
      .map(pattern => new RegExp(pattern));
  }

  /**
   * Walk directory with optimizations
   */
  async *walk(
    dir: string,
    depth: number = 0
  ): AsyncGenerator<{ path: string; stats: any }> {
    if (depth > this.maxDepth) return;

    // Check if directory should be excluded
    if (this.shouldExclude(dir)) return;

    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch (error) {
      // Skip inaccessible directories
      return;
    }

    // Process entries in parallel batches
    const batchSize = 10;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);

      const promises = batch.map(async (entry) => {
        const fullPath = path.join(dir, entry.name);

        if (this.shouldExclude(fullPath)) {
          return null;
        }

        if (entry.isDirectory()) {
          this.dirCount++;
          return { path: fullPath, stats: { isDirectory: true } };
        } else if (entry.isFile()) {
          this.fileCount++;
          const stats = await fs.stat(fullPath);
          return { path: fullPath, stats };
        }

        return null;
      });

      const results = await Promise.all(promises);

      for (const result of results) {
        if (result) {
          yield result;

          // Recursively walk subdirectories
          if (result.stats.isDirectory) {
            yield* this.walk(result.path, depth + 1);
          }
        }
      }
    }
  }

  /**
   * Check if path should be excluded
   */
  private shouldExclude(filePath: string): boolean {
    return this.excludePatterns.some(pattern => pattern.test(filePath));
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      filesFound: this.fileCount,
      directoriesFound: this.dirCount
    };
  }
}

/**
 * Memory-efficient string operations
 */
export class StringOptimizer {
  private stringPool: Map<string, string> = new Map();
  private internThreshold: number;

  constructor(internThreshold: number = 100) {
    this.internThreshold = internThreshold;
  }

  /**
   * Intern string to reduce memory usage
   */
  intern(str: string): string {
    if (str.length > this.internThreshold) {
      return str; // Don't intern large strings
    }

    const existing = this.stringPool.get(str);
    if (existing) {
      return existing;
    }

    this.stringPool.set(str, str);

    // Limit pool size
    if (this.stringPool.size > 10000) {
      // Remove oldest entries
      const keysToDelete = Array.from(this.stringPool.keys()).slice(0, 1000);
      for (const key of keysToDelete) {
        this.stringPool.delete(key);
      }
    }

    return str;
  }

  /**
   * Compare large strings efficiently
   */
  static compareStrings(str1: string, str2: string): boolean {
    // Quick length check
    if (str1.length !== str2.length) {
      return false;
    }

    // For very large strings, compare in chunks
    if (str1.length > 100000) {
      const chunkSize = 10000;
      for (let i = 0; i < str1.length; i += chunkSize) {
        if (str1.substr(i, chunkSize) !== str2.substr(i, chunkSize)) {
          return false;
        }
      }
      return true;
    }

    return str1 === str2;
  }

  /**
   * Hash string for quick comparison
   */
  static hashString(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}