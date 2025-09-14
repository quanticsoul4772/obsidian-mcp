# Obsidian MCP Server (Claude AI Only)

A Model Context Protocol (MCP) server that provides Claude AI with direct access to Obsidian vaults.

## Overview

This server enables Claude to read, write, search, and analyze Obsidian markdown notes with error handling and memory optimization.

## Key Features

- **42 tools** for vault operations
- **Memory-optimized** for large vaults (50KB+ files)
- **Structured error reporting** - no silent failures
- **Performance helpers** for streaming large files
- **Conversation-aware cache** - 50MB file cache, 10MB search cache

## Available Tools (42)

### File Operations (14)
- `obsidian_create_file` - Create new notes with content and frontmatter
- `obsidian_read_file` - Read note content (cached for performance)
- `obsidian_update_file` - Update existing notes preserving frontmatter
- `obsidian_delete_file` - Delete notes with confirmation
- `obsidian_rename_file` - Rename/move notes with link updates
- `obsidian_list_files` - List markdown notes with filtering and sorting
- `obsidian_read_multiple_files` - Read multiple notes in one operation
- `obsidian_delete_folder` - Delete folders with safety checks:
  - Requires explicit confirmation
  - Empty folder check (unless forced)
  - Returns success/failure status
- `obsidian_list_folders` - List all vault folders:
  - Regex pattern filtering
  - Option to exclude empty folders
  - Sorted alphabetically
- `obsidian_check_folder_empty` - Verify if a folder contains files
- `obsidian_get_file_size` - Get file sizes:
  - Raw bytes or human-readable format (KB, MB, GB)
- `obsidian_list_all_files` - List all files types (not just .md):
  - Glob pattern support
  - Optional size information
  - Configurable result limit
- `obsidian_ensure_folder` - Create folders idempotently:
  - Creates parent directories if needed
  - Reports if folder was created or existed
- `obsidian_edit_file` - Edit files by replacing specific text sections:
  - Supports multiple edits in one operation
  - Preview mode (dryRun) to see changes before applying
  - Shows diff of changes made
  - Only writes to disk if changes occur
  - Efficient for small edits in large files

### Search Operations (6)
- `obsidian_search_text` - Full-text search across vault
- `obsidian_search_by_tags` - Find notes by tags
- `obsidian_search_by_links` - Find notes by link relationships
- `obsidian_search_by_date` - Find notes by creation/modification date
- `obsidian_search_advanced` - Multi-criteria search
- `obsidian_find_similar_notes` - Find content-similar notes

### Metadata Operations (6)
- `obsidian_get_frontmatter` - Read note frontmatter
- `obsidian_update_frontmatter` - Update frontmatter
- `obsidian_get_tags` - Get tags from a note
- `obsidian_add_tags` - Add tags to notes
- `obsidian_remove_tags` - Remove tags from notes
- `obsidian_find_by_frontmatter` - Search by frontmatter fields

### Graph Operations (7)
- `obsidian_get_backlinks` - Find notes linking to a note
- `obsidian_get_forward_links` - Find notes linked from a note
- `obsidian_find_orphaned_notes` - Find unlinked notes
- `obsidian_get_note_connections` - Get all connections for a note
- `obsidian_find_most_connected_notes` - Find hub notes
- `obsidian_find_path_between_notes` - Find link paths between notes
- `obsidian_get_graph_stats` - Get vault graph statistics

### Utility Operations (6)
- `obsidian_get_vault_stats` - Vault statistics
- `obsidian_create_daily_note` - Create daily notes with templates
- `obsidian_apply_template` - Apply templates to new notes
- `obsidian_find_broken_links` - Find broken internal links
- `obsidian_find_duplicate_notes` - Find similar/duplicate content
- `obsidian_cleanup_vault` - Vault maintenance operations

### Other (3)
- `obsidian_get_all_tags` - Get all unique tags in vault
- `obsidian_export_vault_structure` - Export vault structure
- `obsidian_test` - Test server connectivity

## Usage Examples

### Efficient File Editing
The `obsidian_edit_file` tool is perfect for making small changes to large files:

```javascript
// Preview changes first
obsidian-mcp:obsidian_edit_file({
  path: "my-note",
  dryRun: true,
  edits: [
    { oldText: "TODO", newText: "DONE" },
    { oldText: "draft", newText: "final", replaceAll: true }
  ]
})

// Apply the changes
obsidian-mcp:obsidian_edit_file({
  path: "my-note",
  edits: [
    { oldText: "TODO", newText: "DONE" }
  ]
})
```

### Reading and Writing Files
```javascript
// Read a file
obsidian-mcp:obsidian_read_file({ path: "daily/2024-01-13" })

// Create a new file with frontmatter
obsidian-mcp:obsidian_create_file({
  path: "projects/new-idea",
  content: "# New Project\n\nDescription here...",
  frontmatter: {
    tags: ["project", "active"],
    created: "2024-01-13"
  }
})
```

### Searching Your Vault
```javascript
// Search for text
obsidian-mcp:obsidian_search_text({
  query: "machine learning",
  caseSensitive: false,
  limit: 10
})

// Find notes by tags
obsidian-mcp:obsidian_search_by_tags({
  tags: ["important", "todo"],
  matchAll: true
})
```

## Technical Details

### Memory Optimizations
- **String comparison limit**: 50KB (larger files use hash comparison)
- **Levenshtein algorithm limit**: 1KB strings maximum
- **Large file handling**: Streaming for files >5MB
- **Batch processing**: 20 files concurrent max
- **Conversation cache**: 50MB for files, 10MB for searches (1hr/30min TTL)

### Error Handling
All operations return structured responses:
```json
{
  "success": true,
  "data": { /* results */ },
  "errors": [ /* any errors */ ],
  "metadata": {
    "totalProcessed": 100,
    "successCount": 98,
    "errorCount": 2
  }
}
```

### Important Limits
- Max Levenshtein string length: 1,000 characters
- Max content comparison size: 50KB
- Large file threshold: 5MB (uses streaming)
- Batch processing size: 20 files

## Installation

### Prerequisites
- Node.js 18.0.0 or higher
- npm or yarn
- An Obsidian vault

### Setup
1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/obsidian-mcp.git
   cd obsidian-mcp
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Configure Claude Desktop (see Configuration section)

## Configuration

The server requires the vault path as a command line argument:

### Claude Desktop Configuration
Add to your Claude Desktop MCP settings:
```json
{
  "obsidian": {
    "command": "node",
    "args": ["/path/to/obsidian-mcp/build/index.js", "/path/to/your/obsidian/vault"]
  }
}
```

### Manual Testing
```bash
node build/index.js /path/to/your/obsidian/vault
```

## Implementation Notes

- No authentication needed (Claude-only access)
- Conversation-aware caching for repeated operations
- No complex logging (can't persist between chats)
- Partial results on errors (operations continue)
- Hash comparison for duplicate detection on large files
- Cache automatically invalidates on file modifications

## Troubleshooting

### Common Issues

1. **"Vault path is required" error**
   - Ensure vault path is provided as second argument in Claude Desktop config
   - Path must be absolute, not relative

2. **"Tool not found" errors**
   - All tools require the `obsidian-mcp:` prefix
   - Example: `obsidian-mcp:obsidian_read_file`

3. **Permission errors**
   - Ensure the vault directory is readable/writable
   - Check file permissions on your operating system

4. **Large vault performance**
   - Use filtering options to limit results
   - Cache warming may take a moment on first operations
   - Consider using `limit` parameter on list operations

### Development

- Run TypeScript compiler in watch mode: `tsc --watch`
- Test specific tools: `node build/index.js /path/to/test/vault`
- Check cache statistics in responses for performance tuning

## Contributing

Contributions are welcome! Please:
1. Follow the existing code patterns
2. Add tests for new functionality
3. Update documentation
4. Ensure TypeScript compilation succeeds