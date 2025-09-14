import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FileUtils } from "../utils/file-utils.js";
import { ObsidianParser } from "../utils/obsidian-parser.js";

// Helper function to escape special regex characters
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Helper function to generate a simple diff
function generateDiff(oldContent: string, newContent: string): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');
  const diff = [];
  let lineNum = 1;
  
  // Simple line-by-line diff
  const maxLines = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLines; i++) {
    if (i >= oldLines.length) {
      diff.push(`+${lineNum}: ${newLines[i]}`);
    } else if (i >= newLines.length) {
      diff.push(`-${lineNum}: ${oldLines[i]}`);
    } else if (oldLines[i] !== newLines[i]) {
      diff.push(`-${lineNum}: ${oldLines[i]}`);
      diff.push(`+${lineNum}: ${newLines[i]}`);
    }
    lineNum++;
  }
  
  return diff.length > 0 ? diff.join('\n') : 'No changes';
}

export function registerFileTools(server: McpServer, fileUtils: FileUtils, parser: ObsidianParser) {
  // Read a single file
  server.tool(
    "obsidian_read_file",
    "Read a single note from the Obsidian vault",
    {
      path: z.string().describe("Path to the note (with or without .md extension)")
    },
    async ({ path }) => {
      try {
        const content = await fileUtils.readFile(path);
        const { data: frontmatter, content: body } = parser.parseFrontmatter(content);
        const tags = parser.extractTags(content, frontmatter);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path: fileUtils.ensureMarkdownExtension(path),
                  content,
                  frontmatter,
                  body,
                  tags
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to read file: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Read multiple files
  server.tool(
    "obsidian_read_multiple_files",
    "Read multiple notes from the Obsidian vault",
    {
      paths: z.array(z.string()).describe("Array of paths to read")
    },
    async ({ paths }) => {
      const results = [];
      const errors = [];

      for (const path of paths) {
        try {
          const content = await fileUtils.readFile(path);
          const { data: frontmatter, content: body } = parser.parseFrontmatter(content);
          const tags = parser.extractTags(content, frontmatter);
          
          results.push({
            path: fileUtils.ensureMarkdownExtension(path),
            content,
            frontmatter,
            body,
            tags
          });
        } catch (error) {
          errors.push({ path, error: String(error) });
        }
      }

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              success: true,
              data: {
                files: results,
                errors: errors.length > 0 ? errors : undefined
              }
            }, null, 2)
          }
        ]
      };
    }
  );

  // Create a new file
  server.tool(
    "obsidian_create_file",
    "Create a new note in the Obsidian vault",
    {
      path: z.string().describe("Path for the new note"),
      content: z.string().describe("Content of the note"),
      frontmatter: z.record(z.any()).optional().describe("Frontmatter data"),
      overwrite: z.boolean().optional().default(false).describe("Overwrite if file exists")
    },
    async ({ path, content, frontmatter, overwrite }) => {
      try {
        const filePath = fileUtils.ensureMarkdownExtension(path);
        
        // Check if file exists
        if (!overwrite && await fileUtils.exists(filePath)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "File already exists. Set overwrite to true to replace it."
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        // Add frontmatter if provided
        let finalContent = content;
        if (frontmatter && Object.keys(frontmatter).length > 0) {
          finalContent = parser.stringifyWithFrontmatter(frontmatter, content);
        }

        await fileUtils.writeFile(filePath, finalContent);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path: filePath,
                  created: true
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to create file: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update an existing file
  server.tool(
    "obsidian_update_file",
    "Update an existing note in the Obsidian vault",
    {
      path: z.string().describe("Path to the note to update"),
      content: z.string().describe("New content for the note"),
      preserveFrontmatter: z.boolean().optional().default(false).describe("Keep existing frontmatter"),
      mergeFrontmatter: z.record(z.any()).optional().describe("Merge with existing frontmatter")
    },
    async ({ path, content, preserveFrontmatter, mergeFrontmatter }) => {
      try {
        const filePath = fileUtils.ensureMarkdownExtension(path);
        
        // Check if file exists
        if (!await fileUtils.exists(filePath)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "File does not exist"
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        let finalContent = content;

        // Handle frontmatter preservation/merging
        if (preserveFrontmatter || mergeFrontmatter) {
          const existingContent = await fileUtils.readFile(filePath);
          const { data: existingFrontmatter } = parser.parseFrontmatter(existingContent);
          
          let newFrontmatter = existingFrontmatter;
          if (mergeFrontmatter) {
            newFrontmatter = { ...existingFrontmatter, ...mergeFrontmatter };
          }
          
          finalContent = parser.stringifyWithFrontmatter(newFrontmatter, content);
        }

        await fileUtils.writeFile(filePath, finalContent);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path: filePath,
                  updated: true
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to update file: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete a file
  server.tool(
    "obsidian_delete_file",
    "Delete a note from the Obsidian vault",
    {
      path: z.string().describe("Path to the note to delete"),
      confirm: z.boolean().describe("Confirmation required to delete")
    },
    async ({ path, confirm }) => {
      try {
        if (!confirm) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Confirmation required. Set confirm to true to delete the file."
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        const filePath = fileUtils.ensureMarkdownExtension(path);
        
        if (!await fileUtils.exists(filePath)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "File does not exist"
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        await fileUtils.deleteFile(filePath);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path: filePath,
                  deleted: true
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to delete file: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Rename/move a file
  server.tool(
    "obsidian_rename_file",
    "Rename or move a note in the Obsidian vault",
    {
      oldPath: z.string().describe("Current path of the note"),
      newPath: z.string().describe("New path for the note"),
      updateLinks: z.boolean().optional().default(true).describe("Update links in other files")
    },
    async ({ oldPath, newPath, updateLinks }) => {
      try {
        const oldFilePath = fileUtils.ensureMarkdownExtension(oldPath);
        const newFilePath = fileUtils.ensureMarkdownExtension(newPath);
        
        if (!await fileUtils.exists(oldFilePath)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Source file does not exist"
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        if (await fileUtils.exists(newFilePath)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Target file already exists"
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        // Update links in other files if requested
        const updatedFiles = [];
        if (updateLinks) {
          const allFiles = await fileUtils.listMarkdownFiles();
          for (const file of allFiles) {
            if (file === oldFilePath) continue;
            
            const content = await fileUtils.readFile(file);
            const updatedContent = parser.updateLinks(content, oldPath, newPath);
            
            if (content !== updatedContent) {
              await fileUtils.writeFile(file, updatedContent);
              updatedFiles.push(file);
            }
          }
        }

        // Rename the file
        await fileUtils.renameFile(oldFilePath, newFilePath);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  oldPath: oldFilePath,
                  newPath: newFilePath,
                  moved: true,
                  updatedLinks: updatedFiles
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to rename file: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // List files
  server.tool(
    "obsidian_list_files",
    "List notes in the Obsidian vault with filtering and sorting options",
    {
      folder: z.string().optional().describe("Filter by folder path"),
      pattern: z.string().optional().describe("Filter by name pattern (regex)"),
      limit: z.number().optional().default(100).describe("Maximum number of files to return"),
      sortBy: z.enum(["name", "modified", "created", "size"]).optional().default("name"),
      sortOrder: z.enum(["asc", "desc"]).optional().default("asc")
    },
    async ({ folder, pattern, limit, sortBy, sortOrder }) => {
      try {
        let files = await fileUtils.listMarkdownFiles();
        
        // Filter by folder
        if (folder) {
          files = files.filter(file => file.startsWith(folder));
        }

        // Filter by pattern
        if (pattern) {
          const regex = new RegExp(pattern, 'i');
          files = files.filter(file => regex.test(file));
        }

        // Get file stats for sorting
        const filesWithStats = await Promise.all(
          files.map(async (file) => {
            try {
              const stats = await fileUtils.getStats(file);
              return {
                path: file,
                size: stats.size,
                created: stats.birthtime,
                modified: stats.mtime
              };
            } catch {
              return null;
            }
          })
        );

        // Filter out failed stats
        const validFiles = filesWithStats.filter(f => f !== null) as any[];

        // Sort files
        validFiles.sort((a, b) => {
          let comparison = 0;
          switch (sortBy) {
            case "name":
              comparison = a.path.localeCompare(b.path);
              break;
            case "size":
              comparison = a.size - b.size;
              break;
            case "created":
              comparison = a.created.getTime() - b.created.getTime();
              break;
            case "modified":
              comparison = a.modified.getTime() - b.modified.getTime();
              break;
          }
          return sortOrder === "asc" ? comparison : -comparison;
        });

        // Apply limit
        const limitedFiles = validFiles.slice(0, limit);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  files: limitedFiles,
                  total: validFiles.length,
                  limited: validFiles.length > limit
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to list files: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Delete a folder
  server.tool(
    "obsidian_delete_folder",
    "Delete an empty folder from the Obsidian vault",
    {
      path: z.string().describe("Path to the folder to delete"),
      confirm: z.boolean().describe("Confirmation required to delete"),
      force: z.boolean().optional().default(false).describe("Force delete even if not empty")
    },
    async ({ path, confirm, force }) => {
      try {
        if (!confirm) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Confirmation required. Set confirm to true to delete the folder."
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        // Check if folder exists
        if (!await fileUtils.isFolder(path)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Path is not a folder or does not exist"
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        // Check if folder is empty (unless force is true)
        if (!force && !await fileUtils.isFolderEmpty(path)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Folder is not empty. Set force to true to delete non-empty folders."
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        await fileUtils.deleteFolder(path);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path: path,
                  deleted: true
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to delete folder: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // List all folders
  server.tool(
    "obsidian_list_folders",
    "List all folders in the Obsidian vault",
    {
      pattern: z.string().optional().describe("Filter folders by pattern (regex)"),
      includeEmpty: z.boolean().optional().default(true).describe("Include empty folders")
    },
    async ({ pattern, includeEmpty }) => {
      try {
        let folders = await fileUtils.listFolders();
        
        // Apply pattern filter if provided
        if (pattern) {
          const regex = new RegExp(pattern, 'i');
          folders = folders.filter(folder => regex.test(folder));
        }
        
        // Filter out empty folders if requested
        if (!includeEmpty) {
          const nonEmptyFolders = [];
          for (const folder of folders) {
            if (!await fileUtils.isFolderEmpty(folder)) {
              nonEmptyFolders.push(folder);
            }
          }
          folders = nonEmptyFolders;
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  folders: folders.sort(),
                  total: folders.length
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to list folders: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Check if folder is empty
  server.tool(
    "obsidian_check_folder_empty",
    "Check if a folder is empty",
    {
      path: z.string().describe("Path to the folder to check")
    },
    async ({ path }) => {
      try {
        // Check if path exists and is a folder
        if (!await fileUtils.isFolder(path)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "Path is not a folder or does not exist"
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        const isEmpty = await fileUtils.isFolderEmpty(path);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path: path,
                  isEmpty: isEmpty
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to check folder: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get file size
  server.tool(
    "obsidian_get_file_size",
    "Get the size of a file in bytes",
    {
      path: z.string().describe("Path to the file"),
      format: z.enum(["bytes", "human"]).optional().default("human").describe("Output format")
    },
    async ({ path, format }) => {
      try {
        const size = await fileUtils.getFileSize(path);
        
        const formatBytes = (bytes: number): string => {
          if (bytes === 0) return '0 Bytes';
          const k = 1024;
          const sizes = ['Bytes', 'KB', 'MB', 'GB'];
          const i = Math.floor(Math.log(bytes) / Math.log(k));
          return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path: path,
                  size: size,
                  formatted: format === "human" ? formatBytes(size) : undefined
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to get file size: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // List all files (not just markdown)
  server.tool(
    "obsidian_list_all_files",
    "List all files in the vault (not just markdown)",
    {
      pattern: z.string().optional().describe("Filter by file pattern (glob)"),
      includeSize: z.boolean().optional().default(false).describe("Include file sizes"),
      limit: z.number().optional().default(1000).describe("Maximum files to return")
    },
    async ({ pattern, includeSize, limit }) => {
      try {
        let files = await fileUtils.listAllFiles();
        
        // Apply pattern filter if provided
        if (pattern) {
          const regex = new RegExp(pattern.replace(/\*/g, '.*'), 'i');
          files = files.filter(file => regex.test(file));
        }
        
        // Limit results
        const hasMore = files.length > limit;
        files = files.slice(0, limit);
        
        // Get file info if requested
        const fileInfo = [];
        for (const file of files) {
          const info: any = { path: file };
          if (includeSize) {
            try {
              info.size = await fileUtils.getFileSize(file);
            } catch (e) {
              info.size = null;
            }
          }
          fileInfo.push(info);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  files: includeSize ? fileInfo : files,
                  total: files.length,
                  hasMore: hasMore
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to list files: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Ensure folder exists
  server.tool(
    "obsidian_ensure_folder",
    "Ensure a folder exists (create if missing)",
    {
      path: z.string().describe("Path to the folder to ensure exists"),
      createParents: z.boolean().optional().default(true).describe("Create parent folders if needed")
    },
    async ({ path, createParents }) => {
      try {
        // Check if already exists
        const exists = await fileUtils.isFolder(path);
        
        if (createParents) {
          await fileUtils.ensureDir(path);
        } else {
          await fileUtils.ensureFolder(path);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path: path,
                  created: !exists,
                  existed: exists
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to ensure folder: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Edit file with partial text replacement
  server.tool(
    "obsidian_edit_file",
    "Edit a file by replacing specific text sections (supports single or multiple edits)",
    {
      path: z.string().describe("Path to the file to edit"),
      edits: z.array(z.object({
        oldText: z.string().describe("Text to search for - must match exactly"),
        newText: z.string().describe("Text to replace with"),
        replaceAll: z.boolean().optional().default(false).describe("Replace all occurrences (default: false)")
      })).describe("Array of edit operations to perform"),
      dryRun: z.boolean().optional().default(false).describe("Preview changes without applying them")
    },
    async ({ path, edits, dryRun }) => {
      try {
        const filePath = fileUtils.ensureMarkdownExtension(path);
        
        // Check if file exists
        if (!await fileUtils.exists(filePath)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: "File does not exist"
                }, null, 2)
              }
            ],
            isError: true
          };
        }

        // Read the current content
        let content = await fileUtils.readFile(filePath);
        const originalContent = content;
        const changes = [];
        let totalReplacements = 0;

        // Apply each edit
        for (const edit of edits) {
          const { oldText, newText, replaceAll = false } = edit;
          
          if (oldText === newText) {
            continue; // Skip no-op edits
          }

          let replacements = 0;
          if (replaceAll) {
            // Count occurrences first
            const matches = content.match(new RegExp(escapeRegExp(oldText), 'g'));
            replacements = matches ? matches.length : 0;
            
            if (replacements > 0) {
              content = content.split(oldText).join(newText);
              changes.push({
                type: 'replace_all',
                oldText,
                newText,
                count: replacements
              });
            }
          } else {
            // Replace first occurrence only
            const index = content.indexOf(oldText);
            if (index !== -1) {
              content = content.substring(0, index) + newText + content.substring(index + oldText.length);
              replacements = 1;
              changes.push({
                type: 'replace_first',
                oldText,
                newText,
                position: index
              });
            }
          }

          if (replacements === 0) {
            changes.push({
              type: 'not_found',
              oldText,
              newText
            });
          }
          
          totalReplacements += replacements;
        }

        // Generate diff
        const diff = generateDiff(originalContent, content);

        // If dry run, return the changes without writing
        if (dryRun) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: true,
                  data: {
                    path: filePath,
                    dryRun: true,
                    changes,
                    totalReplacements,
                    diff,
                    wouldModify: content !== originalContent
                  }
                }, null, 2)
              }
            ]
          };
        }

        // Only write if changes were made
        if (content !== originalContent) {
          await fileUtils.writeFile(filePath, content);
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path: filePath,
                  modified: content !== originalContent,
                  changes,
                  totalReplacements,
                  diff: content !== originalContent ? diff : null
                }
              }, null, 2)
            }
          ]
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: `Failed to edit file: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );
}
