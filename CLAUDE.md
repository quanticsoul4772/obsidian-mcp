# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
# Build the TypeScript code
npm run build

# Start the compiled server (requires vault path argument)
npm start /path/to/obsidian/vault

# Run TypeScript compiler directly
npx tsc

# Install dependencies
npm install
```

## Architecture Overview

This is an MCP (Model Context Protocol) server for Obsidian that provides 42 tools for vault operations. The architecture follows a modular design with clear separation of concerns:

### Core Components

**Entry Point (`src/index.ts`)**
- Initializes the MCP server with vault path from command line argument
- Sets up two LRU caches: 50MB file cache and 10MB search cache for performance
- Instantiates utility classes and registers all tool modules
- Handles graceful shutdown on SIGTERM/SIGINT

**Utility Layer (`src/utils/`)**
- `FileUtils`: Core file operations with caching support
- `ObsidianParser`: Parses markdown, frontmatter (YAML), and Obsidian-specific syntax
- `LinkParser`: Handles Obsidian's wiki-link syntax and link resolution
- `SearchUtils`: Full-text and structured search with Fuse.js integration
- `MetadataUtils`: Frontmatter and tag management
- `GraphUtils`: Link graph analysis and traversal
- `VaultUtils`: High-level vault operations (templates, daily notes, cleanup)
- `performance-helpers`: Streaming utilities for large file handling

**Tool Layer (`src/tools/`)**
- `file-tools`: 14 file operations (create, read, update, delete, rename, etc.)
- `search-tools`: 6 search operations (text, tags, links, dates, advanced)
- `metadata-tools`: 6 metadata operations (frontmatter, tags management)
- `graph-tools`: 7 graph operations (backlinks, connections, orphans, paths)
- `vault-tools`: 6 utility operations (stats, templates, maintenance)

### Key Design Patterns

1. **Caching Strategy**: Conversation-aware LRU caches with TTL for frequently accessed files and search results
2. **Error Handling**: Structured error reporting throughout, no silent failures
3. **Memory Optimization**: Special handling for large files (50KB+) with streaming support
4. **Modular Tools**: Each tool category is self-contained and registered independently
5. **Type Safety**: Full TypeScript with Zod schemas for runtime validation

### Dependencies

- `@modelcontextprotocol/sdk`: MCP protocol implementation
- `fuse.js`: Fuzzy search for similarity matching
- `glob`: File pattern matching
- `gray-matter`: Frontmatter parsing
- `js-yaml`: YAML processing for frontmatter
- `zod`: Runtime type validation

## Important Implementation Details

1. **Vault Path**: Must be provided as command-line argument when starting the server
2. **File Operations**: All paths are resolved relative to the vault root
3. **Link Handling**: Supports Obsidian's wiki-link syntax `[[note]]` with automatic resolution
4. **Cache Invalidation**: File cache entries expire after 1 hour, search cache after 30 minutes
5. **Large File Support**: Files over 50KB are handled with special streaming techniques
6. **Frontmatter Preservation**: Update operations preserve existing frontmatter by default

## Testing Strategy

Run tests for specific functionality:

```bash
# Test file operations
node build/index.js /path/to/test/vault

# Verify TypeScript compilation
npx tsc --noEmit

# Check for type errors
npx tsc --listFiles
```

## Common Development Tasks

### Adding New Tools

1. Create tool function in appropriate `src/tools/*.ts` file
2. Define Zod schema for parameter validation
3. Register tool in the module's export function
4. Update tool count in README.md and TOOLS_REFERENCE.md

### Modifying Utilities

1. Update utility class in `src/utils/*.ts`
2. Ensure backward compatibility
3. Update dependent tools if interface changes
4. Test with large vault for performance impact

### Performance Monitoring

Check cache statistics in tool responses:
- `cacheHit`: Whether result was served from cache
- `cacheSize`: Current cache memory usage
- `processingTime`: Operation duration

## Error Handling Patterns

The codebase follows structured error handling:

```typescript
try {
  // Operation logic
  return { success: true, data: result };
} catch (error) {
  return {
    success: false,
    errors: [error.message],
    metadata: { partial: partialResults }
  };
}
```

## Debug Information

Enable verbose logging by checking:
- Tool response metadata
- Cache hit/miss statistics
- Processing time metrics
- Error arrays in responses