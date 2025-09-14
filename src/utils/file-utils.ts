import * as fs from 'fs/promises';
import * as path from 'path';
import { glob } from 'glob';
import { ObsidianNote } from '../types/obsidian.js';
import { LRUCache } from '../lru-cache.js';

export class FileUtils {
  private vaultPath: string;
  private cache?: LRUCache<string>;

  constructor(vaultPath: string, cache?: LRUCache<string>) {
    this.vaultPath = vaultPath;
    this.cache = cache;
  }

  // Convert relative path to absolute vault path
  toAbsolutePath(relativePath: string): string {
    if (path.isAbsolute(relativePath)) {
      return relativePath;
    }
    return path.join(this.vaultPath, relativePath);
  }

  // Convert absolute path to relative vault path
  toRelativePath(absolutePath: string): string {
    return path.relative(this.vaultPath, absolutePath);
  }

  // Ensure path has .md extension
  ensureMarkdownExtension(filePath: string): string {
    if (!filePath.endsWith('.md')) {
      return `${filePath}.md`;
    }
    return filePath;
  }

  // Check if file exists
  async exists(filePath: string): Promise<boolean> {
    try {
      const absPath = this.toAbsolutePath(filePath);
      await fs.access(absPath);
      return true;
    } catch {
      return false;
    }
  }

  // Get file stats
  async getStats(filePath: string) {
    const absPath = this.toAbsolutePath(filePath);
    return await fs.stat(absPath);
  }

  // Read file content
  async readFile(filePath: string): Promise<string> {
    const normalizedPath = this.ensureMarkdownExtension(filePath);
    
    // Check cache first
    if (this.cache) {
      const cached = this.cache.get(normalizedPath);
      if (cached) {
        return cached;
      }
    }
    
    // Read from disk
    const absPath = this.toAbsolutePath(normalizedPath);
    const content = await fs.readFile(absPath, 'utf-8');
    
    // Cache if under 5MB
    if (this.cache && content.length < 5 * 1024 * 1024) {
      const size = Buffer.byteLength(content, 'utf8');
      this.cache.set(normalizedPath, content, size);
    }
    
    return content;
  }

  // Write file content
  async writeFile(filePath: string, content: string): Promise<void> {
    const normalizedPath = this.ensureMarkdownExtension(filePath);
    const absPath = this.toAbsolutePath(normalizedPath);
    const dir = path.dirname(absPath);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(absPath, content, 'utf-8');
    
    // Invalidate cache
    this.cache?.delete(normalizedPath);
  }

  // Delete file
  async deleteFile(filePath: string): Promise<void> {
    const normalizedPath = this.ensureMarkdownExtension(filePath);
    const absPath = this.toAbsolutePath(normalizedPath);
    await fs.unlink(absPath);
    
    // Invalidate cache
    this.cache?.delete(normalizedPath);
  }

  // Rename/move file
  async renameFile(oldPath: string, newPath: string): Promise<void> {
    const normalizedOldPath = this.ensureMarkdownExtension(oldPath);
    const normalizedNewPath = this.ensureMarkdownExtension(newPath);
    const absOldPath = this.toAbsolutePath(normalizedOldPath);
    const absNewPath = this.toAbsolutePath(normalizedNewPath);
    
    // Ensure target directory exists
    const newDir = path.dirname(absNewPath);
    await fs.mkdir(newDir, { recursive: true });
    
    await fs.rename(absOldPath, absNewPath);
    
    // Invalidate old path from cache
    this.cache?.delete(normalizedOldPath);
  }

  // List all markdown files
  async listMarkdownFiles(pattern: string = '**/*.md'): Promise<string[]> {
    const files = await glob(pattern, {
      cwd: this.vaultPath,
      ignore: ['node_modules/**', '.obsidian/**', '.trash/**']
    });
    return files.sort();
  }

  // Find files by name pattern
  async findFiles(namePattern: string): Promise<string[]> {
    const allFiles = await this.listMarkdownFiles();
    const regex = new RegExp(namePattern, 'i');
    return allFiles.filter(file => regex.test(path.basename(file)));
  }

  // Get all files in a folder
  async getFilesInFolder(folderPath: string): Promise<string[]> {
    const pattern = path.join(folderPath, '**/*.md');
    return await this.listMarkdownFiles(pattern);
  }

  // Create folder if it doesn't exist
  async ensureFolder(folderPath: string): Promise<void> {
    const absPath = this.toAbsolutePath(folderPath);
    await fs.mkdir(absPath, { recursive: true });
  }

  // Check if path is a folder
  async isFolder(filePath: string): Promise<boolean> {
    try {
      const absPath = this.toAbsolutePath(filePath);
      const stats = await fs.stat(absPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  // Get file size in bytes
  async getFileSize(filePath: string): Promise<number> {
    const stats = await this.getStats(filePath);
    return stats.size;
  }

  // List all files in the vault (including non-markdown)
  async listAllFiles(): Promise<string[]> {
    const allFiles: string[] = [];
    
    async function walk(dir: string, basePath: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relativePath = path.relative(basePath, fullPath);
        
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          await walk(fullPath, basePath);
        } else if (entry.isFile() && !entry.name.startsWith('.')) {
          allFiles.push(relativePath);
        }
      }
    }
    
    await walk(this.vaultPath, this.vaultPath);
    return allFiles;
  }

  // List all folders in the vault
  async listFolders(): Promise<string[]> {
    const folders: string[] = [];
    
    async function walk(dir: string, basePath: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isDirectory() && !entry.name.startsWith('.')) {
          const fullPath = path.join(dir, entry.name);
          const relativePath = path.relative(basePath, fullPath);
          folders.push(relativePath);
          await walk(fullPath, basePath);
        }
      }
    }
    
    await walk(this.vaultPath, this.vaultPath);
    return folders;
  }

  // Check if a folder is empty
  async isFolderEmpty(folderPath: string): Promise<boolean> {
    const fullPath = path.join(this.vaultPath, folderPath);
    const entries = await fs.readdir(fullPath);
    return entries.length === 0;
  }

  // Delete a folder
  async deleteFolder(folderPath: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, folderPath);
    await fs.rmdir(fullPath, { recursive: true });
  }

  // Ensure a directory exists
  async ensureDir(dirPath: string): Promise<void> {
    const fullPath = path.join(this.vaultPath, dirPath);
    await fs.mkdir(fullPath, { recursive: true });
  }
}
