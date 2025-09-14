# Architecture Documentation

## System Overview

The Obsidian MCP Server is a TypeScript-based Model Context Protocol implementation that provides programmatic access to Obsidian vaults. It follows a layered architecture with clear separation of concerns and modular design.

## Architecture Layers

### 1. Protocol Layer

**Location:** `src/index.ts`

The entry point initializes the MCP server and manages the protocol lifecycle:

- Accepts vault path as command-line argument
- Initializes MCP server with transport
- Registers all tool modules
- Handles graceful shutdown signals

### 2. Tool Layer

**Location:** `src/tools/`

Each tool module encapsulates related operations:

#### File Tools (`file-tools.ts`)
- 14 operations for file management
- CRUD operations on markdown files
- Folder management utilities
- Batch operations support

#### Search Tools (`search-tools.ts`)
- 6 search operations
- Full-text search with Fuse.js
- Tag and metadata searching
- Advanced multi-criteria search

#### Metadata Tools (`metadata-tools.ts`)
- 6 metadata operations
- Frontmatter management
- Tag extraction and modification
- Metadata-based queries

#### Graph Tools (`graph-tools.ts`)
- 7 graph operations
- Link graph traversal
- Path finding algorithms
- Connection analysis

#### Vault Tools (`vault-tools.ts`)
- 6 utility operations
- Statistics generation
- Template application
- Maintenance operations

### 3. Utility Layer

**Location:** `src/utils/`

Core business logic and shared functionality:

#### FileUtils (`file-utils.ts`)
- File system operations
- Path resolution
- Cache integration
- Error handling

#### ObsidianParser (`obsidian-parser.ts`)
- Markdown parsing
- Frontmatter extraction
- Wiki-link syntax parsing
- Content processing

#### LinkParser (`link-parser.ts`)
- Link extraction
- Link resolution
- Reference tracking
- Graph building

#### SearchUtils (`search-utils.ts`)
- Search algorithms
- Index management
- Result ranking
- Cache optimization

#### MetadataUtils (`metadata-utils.ts`)
- YAML processing
- Tag management
- Frontmatter merging
- Metadata validation

#### GraphUtils (`graph-utils.ts`)
- Graph construction
- Path finding (BFS/DFS)
- Connection analysis
- Orphan detection

#### VaultUtils (`vault-utils.ts`)
- High-level operations
- Template processing
- Daily note creation
- Cleanup operations

#### PerformanceHelpers (`performance-helpers.ts`)
- Memory management
- Stream processing
- Batch operations
- Performance monitoring

### 4. Cache Layer

**Location:** `src/lru-cache.ts`

LRU cache implementation with TTL support:

- Size-based eviction
- Time-based expiration
- Access counting
- Memory tracking

## Data Flow

```
User Request
    ↓
MCP Protocol Layer
    ↓
Tool Layer (validates parameters)
    ↓
Utility Layer (business logic)
    ↓
Cache Layer (check/store)
    ↓
File System
    ↓
Response Formation
    ↓
User Response
```

## Key Design Decisions

### 1. Modular Tool Architecture

Each tool category is self-contained:
- Independent registration
- Shared utilities
- Consistent error handling

### 2. Conversation-Aware Caching

Two-tier cache system:
- File cache: 50MB, 1-hour TTL
- Search cache: 10MB, 30-minute TTL

### 3. Streaming for Large Files

Files over 5MB use streaming:
- Reduces memory footprint
- Maintains responsiveness
- Prevents OOM errors

### 4. Structured Error Handling

All operations return consistent structure:
- Success boolean
- Data payload
- Error array
- Metadata object

### 5. Type Safety

Full TypeScript with runtime validation:
- Zod schemas for parameters
- Type definitions for all interfaces
- Strict null checks

## Performance Optimizations

### Memory Management

1. **String Comparison Limits**
   - 50KB threshold for direct comparison
   - Hash comparison for larger files
   - Chunked processing for huge files

2. **Levenshtein Limits**
   - 1KB maximum string length
   - Fallback to simpler algorithms
   - Cached similarity scores

3. **Batch Processing**
   - 20 concurrent operations maximum
   - Queue management for large batches
   - Progress reporting

### Cache Strategy

1. **Hit Rate Optimization**
   - Frequently accessed files cached longer
   - Search results cached with query hash
   - Invalidation on file modification

2. **Memory Bounds**
   - Total cache size limited
   - Individual entry size limits
   - Automatic eviction

## Security Considerations

### Input Validation

- All paths sanitized
- Prevent directory traversal
- Validate file extensions
- Check file permissions

### Error Information

- No sensitive paths in errors
- Sanitized error messages
- No system information leakage

## Extension Points

### Adding New Tools

1. Create tool function in appropriate module
2. Define Zod schema for parameters
3. Register with server instance
4. Update documentation

### Adding New Utilities

1. Create utility class
2. Define clear interfaces
3. Integrate with existing utilities
4. Add caching if appropriate

### Custom Caching

1. Extend LRUCache class
2. Implement custom eviction
3. Add specialized indexes
4. Monitor performance

## Dependencies

### Core Dependencies

- `@modelcontextprotocol/sdk`: Protocol implementation
- `zod`: Runtime validation
- `glob`: File pattern matching

### Parsing Dependencies

- `gray-matter`: Frontmatter parsing
- `js-yaml`: YAML processing

### Search Dependencies

- `fuse.js`: Fuzzy search engine

## Configuration

### Default Settings

```typescript
{
  vaultPath: process.argv[2],
  dailyNotes: {
    folder: "Daily Notes",
    format: "YYYY-MM-DD",
    template: "Templates/Daily Note"
  },
  templatesFolder: "Templates",
  attachmentsFolder: "Attachments"
}
```

### Cache Configuration

```typescript
{
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
}
```

## Monitoring

### Performance Metrics

Available in response metadata:
- Cache hit rate
- Processing time
- Memory usage
- Error rate

### Health Checks

- Test tool for connectivity
- Vault statistics for health
- Cache statistics for performance

## Future Considerations

### Potential Enhancements

1. Plugin system for custom tools
2. Webhook support for real-time updates
3. Multi-vault support
4. Advanced caching strategies
5. Performance profiling tools

### Scalability

1. Distributed caching
2. Worker pool for heavy operations
3. Incremental indexing
4. Lazy loading strategies