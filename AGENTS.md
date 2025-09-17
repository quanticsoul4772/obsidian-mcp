# AGENTS.md - Repository Analysis

## Repository Overview

### Project Description
This project is an **Obsidian MCP Server** - a Model Context Protocol (MCP) implementation that provides AI assistants with comprehensive programmatic access to Obsidian vaults. It enables AI to read, write, search, analyze, and manage Obsidian markdown notes with sophisticated error handling, memory optimization, and performance caching.

**Main Purpose & Goals:**
- Bridge AI assistants with Obsidian knowledge bases
- Provide 42 specialized tools for vault operations
- Enable efficient large-scale vault processing with memory optimization
- Support complex graph operations and semantic search

**Key Technologies Used:**
- **Runtime:** Node.js 18+ with ES modules
- **Language:** TypeScript 5.4 with strict typing
- **Protocol:** Model Context Protocol (MCP) via `@modelcontextprotocol/sdk`
- **Search:** Fuse.js for fuzzy/semantic search
- **Parsing:** gray-matter for frontmatter, js-yaml for YAML processing
- **File Operations:** Node.js fs with glob pattern matching
- **Validation:** Zod schemas for runtime parameter validation
- **Performance:** Custom LRU cache with TTL, streaming for large files

## Architecture Overview

### High-Level Architecture
The system follows a **4-layer modular architecture**:

```
┌─────────────────────────────────────────────────┐
│                Protocol Layer                   │
│           (MCP Server + Transport)              │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│                 Tool Layer                      │
│   42 tools across 5 modules (File, Search,     │
│   Metadata, Graph, Vault operations)           │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│                Utility Layer                    │
│  Core business logic: FileUtils, ObsidianParser,│
│  LinkParser, SearchUtils, MetadataUtils, etc.   │
└─────────────────────────────────────────────────┘
                        │
┌─────────────────────────────────────────────────┐
│               Cache + Storage                   │
│    LRU Cache (50MB files, 10MB search) +       │
│           File System Operations               │
└─────────────────────────────────────────────────┘
```

### Main Components & Relationships
1. **Entry Point** (`index.ts`): Server initialization, tool registration, cache setup
2. **Tool Modules** (`src/tools/`): 5 specialized modules providing 42 tools
3. **Utility Classes** (`src/utils/`): 11 utility classes handling core operations
4. **Type System** (`src/types/`): TypeScript definitions and Zod schemas
5. **Cache Layer** (`lru-cache.ts`): Custom LRU implementation with TTL and memory limits

### Data Flow
```
User Request → MCP Protocol → Tool Validation → Utility Logic → Cache Check → File System → Response Formation
```

## Directory Structure

### Important Directories
```
src/
├── index.ts                    # Server entry point and initialization
├── lru-cache.ts               # Custom LRU cache implementation
├── tools/                     # MCP tool definitions (42 tools)
│   ├── file-tools.ts          # 14 file operations
│   ├── search-tools.ts        # 6 search operations  
│   ├── metadata-tools.ts      # 6 metadata operations
│   ├── graph-tools.ts         # 7 graph operations
│   └── vault-tools.ts         # 6 utility operations
├── utils/                     # Core business logic utilities
│   ├── file-utils.ts          # File system operations with caching
│   ├── obsidian-parser.ts     # Markdown and frontmatter parsing
│   ├── link-parser.ts         # Wiki-link syntax and resolution
│   ├── search-utils.ts        # Search algorithms and indexing
│   ├── metadata-utils.ts      # YAML and tag management
│   ├── graph-utils.ts         # Link graph analysis
│   ├── vault-utils.ts         # High-level vault operations
│   └── performance-*.ts       # Memory optimization utilities
└── types/                     # TypeScript definitions and schemas
    ├── obsidian.ts           # Obsidian-specific types
    ├── errors.ts             # Error handling types
    └── index.ts              # Re-exports
```

### Key Configuration Files
- **package.json**: Dependencies, scripts, Node 18+ requirement
- **tsconfig.json**: Strict TypeScript config with ES2022 target
- **eslintrc.json**: Comprehensive linting rules for code quality
- **ARCHITECTURE.md**: Detailed system architecture documentation
- **README.md**: Complete user guide with 42 tool examples

### Entry Points
- **Main:** `build/index.js` (compiled from `src/index.ts`)
- **Development:** `src/index.ts` with TypeScript compilation
- **Command:** Requires vault path as CLI argument

## Development Workflow

### Build & Run Process
```bash
# Install dependencies
npm install

# Build TypeScript → JavaScript
npm run build

# Start server (requires vault path)
npm start /path/to/obsidian/vault
# OR directly:
node build/index.js /path/to/obsidian/vault

# Development mode (watch compilation)
npm run dev
```

### Testing Approach
- **Manual Testing**: Run server with test vault
- **Tool Testing**: Use `obsidian_test` tool for connectivity
- **Integration**: Test with Claude Desktop MCP configuration
- **Performance**: Monitor cache hit rates and processing times in tool responses

### Development Environment Setup
1. **Prerequisites**: Node.js 18+, npm/yarn, Obsidian vault
2. **Clone & Install**: Standard npm workflow
3. **TypeScript**: Strict typing with ES2022 modules
4. **IDE Setup**: ESLint integration recommended

### Lint & Format Commands
```bash
# Run ESLint checks
npm run lint

# Auto-fix ESLint issues  
npm run lint:fix

# Type checking only (no compilation)
npm run typecheck

# Clean build directory
npm run clean
```

### Code Quality Standards
- **TypeScript**: Strict mode, explicit return types, no `any`
- **ESLint Rules**: Comprehensive ruleset including imports, async/await, unused vars
- **Module System**: ES modules with consistent import ordering
- **Error Handling**: Structured responses with success/error patterns

### Performance Considerations for Agents
- **Memory Limits**: 50KB threshold for string operations, streaming for 5MB+ files
- **Caching**: Conversation-aware with 1hr file cache, 30min search cache
- **Batch Operations**: 20 concurrent file limit for memory efficiency
- **Large Vaults**: Use filtering and pagination for operations on large vaults

### Claude Desktop Configuration Example
```json
{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/absolute/path/to/obsidian-mcp/build/index.js", "/absolute/path/to/obsidian/vault"]
    }
  }
}
```

This repository provides a robust, production-ready MCP server optimized for AI-driven knowledge management workflows with Obsidian vaults.