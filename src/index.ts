import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as path from 'path';
// Removed unused imports - z and fileURLToPath
import { ObsidianConfig } from "./types/obsidian.js";
import { FileUtils } from "./utils/file-utils.js";
import { ObsidianParser } from "./utils/obsidian-parser.js";
import { LinkParser } from "./utils/link-parser.js";
import { SearchUtils } from "./utils/search-utils.js";
import { MetadataUtils } from "./utils/metadata-utils.js";
import { GraphUtils } from "./utils/graph-utils.js";
import { VaultUtils } from "./utils/vault-utils.js";
import { registerFileTools } from "./tools/file-tools.js";
import { registerSearchTools } from "./tools/search-tools.js";
import { registerMetadataTools } from "./tools/metadata-tools.js";
import { registerGraphTools } from "./tools/graph-tools.js";
import { registerVaultTools } from "./tools/vault-tools.js";
import { LRUCache } from "./lru-cache.js";

// Get vault path from command line arguments
const vaultPath = process.argv[2];

if (!vaultPath) {
  console.error("Error: Vault path is required");
  console.error("Usage: node server.js /path/to/obsidian/vault");
  process.exit(1);
}

// Resolve vault path to absolute
const absoluteVaultPath = path.isAbsolute(vaultPath) 
  ? vaultPath 
  : path.resolve(process.cwd(), vaultPath);

console.error(`Initializing Obsidian MCP server for vault: ${absoluteVaultPath}`);

// Initialize configuration
const config: ObsidianConfig = {
  vaultPath: absoluteVaultPath,
  dailyNotes: {
    folder: "Daily Notes",
    format: "YYYY-MM-DD",
    template: "Templates/Daily Note"
  },
  templatesFolder: "Templates",
  attachmentsFolder: "Attachments"
};

// Initialize cache instances for conversation-aware caching
const fileCache = new LRUCache<string>({
  maxSize: 50 * 1024 * 1024, // 50MB for file content
  maxItems: 100, // Max 100 files in cache
  ttl: 3600000 // 1 hour
});

const searchCache = new LRUCache<any>({
  maxSize: 10 * 1024 * 1024, // 10MB for search results
  maxItems: 50, // Max 50 search results in cache
  ttl: 1800000 // 30 minutes
});

// Initialize utilities
const fileUtils = new FileUtils(absoluteVaultPath, fileCache);
const parser = new ObsidianParser();
const linkParser = new LinkParser(fileUtils, parser);
const searchUtils = new SearchUtils(fileUtils, parser, linkParser, searchCache);
const metadataUtils = new MetadataUtils(fileUtils, parser);
const graphUtils = new GraphUtils(fileUtils, linkParser);
const vaultUtils = new VaultUtils(fileUtils, parser, linkParser, config);

// Create MCP server
const server = new McpServer({
  name: "obsidian-mcp",
  version: "1.0.0",
  description: "Powerful MCP server for comprehensive Obsidian vault management"
});

// Register all tool modules
registerFileTools(server, fileUtils, parser);
registerSearchTools(server, searchUtils);
registerMetadataTools(server, metadataUtils);
registerGraphTools(server, graphUtils);
registerVaultTools(server, vaultUtils);

// Add a simple test tool
server.tool(
  "obsidian_test",
  "Test if the Obsidian MCP server is running",
  async () => {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            message: "Obsidian MCP server is running!",
            vaultPath: absoluteVaultPath,
            version: "1.0.0"
          }, null, 2)
        }
      ]
    };
  }
);

// Connect to transport
const transport = new StdioServerTransport();

server.connect(transport).then(() => {
  console.error("Obsidian MCP server started successfully");
}).catch(error => {
  console.error("Error starting server:", error);
  process.exit(1);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});
