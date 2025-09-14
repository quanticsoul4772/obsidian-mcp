import { FileUtils } from "./file-utils.js";
import { ObsidianParser } from "./obsidian-parser.js";
import { LinkParser } from "./link-parser.js";
import { ObsidianConfig } from "../types/obsidian.js";
import { PerformanceHelpers } from "./performance-helpers.js";
import * as path from 'path';
import * as crypto from 'crypto';

export interface VaultError {
  path?: string;
  operation?: string;
  error: string;
}

export interface VaultResponse<T> {
  data: T;
  errors?: VaultError[];
  metadata?: {
    totalProcessed: number;
    successCount: number;
    errorCount: number;
  };
}

export interface VaultStatistics {
  totalNotes: number;
  totalFolders: number;
  totalSize: number;
  totalTags: number;
  totalLinks: number;
  fileTypes: Record<string, number>;
  largestFiles: Array<{ path: string; size: number }>;
  oldestFiles: Array<{ path: string; created: Date }>;
  newestFiles: Array<{ path: string; created: Date }>;
  mostRecentlyModified: Array<{ path: string; modified: Date }>;
}

export interface BrokenLink {
  sourcePath: string;
  targetPath: string;
  linkText: string;
}

export interface DuplicateNote {
  paths: string[];
  similarity: number;
  type: "content" | "title";
}

export interface CleanupResult {
  orphansRemoved: string[];
  brokenLinksFixed: number;
  emptyFoldersRemoved: string[];
  filenamesNormalized: Array<{ oldPath: string; newPath: string }>;
}

export class VaultUtils {
  constructor(
    private fileUtils: FileUtils,
    private parser: ObsidianParser,
    private linkParser: LinkParser,
    private config: ObsidianConfig
  ) {}

  async getVaultStatistics(): Promise<VaultResponse<VaultStatistics>> {
    const files = await this.fileUtils.listAllFiles();
    const markdownFiles = files.filter((f: string) => f.endsWith('.md'));
    const folders = new Set<string>();
    const errors: VaultError[] = [];
    
    let totalSize = 0;
    const fileTypes: Record<string, number> = {};
    const fileSizes: Array<{ path: string; size: number }> = [];
    const fileCreated: Array<{ path: string; created: Date }> = [];
    const fileModified: Array<{ path: string; modified: Date }> = [];
    
    // Collect all unique tags
    const allTags = new Set<string>();
    let totalLinks = 0;
    let processedCount = 0;
    
    // Process files in batches for better performance
    const fileResults = await PerformanceHelpers.batchProcess(
      files,
      async (file) => {
        processedCount++;
        try {
          const stats = await this.fileUtils.getStats(file);
          const result: any = {
            file,
            stats,
            size: stats.size,
            created: stats.birthtime,
            modified: stats.mtime
          };
          
          // Track folders
          const dir = path.dirname(file);
          if (dir !== '.') {
            result.folder = dir;
          }
          
          // Track file types
          result.ext = path.extname(file);
          
          // For markdown files, get tags and links
          if (file.endsWith('.md')) {
            const content = await this.fileUtils.readFile(file);
            const { data: frontmatter } = this.parser.parseFrontmatter(content);
            const tags = this.parser.extractTags(content, frontmatter);
            const links = await this.linkParser.getForwardLinks(file);
            
            result.tags = tags;
            result.linkCount = links.length;
          }
          
          return result;
        } catch (error) {
          throw {
            path: file,
            operation: 'getVaultStatistics',
            error: error instanceof Error ? error.message : String(error)
          };
        }
      },
      10 // Process 10 files concurrently
    );
    
    // Process results
    for (const result of fileResults) {
      if (result.error) {
        // The error from batchProcess is a string, so we need to construct a VaultError
        errors.push({
          path: result.item,
          operation: 'getVaultStatistics',
          error: result.error
        });
      } else if (result.result) {
        const data = result.result;
        totalSize += data.size;
        
        if (data.folder) {
          folders.add(data.folder);
        }
        
        fileTypes[data.ext] = (fileTypes[data.ext] || 0) + 1;
        fileSizes.push({ path: data.file, size: data.size });
        fileCreated.push({ path: data.file, created: data.created });
        fileModified.push({ path: data.file, modified: data.modified });
        
        if (data.tags) {
          data.tags.forEach((tag: string) => allTags.add(tag));
        }
        if (data.linkCount !== undefined) {
          totalLinks += data.linkCount;
        }
      }
    }
    
    // Sort and limit results
    const largestFiles = fileSizes
      .sort((a, b) => b.size - a.size)
      .slice(0, 10);
    
    const oldestFiles = fileCreated
      .sort((a, b) => a.created.getTime() - b.created.getTime())
      .slice(0, 10);
    
    const newestFiles = fileCreated
      .sort((a, b) => b.created.getTime() - a.created.getTime())
      .slice(0, 10);
    
    const mostRecentlyModified = fileModified
      .sort((a, b) => b.modified.getTime() - a.modified.getTime())
      .slice(0, 10);
    
    return {
      data: {
        totalNotes: markdownFiles.length,
        totalFolders: folders.size,
        totalSize,
        totalTags: allTags.size,
        totalLinks,
        fileTypes,
        largestFiles,
        oldestFiles,
        newestFiles,
        mostRecentlyModified
      },
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };
  }

  async createDailyNote(date: Date, template?: string, folder?: string): Promise<{ path: string; created: boolean }> {
    const dailyFolder = folder || this.config.dailyNotes?.folder || 'Daily Notes';
    const format = this.config.dailyNotes?.format || 'YYYY-MM-DD';
    
    // Format date
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day);
    
    const notePath = path.join(dailyFolder, `${dateStr}.md`);
    
    // Check if already exists
    if (await this.fileUtils.exists(notePath)) {
      return { path: notePath, created: false };
    }
    
    // Create content
    let content = template || '';
    if (!template && this.config.dailyNotes?.template) {
      try {
        const templatePath = `${this.config.dailyNotes.template}.md`;
        const templateContent = await this.fileUtils.readFile(templatePath);
        content = this.processTemplate(templateContent, { date: dateStr });
      } catch (error) {
        // Use default template if specified template not found
        content = `# ${dateStr}\n\n## Notes\n\n## Tasks\n- [ ] \n\n## References\n`;
      }
    }
    
    // Ensure folder exists
    await this.fileUtils.ensureDir(dailyFolder);
    
    // Create file
    await this.fileUtils.writeFile(notePath, content);
    
    return { path: notePath, created: true };
  }

  async applyTemplate(templatePath: string, targetPath: string, variables?: Record<string, string>): Promise<{ path: string; created: boolean }> {
    try {
      const templateContent = await this.fileUtils.readFile(templatePath);
      const processedContent = this.processTemplate(templateContent, variables);
      
      await this.fileUtils.writeFile(targetPath, processedContent);
      
      return { path: targetPath, created: true };
    } catch (error) {
      throw new Error(`Failed to apply template: ${error}`);
    }
  }

  async findBrokenLinks(): Promise<VaultResponse<BrokenLink[]>> {
    const brokenLinks: BrokenLink[] = [];
    const errors: VaultError[] = [];
    const files = await this.fileUtils.listMarkdownFiles();
    let processedCount = 0;
    
    for (const file of files) {
      processedCount++;
      try {
        const content = await this.fileUtils.readFile(file);
        const links = this.parser.extractAllLinks(content);
        
        for (const link of links) {
          // Skip external links
          if (link.type === 'external') continue;
          
          const targetPath = this.fileUtils.ensureMarkdownExtension(link.target);
          if (!await this.fileUtils.exists(targetPath)) {
            brokenLinks.push({
              sourcePath: file,
              targetPath: link.target,
              linkText: link.displayText || link.target
            });
          }
        }
      } catch (error) {
        errors.push({
          path: file,
          operation: 'findBrokenLinks',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return {
      data: brokenLinks,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };
  }

  async findDuplicateNotes(options: {
    threshold?: number;
    checkContent?: boolean;
    checkTitles?: boolean;
  } = {}): Promise<VaultResponse<DuplicateNote[]>> {
    const { threshold = 0.8, checkContent = true, checkTitles = true } = options;
    const duplicates: DuplicateNote[] = [];
    const errors: VaultError[] = [];
    const files = await this.fileUtils.listMarkdownFiles();
    const processed = new Set<string>();
    let processedCount = 0;
    
    // First pass: get file sizes for all files
    const fileSizes = new Map<string, number>();
    for (const file of files) {
      try {
        const stats = await this.fileUtils.getStats(file);
        fileSizes.set(file, stats.size);
      } catch (error) {
        errors.push({
          path: file,
          operation: 'findDuplicateNotes.getStats',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    // Process files in batches to limit memory usage
    const BATCH_SIZE = 20;
    
    for (let i = 0; i < files.length; i++) {
      const file1 = files[i];
      if (processed.has(file1)) continue;
      processedCount++;
      
      const file1Size = fileSizes.get(file1) || 0;
      const duplicateGroup: string[] = [file1];
      let lastSimilarity = 0;
      let lastType: "content" | "title" = "content";
      
      // Process potential duplicates in batches
      for (let j = i + 1; j < files.length; j += BATCH_SIZE) {
        const batch = files.slice(j, Math.min(j + BATCH_SIZE, files.length));
        
        for (const file2 of batch) {
          if (processed.has(file2)) continue;
          
          let similarity = 0;
          let type: "content" | "title" = "content";
          
          // Check title similarity
          if (checkTitles) {
            const title1 = path.basename(file1, '.md').toLowerCase();
            const title2 = path.basename(file2, '.md').toLowerCase();
            
            if (title1 === title2) {
              similarity = 1;
              type = "title";
            } else {
              const titleSim = this.calculateStringSimilarity(title1, title2);
              if (titleSim > similarity) {
                similarity = titleSim;
                type = "title";
              }
            }
          }
          
          // Check content similarity with performance optimizations
          if (checkContent && similarity < threshold) {
            try {
              const file2Size = fileSizes.get(file2) || 0;
              
              // Strategy based on file sizes - be VERY conservative
              const SAFE_SIZE_LIMIT = 50 * 1024; // 50KB max for string comparison
              
              if (file1Size > SAFE_SIZE_LIMIT || file2Size > SAFE_SIZE_LIMIT) {
                // For any file over 50KB, only use hash comparison
                // First check if sizes are similar (within 10%)
                const sizeDiff = Math.abs(file1Size - file2Size);
                const avgSize = (file1Size + file2Size) / 2;
                
                if (sizeDiff / avgSize < 0.1) {
                  // Sizes are similar, compute hashes
                  const hash1 = await this.computeFileHash(file1);
                  const hash2 = await this.computeFileHash(file2);
                  
                  if (hash1 === hash2) {
                    similarity = 1;
                    type = "content";
                  }
                }
                // Skip files with very different sizes
              } else {
                // For small files (<50KB), do content comparison
                try {
                  const content1 = await this.fileUtils.readFile(file1);
                  const content2 = await this.fileUtils.readFile(file2);
                  
                  // Additional safety check on actual content length
                  if (content1.length > SAFE_SIZE_LIMIT || content2.length > SAFE_SIZE_LIMIT) {
                    // File was larger than expected, use hash instead
                    const hash1 = await this.computeFileHash(file1);
                    const hash2 = await this.computeFileHash(file2);
                    
                    if (hash1 === hash2) {
                      similarity = 1;
                      type = "content";
                    }
                  } else {
                    const contentSim = this.calculateStringSimilarity(content1, content2);
                    if (contentSim > similarity) {
                      similarity = contentSim;
                      type = "content";
                    }
                  }
                } catch (error) {
                  // If reading fails, try hash comparison
                  try {
                    const hash1 = await this.computeFileHash(file1);
                    const hash2 = await this.computeFileHash(file2);
                    
                    if (hash1 === hash2) {
                      similarity = 1;
                      type = "content";
                    }
                  } catch (hashError) {
                    // Skip this comparison
                  }
                }
              }
            } catch (error) {
              errors.push({
                path: file2,
                operation: 'findDuplicateNotes.contentComparison',
                error: error instanceof Error ? error.message : String(error)
              });
            }
          }
          
          if (similarity >= threshold) {
            duplicateGroup.push(file2);
            processed.add(file2);
            lastSimilarity = similarity;
            lastType = type;
          }
        }
        
        // Allow garbage collection between batches
        if (global.gc) {
          global.gc();
        }
      }
      
      if (duplicateGroup.length > 1) {
        processed.add(file1);
        duplicates.push({
          paths: duplicateGroup,
          similarity: lastSimilarity,
          type: lastType
        });
      }
    }
    
    return {
      data: duplicates,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };
  }

  async cleanupVault(options: {
    removeOrphans?: boolean;
    fixBrokenLinks?: boolean;
    removeEmptyFolders?: boolean;
    normalizeFilenames?: boolean;
    dryRun?: boolean;
  } = {}): Promise<VaultResponse<CleanupResult>> {
    const {
      removeOrphans = false,
      fixBrokenLinks = false,
      removeEmptyFolders = false,
      normalizeFilenames = false,
      dryRun = true
    } = options;
    
    const result: CleanupResult = {
      orphansRemoved: [],
      brokenLinksFixed: 0,
      emptyFoldersRemoved: [],
      filenamesNormalized: []
    };
    const errors: VaultError[] = [];
    
    // Remove orphaned notes
    if (removeOrphans) {
      const files = await this.fileUtils.listMarkdownFiles();
      for (const file of files) {
        try {
          const backlinks = await this.getBacklinks(file);
          const forwardLinks = await this.linkParser.getForwardLinks(file);
          
          if (backlinks.length === 0 && forwardLinks.length === 0) {
            if (!dryRun) {
              await this.fileUtils.deleteFile(file);
            }
            result.orphansRemoved.push(file);
          }
        } catch (error) {
          errors.push({
            path: file,
            operation: 'removeOrphans',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    // Fix broken links (remove them)
    if (fixBrokenLinks) {
      const brokenLinksResponse = await this.findBrokenLinks();
      
      if (brokenLinksResponse.errors) {
        errors.push(...brokenLinksResponse.errors);
      }
      
      for (const broken of brokenLinksResponse.data) {
        try {
          if (!dryRun) {
            const content = await this.fileUtils.readFile(broken.sourcePath);
            const fixed = this.parser.removeLink(content, broken.targetPath);
            await this.fileUtils.writeFile(broken.sourcePath, fixed);
          }
          result.brokenLinksFixed++;
        } catch (error) {
          errors.push({
            path: broken.sourcePath,
            operation: 'fixBrokenLinks',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    // Remove empty folders
    if (removeEmptyFolders) {
      const folders = await this.fileUtils.listFolders();
      
      for (const folder of folders) {
        try {
          const isEmpty = await this.fileUtils.isFolderEmpty(folder);
          if (isEmpty) {
            if (!dryRun) {
              await this.fileUtils.deleteFolder(folder);
            }
            result.emptyFoldersRemoved.push(folder);
          }
        } catch (error) {
          errors.push({
            path: folder,
            operation: 'removeEmptyFolders',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    // Normalize filenames
    if (normalizeFilenames) {
      const files = await this.fileUtils.listMarkdownFiles();
      
      for (const file of files) {
        try {
          const dir = path.dirname(file);
          const basename = path.basename(file, '.md');
          const normalized = this.normalizeFilename(basename);
          
          if (normalized !== basename) {
            const newPath = path.join(dir, `${normalized}.md`);
            
            if (!await this.fileUtils.exists(newPath)) {
              if (!dryRun) {
                await this.fileUtils.renameFile(file, newPath);
                // Update links in other files
                await this.updateLinksInVault(file, newPath);
              }
              result.filenamesNormalized.push({ oldPath: file, newPath });
            }
          }
        } catch (error) {
          errors.push({
            path: file,
            operation: 'normalizeFilenames',
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
    
    return {
      data: result,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: result.orphansRemoved.length + result.brokenLinksFixed + 
                      result.emptyFoldersRemoved.length + result.filenamesNormalized.length,
        successCount: result.orphansRemoved.length + result.brokenLinksFixed + 
                      result.emptyFoldersRemoved.length + result.filenamesNormalized.length,
        errorCount: errors.length
      }
    };
  }

  async exportVaultStructure(options: {
    includeContent?: boolean;
    includeMetadata?: boolean;
    format?: "json" | "tree" | "flat";
  } = {}): Promise<VaultResponse<any>> {
    const { includeContent = false, includeMetadata = true, format = "json" } = options;
    const errors: VaultError[] = [];
    
    if (format === "flat") {
      const files = await this.fileUtils.listAllFiles();
      const result = [];
      
      for (const file of files) {
        const entry: any = { path: file };
        
        if (includeMetadata) {
          try {
            const stats = await this.fileUtils.getStats(file);
            entry.size = stats.size;
            entry.created = stats.birthtime;
            entry.modified = stats.mtime;
          } catch (error) {
            errors.push({
              path: file,
              operation: 'exportVaultStructure.metadata',
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        
        if (includeContent && file.endsWith('.md')) {
          try {
            // Check file size before reading
            const stats = await this.fileUtils.getStats(file);
            if (PerformanceHelpers.isLargeFile(stats.size)) {
              // For large files, just include a preview
              const preview = await PerformanceHelpers.readFilePreview(
                this.fileUtils.toAbsolutePath(file),
                20
              );
              entry.content = preview.join('\n');
              entry.contentTruncated = true;
            } else {
              entry.content = await this.fileUtils.readFile(file);
            }
          } catch (error) {
            errors.push({
              path: file,
              operation: 'exportVaultStructure.content',
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
        
        result.push(entry);
      }
      
      return {
        data: result,
        errors: errors.length > 0 ? errors : undefined,
        metadata: {
          totalProcessed: files.length,
          successCount: files.length - errors.length,
          errorCount: errors.length
        }
      };
    }
    
    // Build tree structure
    const root: any = { name: "vault", type: "folder", children: {} };
    const files = await this.fileUtils.listAllFiles();
    let processedCount = 0;
    
    for (const file of files) {
      processedCount++;
      try {
        const parts = file.split(path.sep);
        let current = root;
        
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current.children[part]) {
            current.children[part] = { name: part, type: "folder", children: {} };
          }
          current = current.children[part];
        }
        
        const filename = parts[parts.length - 1];
        const fileEntry: any = { name: filename, type: "file" };
        
        if (includeMetadata) {
          try {
            const stats = await this.fileUtils.getStats(file);
            fileEntry.size = stats.size;
            fileEntry.created = stats.birthtime;
            fileEntry.modified = stats.mtime;
          } catch (error) {
            // Continue without metadata
          }
        }
        
        if (includeContent && file.endsWith('.md')) {
          try {
            fileEntry.content = await this.fileUtils.readFile(file);
          } catch (error) {
            // Continue without content
          }
        }
        
        current.children[filename] = fileEntry;
      } catch (error) {
        errors.push({
          path: file,
          operation: 'exportVaultStructure.tree',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const resultData = format === "tree" ? this.formatAsTree(root) : root;
    
    return {
      data: resultData,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };
  }

  private processTemplate(template: string, variables?: Record<string, string>): string {
    let processed = template;
    
    // Replace variables
    if (variables) {
      for (const [key, value] of Object.entries(variables)) {
        const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
        processed = processed.replace(regex, value);
      }
    }
    
    // Replace date variables
    const now = new Date();
    processed = processed
      .replace(/{{date}}/g, now.toISOString().split('T')[0])
      .replace(/{{time}}/g, now.toTimeString().split(' ')[0])
      .replace(/{{timestamp}}/g, now.toISOString());
    
    return processed;
  }

  private calculateStringSimilarity(str1: string, str2: string): number {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) {
      return 1.0;
    }
    
    // For very large strings, use a more efficient approach
    const MAX_LEVENSHTEIN_LENGTH = 1000; // ~1KB max for Levenshtein
    
    if (longer.length > MAX_LEVENSHTEIN_LENGTH) {
      // For large strings, use a sampling approach
      return this.calculateSampledSimilarity(str1, str2);
    }
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Calculate similarity for large strings using sampling
   */
  private calculateSampledSimilarity(str1: string, str2: string): number {
    // Check exact equality first
    if (str1 === str2) return 1.0;
    
    // Check length similarity
    const lengthRatio = Math.min(str1.length, str2.length) / Math.max(str1.length, str2.length);
    if (lengthRatio < 0.5) return 0; // Very different lengths
    
    // Sample multiple parts of the strings
    const SAMPLE_SIZE = 500;
    const NUM_SAMPLES = 5;
    let totalSimilarity = 0;
    
    for (let i = 0; i < NUM_SAMPLES; i++) {
      const offset = Math.floor((i / NUM_SAMPLES) * Math.max(0, Math.min(str1.length, str2.length) - SAMPLE_SIZE));
      const sample1 = str1.substring(offset, offset + SAMPLE_SIZE);
      const sample2 = str2.substring(offset, offset + SAMPLE_SIZE);
      
      if (sample1 && sample2) {
        const editDistance = this.levenshteinDistance(sample1, sample2);
        const similarity = (Math.max(sample1.length, sample2.length) - editDistance) / Math.max(sample1.length, sample2.length);
        totalSimilarity += similarity;
      }
    }
    
    // Weight the length ratio and content similarity
    return (lengthRatio * 0.3) + ((totalSimilarity / NUM_SAMPLES) * 0.7);
  }

  private levenshteinDistance(str1: string, str2: string): number {
    // Prevent memory explosion - strict limit
    const MAX_LENGTH = 1000; // 1KB max
    if (str1.length > MAX_LENGTH || str2.length > MAX_LENGTH) {
      // Don't even attempt Levenshtein for strings over 1KB
      return str1 === str2 ? 0 : Math.max(str1.length, str2.length);
    }
    
    const matrix = [];
    
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    
    return matrix[str2.length][str1.length];
  }

  private normalizeFilename(filename: string): string {
    return filename
      .toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim();
  }

  private async getBacklinks(file: string): Promise<string[]> {
    const backlinks: string[] = [];
    const files = await this.fileUtils.listMarkdownFiles();
    
    for (const f of files) {
      if (f === file) continue;
      
      try {
        const links = await this.linkParser.getForwardLinks(f);
        if (links.some((link: string) => this.fileUtils.ensureMarkdownExtension(link) === file)) {
          backlinks.push(f);
        }
      } catch (error) {
        // Continue without this file
      }
    }
    
    return backlinks;
  }

  private async updateLinksInVault(oldPath: string, newPath: string): Promise<void> {
    const files = await this.fileUtils.listMarkdownFiles();
    const oldName = path.basename(oldPath, '.md');
    const newName = path.basename(newPath, '.md');
    
    for (const file of files) {
      try {
        const content = await this.fileUtils.readFile(file);
        const updated = this.parser.updateLinks(content, oldName, newName);
        
        if (updated !== content) {
          await this.fileUtils.writeFile(file, updated);
        }
      } catch (error) {
        // Continue without updating this file
      }
    }
  }

  private formatAsTree(node: any, prefix: string = '', isLast: boolean = true): string {
    let result = prefix;
    
    if (prefix) {
      result += isLast ? '└── ' : '├── ';
    }
    
    result += node.name;
    
    if (node.type === 'file' && node.size !== undefined) {
      result += ` (${this.formatBytes(node.size)})`;
    }
    
    result += '\n';
    
    if (node.children) {
      const children = Object.values(node.children);
      children.forEach((child: any, index) => {
        const extension = prefix + (isLast ? '    ' : '│   ');
        result += this.formatAsTree(child, extension, index === children.length - 1);
      });
    }
    
    return result;
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Compute hash of file content for efficient comparison
   */
  private async computeFileHash(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('sha256');
      const stream = require('fs').createReadStream(this.fileUtils.toAbsolutePath(filePath));
      
      stream.on('data', (data: Buffer) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }
}
