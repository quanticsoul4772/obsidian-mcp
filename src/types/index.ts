/**
 * Centralized type definitions for obsidian-mcp
 */

export interface FileInfo {
  path: string;
  name: string;
  size: number;
  created: Date;
  modified: Date;
  extension: string;
  isMarkdown: boolean;
}

export interface FileContent {
  content: string;
  frontmatter?: Record<string, unknown>;
  metadata: FileMetadata;
}

export interface FileMetadata {
  path: string;
  size: number;
  wordCount: number;
  lineCount: number;
  created: string;
  modified: string;
  cacheHit?: boolean;
}

export interface SearchResult {
  path: string;
  score: number;
  matches: SearchMatch[];
  snippet?: string;
  frontmatter?: Record<string, unknown>;
}

export interface SearchMatch {
  line: number;
  column: number;
  length: number;
  content: string;
  context?: {
    before: string;
    after: string;
  };
}

export interface LinkInfo {
  from: string;
  to: string;
  type: 'wiki' | 'markdown' | 'external';
  line: number;
  column: number;
  text?: string;
}

export interface GraphNode {
  path: string;
  title: string;
  backlinks: string[];
  forwardLinks: string[];
  tags: string[];
  wordCount: number;
}

export interface GraphEdge {
  source: string;
  target: string;
  weight: number;
}

export interface VaultStatistics {
  totalFiles: number;
  totalSize: number;
  totalWords: number;
  totalLinks: number;
  totalTags: number;
  uniqueTags: string[];
  fileTypes: Record<string, number>;
  largestFiles: FileInfo[];
  mostLinkedFiles: GraphNode[];
  orphanedFiles: string[];
  averageFileSize: number;
  medianFileSize: number;
}

export interface ToolResponse<T = unknown> {
  success: boolean;
  data?: T;
  errors?: string[];
  metadata?: ResponseMetadata;
}

export interface ResponseMetadata {
  totalProcessed?: number;
  successCount?: number;
  errorCount?: number;
  processingTime?: number;
  cacheHit?: boolean;
  cacheSize?: number;
  timestamp?: string;
  [key: string]: unknown;
}

export interface CacheOptions {
  maxSize: number;
  maxItems: number;
  ttl?: number;
}

export interface CacheStats {
  size: number;
  items: number;
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
  oldestEntry?: number;
  newestEntry?: number;
}

export interface EditOperation {
  oldText: string;
  newText: string;
  replaceAll?: boolean;
}

export interface EditResult {
  applied: boolean;
  original: string;
  modified: string;
  changes: number;
  diff?: string;
}

export interface BatchOperation<T> {
  items: T[];
  concurrency?: number;
  continueOnError?: boolean;
  progress?: (completed: number, total: number) => void;
}

export interface BatchResult<T> {
  successful: T[];
  failed: Array<{ item: T; error: string }>;
  totalProcessed: number;
  successCount: number;
  errorCount: number;
  processingTime: number;
}

export type SortOrder = 'asc' | 'desc';
export type SortField = 'name' | 'size' | 'created' | 'modified' | 'wordCount';

export interface ListOptions {
  folder?: string;
  pattern?: string;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  limit?: number;
  offset?: number;
  includeMetadata?: boolean;
}

export interface SearchOptions {
  query: string;
  caseSensitive?: boolean;
  wholeWord?: boolean;
  regex?: boolean;
  limit?: number;
  folder?: string;
  filePattern?: string;
  includeContent?: boolean;
  includeMetadata?: boolean;
}

export interface TagSearchOptions {
  tags: string[];
  matchAll?: boolean;
  includeNested?: boolean;
  folder?: string;
  limit?: number;
}

export interface DateRange {
  start?: Date | string;
  end?: Date | string;
}

export interface AdvancedSearchOptions {
  text?: string;
  tags?: string[];
  frontmatter?: Record<string, unknown>;
  dateRange?: DateRange;
  folder?: string;
  filePattern?: string;
  sortBy?: SortField;
  sortOrder?: SortOrder;
  limit?: number;
}

/**
 * Type guards
 */
export function isFileInfo(obj: unknown): obj is FileInfo {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'path' in obj &&
    'name' in obj &&
    'size' in obj &&
    typeof (obj as FileInfo).path === 'string'
  );
}

export function isSearchResult(obj: unknown): obj is SearchResult {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'path' in obj &&
    'score' in obj &&
    'matches' in obj &&
    Array.isArray((obj as SearchResult).matches)
  );
}

export function isToolResponse(obj: unknown): obj is ToolResponse {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'success' in obj &&
    typeof (obj as ToolResponse).success === 'boolean'
  );
}