# API Reference

## Overview

The Obsidian MCP Server provides 42 tools organized into 5 categories for comprehensive vault management. All tools follow a consistent pattern with structured responses and error handling.

## Response Format

All tools return responses in this structure:

```typescript
interface ToolResponse {
  success: boolean;
  data?: any;
  errors?: string[];
  metadata?: {
    totalProcessed?: number;
    successCount?: number;
    errorCount?: number;
    cacheHit?: boolean;
  };
}
```

## File Operations

### obsidian_read_file

Read content from a markdown file in the vault.

**Parameters:**
- `path` (string, required): Path to the file relative to vault root

**Returns:**
- `content`: File content including frontmatter
- `metadata`: File stats and cache information

**Example:**
```javascript
{
  path: "notes/example.md"
}
```

### obsidian_create_file

Create a new markdown file with optional frontmatter.

**Parameters:**
- `path` (string, required): Path for the new file
- `content` (string, required): File content
- `frontmatter` (object, optional): YAML frontmatter data
- `overwrite` (boolean, optional): Allow overwriting existing file

**Returns:**
- `success`: Creation status
- `path`: Created file path

### obsidian_update_file

Update an existing file preserving frontmatter by default.

**Parameters:**
- `path` (string, required): Path to file
- `content` (string, required): New content
- `preserveFrontmatter` (boolean, optional): Keep existing frontmatter
- `mergeFrontmatter` (object, optional): Merge with existing frontmatter

**Returns:**
- `success`: Update status
- `path`: Updated file path

### obsidian_delete_file

Delete a file with confirmation requirement.

**Parameters:**
- `path` (string, required): Path to file
- `confirm` (boolean, required): Explicit confirmation

**Returns:**
- `success`: Deletion status

### obsidian_rename_file

Rename or move a file with automatic link updates.

**Parameters:**
- `oldPath` (string, required): Current file path
- `newPath` (string, required): New file path
- `updateLinks` (boolean, optional): Update links in other files

**Returns:**
- `success`: Rename status
- `linksUpdated`: Number of links updated

### obsidian_edit_file

Edit files by replacing specific text sections.

**Parameters:**
- `path` (string, required): Path to file
- `edits` (array, required): Array of edit operations
  - `oldText` (string): Text to find
  - `newText` (string): Replacement text
  - `replaceAll` (boolean, optional): Replace all occurrences
- `dryRun` (boolean, optional): Preview changes without applying

**Returns:**
- `success`: Edit status
- `changes`: Applied changes with diff

## Search Operations

### obsidian_search_text

Full-text search across the vault.

**Parameters:**
- `query` (string, required): Search query
- `caseSensitive` (boolean, optional): Case-sensitive search
- `wholeWord` (boolean, optional): Match whole words only
- `regex` (boolean, optional): Use regex pattern
- `limit` (number, optional): Maximum results

**Returns:**
- `results`: Array of matching files with snippets
- `totalMatches`: Total number of matches

### obsidian_search_by_tags

Find notes containing specific tags.

**Parameters:**
- `tags` (string[], required): Tags to search for
- `matchAll` (boolean, optional): Require all tags

**Returns:**
- `results`: Array of files with matching tags

### obsidian_search_by_links

Find notes by link relationships.

**Parameters:**
- `paths` (string[], required): Paths to check links for
- `direction` (string, optional): "to", "from", or "both"
- `matchAll` (boolean, optional): Match all paths

**Returns:**
- `results`: Files with link relationships

### obsidian_search_advanced

Multi-criteria search combining multiple filters.

**Parameters:**
- `text` (string, optional): Text to search
- `tags` (string[], optional): Tags to match
- `folder` (string, optional): Folder to search in
- `frontmatter` (object, optional): Frontmatter fields to match
- `dateRange` (object, optional): Date range filter
- `limit` (number, optional): Maximum results

**Returns:**
- `results`: Filtered search results

## Metadata Operations

### obsidian_get_frontmatter

Extract frontmatter from a note.

**Parameters:**
- `path` (string, required): Path to file

**Returns:**
- `frontmatter`: Parsed YAML frontmatter object

### obsidian_update_frontmatter

Update frontmatter in a note.

**Parameters:**
- `path` (string, required): Path to file
- `frontmatter` (object, required): New frontmatter data
- `merge` (boolean, optional): Merge with existing

**Returns:**
- `success`: Update status
- `frontmatter`: Updated frontmatter

### obsidian_get_tags

Get all tags from a note.

**Parameters:**
- `path` (string, required): Path to file

**Returns:**
- `frontmatterTags`: Tags from frontmatter
- `inlineTags`: Tags from content
- `allTags`: Combined unique tags

### obsidian_add_tags

Add tags to a note.

**Parameters:**
- `path` (string, required): Path to file
- `tags` (string[], required): Tags to add
- `location` (string, optional): "frontmatter", "inline", or "both"

**Returns:**
- `success`: Addition status
- `tags`: Updated tag list

## Graph Operations

### obsidian_get_backlinks

Find all notes linking to a specific note.

**Parameters:**
- `path` (string, required): Path to target note

**Returns:**
- `backlinks`: Array of files linking to this note

### obsidian_get_forward_links

Find all notes linked from a specific note.

**Parameters:**
- `path` (string, required): Path to source note

**Returns:**
- `forwardLinks`: Array of files linked from this note

### obsidian_find_orphaned_notes

Find notes with no incoming or outgoing links.

**Parameters:** None

**Returns:**
- `orphans`: Array of unlinked files

### obsidian_get_note_connections

Get all connections for a note with depth traversal.

**Parameters:**
- `path` (string, required): Path to file
- `depth` (number, optional): Connection depth to traverse

**Returns:**
- `backlinks`: Incoming connections
- `forwardLinks`: Outgoing connections
- `connections`: All unique connections

### obsidian_find_path_between_notes

Find shortest link path between two notes.

**Parameters:**
- `sourcePath` (string, required): Starting note
- `targetPath` (string, required): Target note

**Returns:**
- `path`: Array of notes forming the path
- `distance`: Number of links in path

## Utility Operations

### obsidian_get_vault_stats

Get comprehensive vault statistics.

**Parameters:** None

**Returns:**
- `totalFiles`: Total markdown files
- `totalSize`: Total vault size
- `totalWords`: Approximate word count
- `totalTags`: Unique tags count
- `totalLinks`: Internal links count
- `avgFileSize`: Average file size
- `largestFiles`: Top 10 largest files

### obsidian_create_daily_note

Create a daily note with optional template.

**Parameters:**
- `date` (string, optional): ISO date string
- `folder` (string, optional): Daily notes folder
- `template` (string, optional): Template content

**Returns:**
- `success`: Creation status
- `path`: Created daily note path

### obsidian_find_broken_links

Find all broken internal links in the vault.

**Parameters:** None

**Returns:**
- `brokenLinks`: Array of broken link details

### obsidian_cleanup_vault

Perform vault maintenance operations.

**Parameters:**
- `removeOrphans` (boolean, optional): Remove orphaned files
- `fixBrokenLinks` (boolean, optional): Fix broken links
- `removeEmptyFolders` (boolean, optional): Remove empty folders
- `normalizeFilenames` (boolean, optional): Normalize file names
- `dryRun` (boolean, optional): Preview without changes

**Returns:**
- `actions`: List of performed/planned actions
- `summary`: Operation summary

## Error Handling

All tools implement consistent error handling:

1. **Validation Errors**: Invalid parameters return error message
2. **File Not Found**: Returns success:false with descriptive error
3. **Permission Errors**: Returns error with permission details
4. **Partial Failures**: Continue processing, return both results and errors

## Performance Considerations

### Caching

- File content cached for 1 hour (50MB cache)
- Search results cached for 30 minutes (10MB cache)
- Cache invalidated on file modifications

### Limits

- Maximum file size for direct comparison: 50KB
- Maximum Levenshtein distance calculation: 1KB strings
- Streaming threshold: 5MB files
- Batch processing limit: 20 concurrent operations

### Optimization Tips

1. Use `limit` parameters to restrict result sets
2. Leverage caching for repeated operations
3. Use `obsidian_read_multiple_files` for batch reads
4. Apply filters early to reduce processing

## Type Definitions

### ObsidianConfig

```typescript
interface ObsidianConfig {
  vaultPath: string;
  dailyNotes: {
    folder: string;
    format: string;
    template: string;
  };
  templatesFolder: string;
  attachmentsFolder: string;
}
```

### FileInfo

```typescript
interface FileInfo {
  path: string;
  name: string;
  size: number;
  created: Date;
  modified: Date;
  frontmatter?: object;
}
```

### SearchResult

```typescript
interface SearchResult {
  path: string;
  score: number;
  matches: Array<{
    line: number;
    content: string;
  }>;
}
```