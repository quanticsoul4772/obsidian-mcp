// LRU Cache implementation for obsidian-mcp

interface CacheEntry<T> {
  value: T;
  size: number;
  lastAccessed: number;
  accessCount: number;
}

export class LRUCache<T> {
  private cache: Map<string, CacheEntry<T>>;
  private maxSize: number;
  private maxItems: number;
  private currentSize: number;
  private ttl: number; // Time to live in milliseconds

  constructor(options: {
    maxSize: number; // Max size in bytes
    maxItems: number; // Max number of items
    ttl?: number; // Time to live in milliseconds
  }) {
    this.cache = new Map();
    this.maxSize = options.maxSize;
    this.maxItems = options.maxItems;
    this.currentSize = 0;
    this.ttl = options.ttl || 3600000; // Default 1 hour
  }

  /**
   * Get item from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return undefined;
    }

    // Check if entry has expired
    if (Date.now() - entry.lastAccessed > this.ttl) {
      this.delete(key);
      return undefined;
    }

    // Update access time and count
    entry.lastAccessed = Date.now();
    entry.accessCount++;

    // Move to end (most recently used)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value;
  }

  /**
   * Set item in cache
   */
  set(key: string, value: T, size: number): void {
    // Remove existing entry if present
    if (this.cache.has(key)) {
      this.delete(key);
    }

    // Check if we need to make room
    this.ensureSpace(size);

    // Add new entry
    const entry: CacheEntry<T> = {
      value,
      size,
      lastAccessed: Date.now(),
      accessCount: 1
    };

    this.cache.set(key, entry);
    this.currentSize += size;
  }

  /**
   * Delete item from cache
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (entry) {
      this.currentSize -= entry.size;
      return this.cache.delete(key);
    }

    return false;
  }

  /**
   * Clear all items from cache
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    itemCount: number;
    totalSize: number;
    maxSize: number;
    hitRate: number;
    avgAccessCount: number;
  } {
    let totalAccess = 0;
    
    for (const entry of this.cache.values()) {
      totalAccess += entry.accessCount;
    }

    return {
      itemCount: this.cache.size,
      totalSize: this.currentSize,
      maxSize: this.maxSize,
      hitRate: this.cache.size > 0 ? totalAccess / this.cache.size : 0,
      avgAccessCount: this.cache.size > 0 ? totalAccess / this.cache.size : 0
    };
  }

  /**
   * Ensure there's enough space for new item
   */
  private ensureSpace(requiredSize: number): void {
    // If single item is too large, don't cache it
    if (requiredSize > this.maxSize) {
      return;
    }

    // Remove expired items first
    this.removeExpired();

    // Remove least recently used items until we have space
    while (
      (this.currentSize + requiredSize > this.maxSize || 
       this.cache.size >= this.maxItems) && 
      this.cache.size > 0
    ) {
      // Get first (least recently used) item
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.delete(firstKey);
      }
    }
  }

  /**
   * Remove expired entries
   */
  private removeExpired(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.lastAccessed > this.ttl) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.delete(key);
    }
  }

  /**
   * Get keys of cached items
   */
  keys(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if key exists in cache
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return false;
    }

    // Check expiration
    if (Date.now() - entry.lastAccessed > this.ttl) {
      this.delete(key);
      return false;
    }

    return true;
  }
}

// Specialized cache for file content
export class FileContentCache extends LRUCache<string> {
  constructor(maxSizeInMB: number = 50, maxItems: number = 100) {
    super({
      maxSize: maxSizeInMB * 1024 * 1024,
      maxItems,
      ttl: 3600000 // 1 hour
    });
  }

  /**
   * Cache file content
   */
  cacheFile(path: string, content: string): void {
    const size = Buffer.byteLength(content, 'utf8');
    this.set(path, content, size);
  }

  /**
   * Get cached file content
   */
  getCachedFile(path: string): string | undefined {
    return this.get(path);
  }
}

// Specialized cache for parsed metadata
export class MetadataCache extends LRUCache<any> {
  constructor(maxItems: number = 500) {
    super({
      maxSize: 10 * 1024 * 1024, // 10MB for metadata
      maxItems,
      ttl: 1800000 // 30 minutes
    });
  }

  /**
   * Cache parsed frontmatter
   */
  cacheFrontmatter(path: string, frontmatter: any): void {
    const size = Buffer.byteLength(JSON.stringify(frontmatter), 'utf8');
    this.set(`fm:${path}`, frontmatter, size);
  }

  /**
   * Get cached frontmatter
   */
  getCachedFrontmatter(path: string): any | undefined {
    return this.get(`fm:${path}`);
  }

  /**
   * Cache parsed tags
   */
  cacheTags(path: string, tags: string[]): void {
    const size = Buffer.byteLength(JSON.stringify(tags), 'utf8');
    this.set(`tags:${path}`, tags, size);
  }

  /**
   * Get cached tags
   */
  getCachedTags(path: string): string[] | undefined {
    return this.get(`tags:${path}`);
  }
}

// Specialized cache for link relationships
export class LinkCache extends LRUCache<string[]> {
  constructor(maxItems: number = 1000) {
    super({
      maxSize: 5 * 1024 * 1024, // 5MB for links
      maxItems,
      ttl: 1800000 // 30 minutes
    });
  }

  /**
   * Cache backlinks
   */
  cacheBacklinks(path: string, backlinks: string[]): void {
    const size = Buffer.byteLength(JSON.stringify(backlinks), 'utf8');
    this.set(`back:${path}`, backlinks, size);
  }

  /**
   * Get cached backlinks
   */
  getCachedBacklinks(path: string): string[] | undefined {
    return this.get(`back:${path}`);
  }

  /**
   * Cache forward links
   */
  cacheForwardLinks(path: string, links: string[]): void {
    const size = Buffer.byteLength(JSON.stringify(links), 'utf8');
    this.set(`fwd:${path}`, links, size);
  }

  /**
   * Get cached forward links
   */
  getCachedForwardLinks(path: string): string[] | undefined {
    return this.get(`fwd:${path}`);
  }

  /**
   * Invalidate all links for a file
   */
  invalidateFile(path: string): void {
    this.delete(`back:${path}`);
    this.delete(`fwd:${path}`);
    
    // Also invalidate any files that might link to this one
    for (const key of this.keys()) {
      if (key.startsWith('fwd:')) {
        const links = this.get(key);
        if (links && links.includes(path)) {
          this.delete(key);
        }
      }
    }
  }
}

// Cache manager to coordinate all caches
export class CacheManager {
  private fileCache: FileContentCache;
  private metadataCache: MetadataCache;
  private linkCache: LinkCache;
  private enabled: boolean;

  constructor(config: {
    enabled: boolean;
    maxFileSize: number;
    maxFileItems: number;
    maxMetadataItems: number;
    maxLinkItems: number;
  }) {
    this.enabled = config.enabled;
    this.fileCache = new FileContentCache(config.maxFileSize, config.maxFileItems);
    this.metadataCache = new MetadataCache(config.maxMetadataItems);
    this.linkCache = new LinkCache(config.maxLinkItems);
  }

  /**
   * Get all cache statistics
   */
  getStats() {
    return {
      enabled: this.enabled,
      fileCache: this.fileCache.getStats(),
      metadataCache: this.metadataCache.getStats(),
      linkCache: this.linkCache.getStats()
    };
  }

  /**
   * Clear all caches
   */
  clearAll(): void {
    this.fileCache.clear();
    this.metadataCache.clear();
    this.linkCache.clear();
  }

  /**
   * Invalidate cache for a specific file
   */
  invalidateFile(path: string): void {
    this.fileCache.delete(path);
    this.metadataCache.delete(`fm:${path}`);
    this.metadataCache.delete(`tags:${path}`);
    this.linkCache.invalidateFile(path);
  }

  // Expose individual caches
  get files() { return this.enabled ? this.fileCache : null; }
  get metadata() { return this.enabled ? this.metadataCache : null; }
  get links() { return this.enabled ? this.linkCache : null; }
}
