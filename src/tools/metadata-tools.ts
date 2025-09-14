import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { MetadataUtils } from "../utils/metadata-utils.js";

export function registerMetadataTools(server: McpServer, metadataUtils: MetadataUtils) {
  // Get frontmatter from a file
  server.tool(
    "obsidian_get_frontmatter",
    "Get frontmatter metadata from a note",
    {
      path: z.string().describe("Path to the note")
    },
    async ({ path }) => {
      try {
        const frontmatter = await metadataUtils.getFrontmatter(path);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path,
                  frontmatter
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
                error: `Failed to get frontmatter: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Update frontmatter
  server.tool(
    "obsidian_update_frontmatter",
    "Update frontmatter metadata in a note",
    {
      path: z.string().describe("Path to the note"),
      frontmatter: z.record(z.any()).describe("Frontmatter data to set"),
      merge: z.boolean().optional().default(true).describe("Merge with existing frontmatter")
    },
    async ({ path, frontmatter, merge }) => {
      try {
        await metadataUtils.updateFrontmatter(path, frontmatter, merge);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path,
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
                error: `Failed to update frontmatter: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get tags from a file
  server.tool(
    "obsidian_get_tags",
    "Get all tags from a note (both frontmatter and inline)",
    {
      path: z.string().describe("Path to the note")
    },
    async ({ path }) => {
      try {
        const tags = await metadataUtils.getTags(path);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path,
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
                error: `Failed to get tags: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Add tags to a file
  server.tool(
    "obsidian_add_tags",
    "Add tags to a note",
    {
      path: z.string().describe("Path to the note"),
      tags: z.array(z.string()).describe("Tags to add"),
      location: z.enum(["frontmatter", "inline", "both"]).optional().default("frontmatter")
    },
    async ({ path, tags, location }) => {
      try {
        await metadataUtils.addTags(path, tags, location);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path,
                  tagsAdded: tags,
                  location
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
                error: `Failed to add tags: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Remove tags from a file
  server.tool(
    "obsidian_remove_tags",
    "Remove tags from a note",
    {
      path: z.string().describe("Path to the note"),
      tags: z.array(z.string()).describe("Tags to remove"),
      location: z.enum(["frontmatter", "inline", "both"]).optional().default("both")
    },
    async ({ path, tags, location }) => {
      try {
        await metadataUtils.removeTags(path, tags, location);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path,
                  tagsRemoved: tags,
                  location
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
                error: `Failed to remove tags: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get all tags in vault
  server.tool(
    "obsidian_get_all_tags",
    "Get all unique tags used across the entire vault",
    async () => {
      try {
        const response = await metadataUtils.getAllTags();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  tags: response.data,
                  count: response.data.length
                },
                errors: response.errors,
                metadata: response.metadata
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
                error: `Failed to get all tags: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Find files by frontmatter field
  server.tool(
    "obsidian_find_by_frontmatter",
    "Find all notes with specific frontmatter field/value",
    {
      field: z.string().describe("Frontmatter field name"),
      value: z.any().optional().describe("Value to match (if not provided, finds all with field)"),
      exactMatch: z.boolean().optional().default(true).describe("Require exact match")
    },
    async ({ field, value, exactMatch }) => {
      try {
        const response = await metadataUtils.findByFrontmatter(field, value, exactMatch);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  field,
                  value,
                  files: response.data,
                  count: response.data.length
                },
                errors: response.errors,
                metadata: response.metadata
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
                error: `Failed to find files by frontmatter: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );
}
