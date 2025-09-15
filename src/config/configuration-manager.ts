/**
 * Configuration management with environment and file support
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ServerConfig {
  name?: string;
  version?: string;
  description?: string;
}

export interface CacheConfig {
  fileCache?: {
    maxSize: number;
    maxItems: number;
    ttl: number;
  };
  searchCache?: {
    maxSize: number;
    maxItems: number;
    ttl: number;
  };
}

export interface ObsidianConfigOptions {
  dailyNotes?: {
    folder: string;
    format: string;
    template: string;
  };
  templatesFolder?: string;
  attachmentsFolder?: string;
}

export interface ApplicationConfig {
  server: ServerConfig;
  cache: CacheConfig;
  obsidian: ObsidianConfigOptions;
  performance?: {
    monitoring?: boolean;
    maxConcurrentOperations?: number;
    streamThreshold?: number;
  };
}

/**
 * Manages application configuration from multiple sources
 */
export class ConfigurationManager {
  private config: ApplicationConfig;

  constructor() {
    this.config = this.getDefaultConfiguration();
  }

  /**
   * Load configuration from various sources
   */
  loadConfiguration(vaultPath: string): ApplicationConfig {
    // Start with defaults
    this.config = this.getDefaultConfiguration();

    // Load from environment variables
    this.loadFromEnvironment();

    // Load from config file if exists
    this.loadFromFile(vaultPath);

    // Validate configuration
    this.validateConfiguration();

    return this.config;
  }

  /**
   * Get default configuration
   */
  private getDefaultConfiguration(): ApplicationConfig {
    return {
      server: {
        name: "obsidian-mcp",
        version: "1.0.0",
        description: "Powerful MCP server for comprehensive Obsidian vault management"
      },
      cache: {
        fileCache: {
          maxSize: 50 * 1024 * 1024,
          maxItems: 100,
          ttl: 3600000
        },
        searchCache: {
          maxSize: 10 * 1024 * 1024,
          maxItems: 50,
          ttl: 1800000
        }
      },
      obsidian: {
        dailyNotes: {
          folder: "Daily Notes",
          format: "YYYY-MM-DD",
          template: "Templates/Daily Note"
        },
        templatesFolder: "Templates",
        attachmentsFolder: "Attachments"
      },
      performance: {
        monitoring: false,
        maxConcurrentOperations: 10,
        streamThreshold: 1024 * 1024
      }
    };
  }

  /**
   * Load configuration from environment variables
   */
  private loadFromEnvironment(): void {
    // Server configuration
    if (process.env.MCP_SERVER_NAME) {
      this.config.server.name = process.env.MCP_SERVER_NAME;
    }
    if (process.env.MCP_SERVER_VERSION) {
      this.config.server.version = process.env.MCP_SERVER_VERSION;
    }

    // Cache configuration
    if (process.env.MCP_FILE_CACHE_SIZE) {
      this.config.cache.fileCache!.maxSize = parseInt(process.env.MCP_FILE_CACHE_SIZE);
    }
    if (process.env.MCP_SEARCH_CACHE_SIZE) {
      this.config.cache.searchCache!.maxSize = parseInt(process.env.MCP_SEARCH_CACHE_SIZE);
    }

    // Performance configuration
    if (process.env.PERF_MONITORING === 'true') {
      this.config.performance!.monitoring = true;
    }
    if (process.env.MAX_CONCURRENT_OPS) {
      this.config.performance!.maxConcurrentOperations = parseInt(process.env.MAX_CONCURRENT_OPS);
    }
  }

  /**
   * Load configuration from file
   */
  private loadFromFile(vaultPath: string): void {
    const configPaths = [
      path.join(vaultPath, '.obsidian-mcp.json'),
      path.join(vaultPath, '.obsidian', 'mcp-config.json'),
      path.join(process.cwd(), 'obsidian-mcp.config.json')
    ];

    for (const configPath of configPaths) {
      if (fs.existsSync(configPath)) {
        try {
          const fileContent = fs.readFileSync(configPath, 'utf-8');
          const fileConfig = JSON.parse(fileContent);
          this.mergeConfiguration(fileConfig);
          console.error(`Loaded configuration from: ${configPath}`);
          break;
        } catch (error) {
          console.error(`Failed to load config from ${configPath}:`, error);
        }
      }
    }
  }

  /**
   * Merge configuration objects
   */
  private mergeConfiguration(source: Partial<ApplicationConfig>): void {
    this.config = this.deepMerge(this.config, source) as ApplicationConfig;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): any {
    const output = { ...target };

    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
          output[key] = this.deepMerge(target[key] || {}, source[key]);
        } else {
          output[key] = source[key];
        }
      }
    }

    return output;
  }

  /**
   * Validate configuration
   */
  private validateConfiguration(): void {
    // Validate cache sizes
    if (this.config.cache.fileCache!.maxSize <= 0) {
      throw new Error('File cache size must be positive');
    }
    if (this.config.cache.searchCache!.maxSize <= 0) {
      throw new Error('Search cache size must be positive');
    }

    // Validate concurrent operations
    if (this.config.performance!.maxConcurrentOperations! <= 0) {
      throw new Error('Max concurrent operations must be positive');
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): ApplicationConfig {
    return this.config;
  }

  /**
   * Update configuration at runtime
   */
  updateConfiguration(updates: Partial<ApplicationConfig>): void {
    this.mergeConfiguration(updates);
    this.validateConfiguration();
  }
}