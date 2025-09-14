import { FileUtils } from "./file-utils.js";
import { ObsidianParser } from "./obsidian-parser.js";

export interface MetadataError {
  path?: string;
  operation?: string;
  error: string;
}

export interface MetadataResponse<T> {
  data: T;
  errors?: MetadataError[];
  metadata?: {
    totalProcessed: number;
    successCount: number;
    errorCount: number;
  };
}

export class MetadataUtils {
  constructor(
    private fileUtils: FileUtils,
    private parser: ObsidianParser
  ) {}

  async getFrontmatter(path: string): Promise<Record<string, any>> {
    try {
      const content = await this.fileUtils.readFile(path);
      const { data } = this.parser.parseFrontmatter(content);
      return data;
    } catch (error) {
      throw new Error(`Failed to get frontmatter: ${error}`);
    }
  }

  async updateFrontmatter(path: string, frontmatter: Record<string, any>, merge: boolean = true): Promise<void> {
    try {
      const content = await this.fileUtils.readFile(path);
      const { data: existingFrontmatter, content: body } = this.parser.parseFrontmatter(content);
      
      const newFrontmatter = merge 
        ? { ...existingFrontmatter, ...frontmatter }
        : frontmatter;
      
      const newContent = this.parser.stringifyWithFrontmatter(newFrontmatter, body);
      await this.fileUtils.writeFile(path, newContent);
    } catch (error) {
      throw new Error(`Failed to update frontmatter: ${error}`);
    }
  }

  async getTags(path: string): Promise<string[]> {
    try {
      const content = await this.fileUtils.readFile(path);
      const { data: frontmatter } = this.parser.parseFrontmatter(content);
      return this.parser.extractTags(content, frontmatter);
    } catch (error) {
      throw new Error(`Failed to get tags: ${error}`);
    }
  }

  async addTags(path: string, tags: string[], location: "frontmatter" | "inline" | "both" = "frontmatter"): Promise<void> {
    try {
      const content = await this.fileUtils.readFile(path);
      const { data: frontmatter, content: body } = this.parser.parseFrontmatter(content);
      
      // Normalize tags (remove # if present)
      const normalizedTags = tags.map(tag => tag.startsWith('#') ? tag.slice(1) : tag);
      
      if (location === "frontmatter" || location === "both") {
        const existingTags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [];
        const newTags = [...new Set([...existingTags, ...normalizedTags])];
        frontmatter.tags = newTags;
      }
      
      let newBody = body;
      if (location === "inline" || location === "both") {
        // Add tags at the end of the content if not already present
        for (const tag of normalizedTags) {
          const tagWithHash = `#${tag}`;
          if (!body.includes(tagWithHash)) {
            newBody = newBody.trim() + '\n\n' + tagWithHash;
          }
        }
      }
      
      const newContent = this.parser.stringifyWithFrontmatter(frontmatter, newBody);
      await this.fileUtils.writeFile(path, newContent);
    } catch (error) {
      throw new Error(`Failed to add tags: ${error}`);
    }
  }

  async removeTags(path: string, tags: string[], location: "frontmatter" | "inline" | "both" = "both"): Promise<void> {
    try {
      const content = await this.fileUtils.readFile(path);
      const { data: frontmatter, content: body } = this.parser.parseFrontmatter(content);
      
      // Normalize tags
      const normalizedTags = tags.map(tag => tag.startsWith('#') ? tag.slice(1) : tag);
      
      if (location === "frontmatter" || location === "both") {
        if (Array.isArray(frontmatter.tags)) {
          frontmatter.tags = frontmatter.tags.filter(tag => !normalizedTags.includes(tag));
          if (frontmatter.tags.length === 0) {
            delete frontmatter.tags;
          }
        }
      }
      
      let newBody = body;
      if (location === "inline" || location === "both") {
        // Remove inline tags
        for (const tag of normalizedTags) {
          const tagWithHash = `#${tag}`;
          // Remove tag with word boundaries to avoid partial matches
          const tagRegex = new RegExp(`\\s*${tagWithHash}\\b`, 'g');
          newBody = newBody.replace(tagRegex, '');
        }
      }
      
      const newContent = this.parser.stringifyWithFrontmatter(frontmatter, newBody);
      await this.fileUtils.writeFile(path, newContent);
    } catch (error) {
      throw new Error(`Failed to remove tags: ${error}`);
    }
  }

  async getAllTags(): Promise<MetadataResponse<string[]>> {
    const allTags = new Set<string>();
    const errors: MetadataError[] = [];
    const files = await this.fileUtils.listMarkdownFiles();
    let processedCount = 0;
    
    for (const file of files) {
      processedCount++;
      try {
        const tags = await this.getTags(file);
        tags.forEach(tag => allTags.add(tag));
      } catch (error) {
        errors.push({
          path: file,
          operation: 'getAllTags',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return {
      data: Array.from(allTags).sort(),
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: processedCount - errors.length,
        errorCount: errors.length
      }
    };
  }

  async findByFrontmatter(field: string, value?: any, exactMatch: boolean = true): Promise<MetadataResponse<string[]>> {
    const results: string[] = [];
    const errors: MetadataError[] = [];
    const files = await this.fileUtils.listMarkdownFiles();
    let processedCount = 0;
    
    for (const file of files) {
      processedCount++;
      try {
        const frontmatter = await this.getFrontmatter(file);
        
        if (!(field in frontmatter)) {
          continue;
        }
        
        if (value === undefined) {
          // Just checking if field exists
          results.push(file);
        } else if (exactMatch) {
          if (frontmatter[field] === value) {
            results.push(file);
          }
        } else {
          // Partial match for strings
          if (typeof frontmatter[field] === 'string' && typeof value === 'string') {
            if (frontmatter[field].toLowerCase().includes(value.toLowerCase())) {
              results.push(file);
            }
          } else if (Array.isArray(frontmatter[field]) && Array.isArray(value)) {
            // Check if arrays have common elements
            if (value.some(v => frontmatter[field].includes(v))) {
              results.push(file);
            }
          }
        }
      } catch (error) {
        errors.push({
          path: file,
          operation: 'findByFrontmatter',
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    return {
      data: results,
      errors: errors.length > 0 ? errors : undefined,
      metadata: {
        totalProcessed: processedCount,
        successCount: results.length,
        errorCount: errors.length
      }
    };
  }
}
