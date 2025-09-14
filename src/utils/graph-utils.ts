import { FileUtils } from "./file-utils.js";
import { LinkParser } from "./link-parser.js";

export interface GraphError {
  path?: string;
  operation?: string;
  error: string;
}

export interface GraphResponse<T> {
  data: T;
  errors?: GraphError[];
  metadata?: {
    totalProcessed: number;
    successCount: number;
    errorCount: number;
  };
}

export interface GraphStatistics {
  totalNotes: number;
  totalLinks: number;
  orphanedNotes: number;
  mostConnectedNotes: Array<{ path: string; connections: number }>;
  averageConnections: number;
}

export interface NoteConnection {
  path: string;
  backlinks: string[];
  forwardLinks: string[];
  depth: number;
}

export class GraphUtils {
  private linkCache: Map<string, string[]> = new Map();
  
  constructor(
    private fileUtils: FileUtils,
    private linkParser: LinkParser
  ) {}

  async getBacklinks(path: string): Promise<GraphResponse<string[]>> {
    const backlinks: string[] = [];
    const errors: GraphError[] = [];
    const files = await this.fileUtils.listMarkdownFiles();
    const normalizedPath = this.fileUtils.ensureMarkdownExtension(path);
    let processedCount = 0;
    
    for (const file of files) {
      if (file === normalizedPath) continue;
      processedCount++;
      
      try {
        const links = await this.getLinksFromFile(file);
        if (links.some(link => this.fileUtils.ensureMarkdownExtension(link) === normalizedPath)) {
          backlinks.push(file);
        }
      } catch (error) {
        errors.push({
          path: file,
          operation: 'getBacklinks',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return {
      data: backlinks,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };
  }

  async getForwardLinks(path: string): Promise<GraphResponse<string[]>> {
    try {
      const links = await this.getLinksFromFile(path);
      return {
        data: links,
        metadata: {
          totalProcessed: 1,
          successCount: 1,
          errorCount: 0
        }
      };
    } catch (error) {
      return {
        data: [],
        errors: [{
          path,
          operation: 'getForwardLinks',
          error: error instanceof Error ? error.message : String(error)
        }],
        metadata: {
          totalProcessed: 1,
          successCount: 0,
          errorCount: 1
        }
      };
    }
  }

  async findOrphanedNotes(): Promise<GraphResponse<string[]>> {
    const files = await this.fileUtils.listMarkdownFiles();
    const orphaned: string[] = [];
    const errors: GraphError[] = [];
    let processedCount = 0;
    
    for (const file of files) {
      processedCount++;
      try {
        const backlinksResponse = await this.getBacklinks(file);
        const forwardLinksResponse = await this.getForwardLinks(file);
        
        // Collect any errors from sub-operations
        if (backlinksResponse.errors) {
          errors.push(...backlinksResponse.errors);
        }
        if (forwardLinksResponse.errors) {
          errors.push(...forwardLinksResponse.errors);
        }
        
        if (backlinksResponse.data.length === 0 && forwardLinksResponse.data.length === 0) {
          orphaned.push(file);
        }
      } catch (error) {
        errors.push({
          path: file,
          operation: 'findOrphanedNotes',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return {
      data: orphaned,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };
  }

  async getNoteConnections(path: string, depth: number = 1): Promise<GraphResponse<Map<string, NoteConnection>>> {
    const connections = new Map<string, NoteConnection>();
    const errors: GraphError[] = [];
    const visited = new Set<string>();
    const queue: Array<{ path: string; depth: number }> = [{ path, depth: 0 }];
    let processedCount = 0;
    
    while (queue.length > 0) {
      const { path: currentPath, depth: currentDepth } = queue.shift()!;
      
      if (visited.has(currentPath) || currentDepth > depth) {
        continue;
      }
      
      visited.add(currentPath);
      processedCount++;
      
      try {
        const backlinksResponse = await this.getBacklinks(currentPath);
        const forwardLinksResponse = await this.getForwardLinks(currentPath);
        
        // Collect any errors
        if (backlinksResponse.errors) {
          errors.push(...backlinksResponse.errors);
        }
        if (forwardLinksResponse.errors) {
          errors.push(...forwardLinksResponse.errors);
        }
        
        connections.set(currentPath, {
          path: currentPath,
          backlinks: backlinksResponse.data,
          forwardLinks: forwardLinksResponse.data,
          depth: currentDepth
        });
        
        if (currentDepth < depth) {
          // Add connected notes to queue
          [...backlinksResponse.data, ...forwardLinksResponse.data].forEach(link => {
            if (!visited.has(link)) {
              queue.push({ path: link, depth: currentDepth + 1 });
            }
          });
        }
      } catch (error) {
        errors.push({
          path: currentPath,
          operation: 'getNoteConnections',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return {
      data: connections,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: connections.size,
        errorCount: errors.length
      }
    };
  }

  async findMostConnectedNotes(limit: number = 10): Promise<GraphResponse<Array<{ path: string; connections: number; backlinks: number; forwardLinks: number }>>> {
    const files = await this.fileUtils.listMarkdownFiles();
    const connections: Array<{ path: string; connections: number; backlinks: number; forwardLinks: number }> = [];
    const errors: GraphError[] = [];
    let processedCount = 0;
    
    for (const file of files) {
      processedCount++;
      try {
        const backlinksResponse = await this.getBacklinks(file);
        const forwardLinksResponse = await this.getForwardLinks(file);
        
        // Collect any errors
        if (backlinksResponse.errors) {
          errors.push(...backlinksResponse.errors);
        }
        if (forwardLinksResponse.errors) {
          errors.push(...forwardLinksResponse.errors);
        }
        
        connections.push({
          path: file,
          connections: backlinksResponse.data.length + forwardLinksResponse.data.length,
          backlinks: backlinksResponse.data.length,
          forwardLinks: forwardLinksResponse.data.length
        });
      } catch (error) {
        errors.push({
          path: file,
          operation: 'findMostConnectedNotes',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return {
      data: connections
        .sort((a, b) => b.connections - a.connections)
        .slice(0, limit),
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: connections.length,
        errorCount: errors.length
      }
    };
  }

  async findShortestPath(sourcePath: string, targetPath: string): Promise<GraphResponse<string[]>> {
    const source = this.fileUtils.ensureMarkdownExtension(sourcePath);
    const target = this.fileUtils.ensureMarkdownExtension(targetPath);
    const errors: GraphError[] = [];
    
    if (source === target) {
      return {
        data: [source],
        metadata: {
          totalProcessed: 0,
          successCount: 1,
          errorCount: 0
        }
      };
    }
    
    const queue: string[][] = [[source]];
    const visited = new Set<string>([source]);
    let processedCount = 0;
    
    while (queue.length > 0) {
      const path = queue.shift()!;
      const current = path[path.length - 1];
      processedCount++;
      
      try {
        const linksResponse = await this.getForwardLinks(current);
        
        if (linksResponse.errors) {
          errors.push(...linksResponse.errors);
        }
        
        for (const link of linksResponse.data) {
          const normalizedLink = this.fileUtils.ensureMarkdownExtension(link);
          
          if (normalizedLink === target) {
            return {
              data: [...path, normalizedLink],
              errors: errors.length > 0 ? errors : undefined,
              metadata: {
                totalProcessed: processedCount,
                successCount: processedCount - errors.length,
                errorCount: errors.length
              }
            };
          }
          
          if (!visited.has(normalizedLink)) {
            visited.add(normalizedLink);
            queue.push([...path, normalizedLink]);
          }
        }
      } catch (error) {
        errors.push({
          path: current,
          operation: 'findShortestPath',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return {
      data: [], // No path found
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };
  }

  async getGraphStatistics(): Promise<GraphResponse<GraphStatistics>> {
    const files = await this.fileUtils.listMarkdownFiles();
    let totalLinks = 0;
    const connectionCounts: Array<{ path: string; connections: number }> = [];
    const errors: GraphError[] = [];
    let processedCount = 0;
    
    for (const file of files) {
      processedCount++;
      try {
        const backlinksResponse = await this.getBacklinks(file);
        const forwardLinksResponse = await this.getForwardLinks(file);
        
        // Collect any errors
        if (backlinksResponse.errors) {
          errors.push(...backlinksResponse.errors);
        }
        if (forwardLinksResponse.errors) {
          errors.push(...forwardLinksResponse.errors);
        }
        
        const connections = backlinksResponse.data.length + forwardLinksResponse.data.length;
        
        totalLinks += forwardLinksResponse.data.length;
        connectionCounts.push({ path: file, connections });
      } catch (error) {
        errors.push({
          path: file,
          operation: 'getGraphStatistics',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const orphanedResponse = await this.findOrphanedNotes();
    if (orphanedResponse.errors) {
      errors.push(...orphanedResponse.errors);
    }
    
    const mostConnected = connectionCounts
      .sort((a, b) => b.connections - a.connections)
      .slice(0, 10);
    
    const averageConnections = connectionCounts.length > 0
      ? connectionCounts.reduce((sum, item) => sum + item.connections, 0) / connectionCounts.length
      : 0;
    
    return {
      data: {
        totalNotes: files.length,
        totalLinks,
        orphanedNotes: orphanedResponse.data.length,
        mostConnectedNotes: mostConnected,
        averageConnections
      },
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: connectionCounts.length,
        errorCount: errors.length
      }
    };
  }

  private async getLinksFromFile(path: string): Promise<string[]> {
    const normalizedPath = this.fileUtils.ensureMarkdownExtension(path);
    
    // Check cache first
    if (this.linkCache.has(normalizedPath)) {
      return this.linkCache.get(normalizedPath)!;
    }
    
    try {
      const links = await this.linkParser.getForwardLinks(normalizedPath);
      this.linkCache.set(normalizedPath, links);
      return links;
    } catch (error) {
      throw new Error(`Failed to get links from file: ${error}`);
    }
  }

  clearCache(): void {
    this.linkCache.clear();
  }
}
