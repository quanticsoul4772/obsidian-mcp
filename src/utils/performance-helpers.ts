import * as fs from 'fs';
import * as readline from 'readline';

/**
 * Simple performance helpers for Claude-only Obsidian MCP server
 * Focus: Handle large vaults without crashing
 */

export class PerformanceHelpers {
  static readonly LARGE_FILE_THRESHOLD = 5 * 1024 * 1024; // 5MB
  static readonly DEFAULT_BATCH_SIZE = 10;

  /**
   * Check if a file is considered large
   */
  static isLargeFile(sizeInBytes: number): boolean {
    return sizeInBytes > this.LARGE_FILE_THRESHOLD;
  }

  /**
   * Read file line by line for large files
   */
  static async* streamReadLines(filePath: string): AsyncGenerator<string, void, unknown> {
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });

    try {
      for await (const line of rl) {
        yield line;
      }
    } finally {
      rl.close();
      fileStream.destroy();
    }
  }

  /**
   * Search in large file with early termination
   */
  static async searchLargeFile(
    filePath: string,
    searchRegex: RegExp,
    maxMatches: number = 10
  ): Promise<Array<{ line: number; text: string }>> {
    const matches: Array<{ line: number; text: string }> = [];
    let lineNumber = 0;

    for await (const line of this.streamReadLines(filePath)) {
      lineNumber++;
      if (searchRegex.test(line)) {
        matches.push({ line: lineNumber, text: line });
        if (matches.length >= maxMatches) {
          break;
        }
      }
    }

    return matches;
  }

  /**
   * Process items in batches with concurrency limit
   */
  static async batchProcess<T, R>(
    items: T[],
    processor: (item: T) => Promise<R>,
    batchSize: number = this.DEFAULT_BATCH_SIZE
  ): Promise<Array<{ result?: R; error?: string; item: T }>> {
    const results: Array<{ result?: R; error?: string; item: T }> = [];

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      const batchPromises = batch.map(async (item) => {
        try {
          const result = await processor(item);
          return { result, item };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : String(error),
            item
          };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    return results;
  }

  /**
   * Read first N lines of a file for preview
   */
  static async readFilePreview(filePath: string, maxLines: number = 50): Promise<string[]> {
    const lines: string[] = [];
    
    for await (const line of this.streamReadLines(filePath)) {
      lines.push(line);
      if (lines.length >= maxLines) {
        break;
      }
    }

    return lines;
  }

  /**
   * Count lines in a large file without loading into memory
   */
  static async countLines(filePath: string): Promise<number> {
    let count = 0;
    
    for await (const _ of this.streamReadLines(filePath)) {
      count++;
    }

    return count;
  }
}
