# Changelog

All notable changes to the Obsidian MCP Server will be documented in this file.

## [1.1.1] - 2025-01-13

### Added
- `obsidian_edit_file` - Efficient partial file editing tool
  - Supports multiple text replacements in a single operation
  - Preview mode (dryRun) to see changes before applying
  - Shows diff of changes
  - Only writes to disk if changes are made
  - Much more efficient than update_file for small edits in large files

### Technical Details
- Uses line-based text replacement similar to filesystem:edit_file
- Includes escapeRegExp helper for safe string matching
- Generates simple line diffs for change visualization
- Total tools increased from 41 to 42

## [1.1.0] - 2025-01-13

### Added
- **6 New File Operation Tools** (bringing total from 35 to 41):
  - `obsidian_delete_folder` - Delete folders with safety checks (confirmation required, empty check)
  - `obsidian_list_folders` - List all folders with regex filtering and empty folder detection
  - `obsidian_check_folder_empty` - Check if a specific folder is empty
  - `obsidian_get_file_size` - Get file sizes in bytes or human-readable format
  - `obsidian_list_all_files` - List all file types (not just markdown) with glob patterns
  - `obsidian_ensure_folder` - Idempotently create folders with parent directory support

### Changed
- Updated README.md with correct configuration instructions (vault path as CLI argument)
- Updated documentation for all file operation tools with feature descriptions

### Fixed
- Fixed TypeScript compilation errors by adding missing `maxItems` parameter to LRUCache instances
- Corrected cache implementation to include size calculation for cache entries

### Technical Details
- All new tools follow existing error handling patterns
- Safety features implemented:
  - Confirmation requirements for destructive operations
  - Empty folder validation before deletion
  - Idempotent folder creation
  - Error messages for all failure cases

## [1.0.0] - 2025-01-01

### Initial Release
- 35 tools for Obsidian vault management
- Conversation-aware caching system (50MB file cache, 10MB search cache)
- Memory-optimized operations for large vaults
- Structured error reporting
- Support for:
  - File operations (CRUD)
  - Search operations (text, tags, links, dates)
  - Metadata management (frontmatter, tags)
  - Graph operations (backlinks, connections)
  - Vault utilities (templates, daily notes, maintenance)
