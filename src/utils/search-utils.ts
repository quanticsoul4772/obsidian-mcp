import { FileUtils } from "./file-utils.js";
import { ObsidianParser } from "./obsidian-parser.js";
import { LinkParser } from "./link-parser.js";
import { PerformanceHelpers } from "./performance-helpers.js";
import { LRUCache } from "../lru-cache.js";

export interface SearchOptions {
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  limit?: number;
}

export interface SearchResult {
  path: string;
  matches: Array<{
    line: number;
    text: string;
    context: string;
  }>;
  score?: number;
}

export interface SearchError {
  path?: string;
  operation?: string;
  error: string;
}

export interface SearchResponse<T> {
  results: T;
  errors?: SearchError[];
  metadata?: {
    totalProcessed: number;
    successCount: number;
    errorCount: number;
  };
}

export interface AdvancedSearchOptions {
  text?: string;
  tags?: string[];
  frontmatter?: Record<string, any>;
  folder?: string;
  filePattern?: string;
  dateRange?: {
    startDate?: Date;
    endDate?: Date;
    dateField?: "created" | "modified";
  };
  limit?: number;
}

export class SearchUtils {
  private cache?: LRUCache<any>;

  constructor(
    private fileUtils: FileUtils,
    private parser: ObsidianParser,
    private linkParser: LinkParser,
    cache?: LRUCache<any>
  ) {
    this.cache = cache;
  }

  async searchText(query: string, options: SearchOptions = {}): Promise<SearchResponse<SearchResult[]>> {
    const {
      caseSensitive = false,
      wholeWord = false,
      regex = false,
      limit = 50
    } = options;

    // Check cache first
    const cacheKey = JSON.stringify({ query, options });
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const results: SearchResult[] = [];
    const errors: SearchError[] = [];
    const files = await this.fileUtils.listMarkdownFiles();
    let processedCount = 0;

    let searchRegex: RegExp;
    if (regex) {
      searchRegex = new RegExp(query, caseSensitive ? 'g' : 'gi');
    } else {
      const escapedQuery = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = wholeWord ? `\\b${escapedQuery}\\b` : escapedQuery;
      searchRegex = new RegExp(pattern, caseSensitive ? 'g' : 'gi');
    }

    for (const file of files) {
      if (results.length >= limit) break;
      processedCount++;

      try {
        const stats = await this.fileUtils.getStats(file);
        
        // Use streaming for large files
        if (PerformanceHelpers.isLargeFile(stats.size)) {
          const matches = await PerformanceHelpers.searchLargeFile(
            this.fileUtils.toAbsolutePath(file),
            searchRegex,
            10
          );
          
          if (matches.length > 0) {
            results.push({
              path: file,
              matches: matches.map(m => ({
                line: m.line,
                text: m.text,
                context: m.text // For large files, context is the line itself
              }))
            });
          }
        } else {
          const content = await this.fileUtils.readFile(file);
          const lines = content.split('\n');
          const matches: SearchResult['matches'] = [];

          lines.forEach((line, index) => {
            if (searchRegex.test(line)) {
              matches.push({
                line: index + 1,
                text: line,
                context: this.getContext(lines, index)
              });
            }
          });

          if (matches.length > 0) {
            results.push({ path: file, matches });
          }
        }
      } catch (error) {
        errors.push({
          path: file,
          operation: 'searchText',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const response = {
      results: results.slice(0, limit),
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };

    // Cache the response
    if (this.cache) {
      const size = Buffer.byteLength(JSON.stringify(response), 'utf8');
      this.cache.set(cacheKey, response, size);
    }

    return response;
  }

  async searchByTags(tags: string[], matchAll: boolean = false): Promise<SearchResponse<string[]>> {
    const results: string[] = [];
    const errors: SearchError[] = [];
    const files = await this.fileUtils.listMarkdownFiles();
    let processedCount = 0;

    for (const file of files) {
      processedCount++;
      try {
        const content = await this.fileUtils.readFile(file);
        const { data: frontmatter } = this.parser.parseFrontmatter(content);
        const fileTags = this.parser.extractTags(content, frontmatter);

        const hasMatch = matchAll
          ? tags.every(tag => fileTags.includes(tag))
          : tags.some(tag => fileTags.includes(tag));

        if (hasMatch) {
          results.push(file);
        }
      } catch (error) {
        errors.push({
          path: file,
          operation: 'searchByTags',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      results,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };
  }

  async searchByLinks(paths: string[], direction: "to" | "from" | "both", matchAll: boolean): Promise<SearchResponse<string[]>> {
    const results: string[] = [];
    const errors: SearchError[] = [];
    const files = await this.fileUtils.listMarkdownFiles();
    let processedCount = 0;

    for (const file of files) {
      processedCount++;
      try {
        const links = await this.linkParser.getForwardLinks(file);
        let hasMatch = false;

        if (direction === "to" || direction === "both") {
          const hasToMatch = matchAll
            ? paths.every(path => links.includes(path))
            : paths.some(path => links.includes(path));
          if (hasToMatch) hasMatch = true;
        }

        if (direction === "from" || direction === "both") {
          for (const path of paths) {
            const pathLinks = await this.linkParser.getForwardLinks(path);
            if (pathLinks.includes(file)) {
              hasMatch = true;
              break;
            }
          }
        }

        if (hasMatch) {
          results.push(file);
        }
      } catch (error) {
        errors.push({
          path: file,
          operation: 'searchByLinks',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      results,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };
  }

  async searchByDate(options: {
    startDate?: Date;
    endDate?: Date;
    dateField?: "created" | "modified" | "both";
  }): Promise<SearchResponse<string[]>> {
    const { startDate, endDate, dateField = "modified" } = options;
    const results: string[] = [];
    const errors: SearchError[] = [];
    const files = await this.fileUtils.listMarkdownFiles();
    let processedCount = 0;

    for (const file of files) {
      processedCount++;
      try {
        const stats = await this.fileUtils.getStats(file);
        let include = false;

        if (dateField === "created" || dateField === "both") {
          const created = stats.birthtime;
          if ((!startDate || created >= startDate) && (!endDate || created <= endDate)) {
            include = true;
          }
        }

        if (dateField === "modified" || dateField === "both") {
          const modified = stats.mtime;
          if ((!startDate || modified >= startDate) && (!endDate || modified <= endDate)) {
            include = true;
          }
        }

        if (include) {
          results.push(file);
        }
      } catch (error) {
        errors.push({
          path: file,
          operation: 'searchByDate',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    return {
      results,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };
  }

  async advancedSearch(options: AdvancedSearchOptions): Promise<SearchResponse<SearchResult[]>> {
    // Check cache first
    const cacheKey = JSON.stringify({ method: 'advancedSearch', options });
    if (this.cache) {
      const cached = this.cache.get(cacheKey);
      if (cached) {
        return cached;
      }
    }

    let files = await this.fileUtils.listMarkdownFiles();
    const results: SearchResult[] = [];
    const errors: SearchError[] = [];
    let processedCount = 0;

    // Filter by folder
    if (options.folder) {
      files = files.filter(file => file.startsWith(options.folder!));
    }

    // Filter by file pattern
    if (options.filePattern) {
      const pattern = new RegExp(options.filePattern);
      files = files.filter(file => pattern.test(file));
    }

    // Filter by date range
    if (options.dateRange) {
      const dateResponse = await this.searchByDate({
        startDate: options.dateRange.startDate,
        endDate: options.dateRange.endDate,
        dateField: options.dateRange.dateField
      });
      files = files.filter(file => dateResponse.results.includes(file));
      
      // Include date search errors
      if (dateResponse.errors) {
        errors.push(...dateResponse.errors);
      }
    }

    // Search in filtered files
    for (const file of files) {
      if (results.length >= (options.limit || 100)) break;
      processedCount++;

      try {
        const content = await this.fileUtils.readFile(file);
        const { data: frontmatter } = this.parser.parseFrontmatter(content);
        let matches = 0;

        // Check tags
        if (options.tags && options.tags.length > 0) {
          const fileTags = this.parser.extractTags(content, frontmatter);
          if (!options.tags.some(tag => fileTags.includes(tag))) {
            continue;
          }
          matches++;
        }

        // Check frontmatter
        if (options.frontmatter) {
          let frontmatterMatch = true;
          for (const [key, value] of Object.entries(options.frontmatter)) {
            if (frontmatter[key] !== value) {
              frontmatterMatch = false;
              break;
            }
          }
          if (!frontmatterMatch) continue;
          matches++;
        }

        // Check text
        const textMatches: SearchResult['matches'] = [];
        if (options.text) {
          const searchResponse = await this.searchText(options.text, { limit: 1 });
          const fileResult = searchResponse.results.find(r => r.path === file);
          if (fileResult) {
            textMatches.push(...fileResult.matches);
            matches++;
          } else if (matches === 0) {
            continue;
          }
        }

        if (matches > 0 || textMatches.length > 0) {
          results.push({
            path: file,
            matches: textMatches,
            score: matches
          });
        }
      } catch (error) {
        errors.push({
          path: file,
          operation: 'advancedSearch',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }

    const response = {
      results: results.sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, options.limit || 100),
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };

    // Cache the response
    if (this.cache) {
      const size = Buffer.byteLength(JSON.stringify(response), 'utf8');
      this.cache.set(cacheKey, response, size);
    }

    return response;
  }

  async findSimilarNotes(path: string, limit: number = 10, minSimilarity: number = 0.3): Promise<SearchResponse<Array<{ path: string; similarity: number }>>> {
    const errors: SearchError[] = [];
    const similarities: Array<{ path: string; similarity: number }> = [];
    let processedCount = 0;

    try {
      const referenceContent = await this.fileUtils.readFile(path);
      const { data: referenceFrontmatter } = this.parser.parseFrontmatter(referenceContent);
      const referenceTags = this.parser.extractTags(referenceContent, referenceFrontmatter);
      const referenceLinks = await this.linkParser.getForwardLinks(path);

      const files = await this.fileUtils.listMarkdownFiles();

      for (const file of files) {
        if (file === path) continue;
        processedCount++;

        try {
          const content = await this.fileUtils.readFile(file);
          const { data: frontmatter } = this.parser.parseFrontmatter(content);
          const tags = this.parser.extractTags(content, frontmatter);
          const links = await this.linkParser.getForwardLinks(file);

          // Calculate similarity based on tags, links, and content
          let similarity = 0;

          // Tag similarity
          const commonTags = tags.filter(tag => referenceTags.includes(tag));
          const tagSimilarity = commonTags.length / Math.max(tags.length, referenceTags.length);
          similarity += tagSimilarity * 0.3;

          // Link similarity
          const commonLinks = links.filter((link: string) => referenceLinks.includes(link));
          const linkSimilarity = commonLinks.length / Math.max(links.length, referenceLinks.length);
          similarity += linkSimilarity * 0.3;

          // Content similarity (simple word overlap)
          const refWords = this.getWords(referenceContent);
          const fileWords = this.getWords(content);
          const commonWords = refWords.filter(word => fileWords.includes(word));
          const contentSimilarity = commonWords.length / Math.max(refWords.length, fileWords.length);
          similarity += contentSimilarity * 0.4;

          if (similarity >= minSimilarity) {
            similarities.push({ path: file, similarity });
          }
        } catch (error) {
          errors.push({
            path: file,
            operation: 'findSimilarNotes',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      return {
        results: similarities
          .sort((a, b) => b.similarity - a.similarity)
          .slice(0, limit),
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          totalProcessed: processedCount,
          successCount: processedCount - errors.length,
          errorCount: errors.length
        }
      };
    } catch (error) {
      throw new Error(`Failed to find similar notes: ${error}`);
    }
  }

  private getContext(lines: string[], lineIndex: number, contextLines: number = 2): string {
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);
    return lines.slice(start, end).join('\n');
  }

  private getWords(content: string): string[] {
    return content
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 3);
  }
}
