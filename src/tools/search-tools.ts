import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { SearchUtils } from "../utils/search-utils.js";

export function registerSearchTools(server: McpServer, searchUtils: SearchUtils) {
  // Full-text search
  server.tool(
    "obsidian_search_text",
    "Search for text across all notes in the vault",
    {
      query: z.string().describe("Search query"),
      caseSensitive: z.boolean().optional().default(false),
      wholeWord: z.boolean().optional().default(false),
      regex: z.boolean().optional().default(false),
      limit: z.number().optional().default(50)
    },
    async ({ query, caseSensitive, wholeWord, regex, limit }) => {
      try {
        const response = await searchUtils.searchText(query, {
          caseSensitive,
          wholeWord,
          regex,
          limit
        });
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  query,
                  results: response.results,
                  count: response.results.length,
                  limited: response.results.length === limit
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
                error: `Failed to search text: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Search by tags
  server.tool(
    "obsidian_search_by_tags",
    "Find all notes with specific tags",
    {
      tags: z.array(z.string()).describe("Tags to search for"),
      matchAll: z.boolean().optional().default(false).describe("Require all tags to match")
    },
    async ({ tags, matchAll }) => {
      try {
        const response = await searchUtils.searchByTags(tags, matchAll);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  tags,
                  matchAll,
                  results: response.results,
                  count: response.results.length
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
                error: `Failed to search by tags: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Search by links
  server.tool(
    "obsidian_search_by_links",
    "Find all notes that link to or are linked from specific notes",
    {
      paths: z.array(z.string()).describe("Paths to search for links"),
      direction: z.enum(["to", "from", "both"]).optional().default("both"),
      matchAll: z.boolean().optional().default(false).describe("Require links to/from all paths")
    },
    async ({ paths, direction, matchAll }) => {
      try {
        const response = await searchUtils.searchByLinks(paths, direction, matchAll);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  paths,
                  direction,
                  matchAll,
                  results: response.results,
                  count: response.results.length
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
                error: `Failed to search by links: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Search by date
  server.tool(
    "obsidian_search_by_date",
    "Find notes created or modified within a date range",
    {
      startDate: z.string().optional().describe("Start date (ISO format)"),
      endDate: z.string().optional().describe("End date (ISO format)"),
      dateField: z.enum(["created", "modified", "both"]).optional().default("modified")
    },
    async ({ startDate, endDate, dateField }) => {
      try {
        const response = await searchUtils.searchByDate({
          startDate: startDate ? new Date(startDate) : undefined,
          endDate: endDate ? new Date(endDate) : undefined,
          dateField
        });
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  startDate,
                  endDate,
                  dateField,
                  results: response.results,
                  count: response.results.length
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
                error: `Failed to search by date: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Advanced search combining multiple criteria
  server.tool(
    "obsidian_search_advanced",
    "Advanced search with multiple criteria",
    {
      text: z.string().optional().describe("Text to search for"),
      tags: z.array(z.string()).optional().describe("Tags to match"),
      frontmatter: z.record(z.any()).optional().describe("Frontmatter fields to match"),
      folder: z.string().optional().describe("Folder to search in"),
      filePattern: z.string().optional().describe("File name pattern (regex)"),
      dateRange: z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        dateField: z.enum(["created", "modified"]).optional().default("modified")
      }).optional(),
      limit: z.number().optional().default(100)
    },
    async ({ text, tags, frontmatter, folder, filePattern, dateRange, limit }) => {
      try {
        const response = await searchUtils.advancedSearch({
          text,
          tags,
          frontmatter,
          folder,
          filePattern,
          dateRange: dateRange ? {
            startDate: dateRange.startDate ? new Date(dateRange.startDate) : undefined,
            endDate: dateRange.endDate ? new Date(dateRange.endDate) : undefined,
            dateField: dateRange.dateField
          } : undefined,
          limit
        });
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  criteria: { text, tags, frontmatter, folder, filePattern, dateRange },
                  results: response.results,
                  count: response.results.length,
                  limited: response.results.length === limit
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
                error: `Failed to perform advanced search: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Find similar notes
  server.tool(
    "obsidian_find_similar_notes",
    "Find notes similar to a given note based on content and metadata",
    {
      path: z.string().describe("Path to the reference note"),
      limit: z.number().optional().default(10),
      minSimilarity: z.number().optional().default(0.3).describe("Minimum similarity score (0-1)")
    },
    async ({ path, limit, minSimilarity }) => {
      try {
        const response = await searchUtils.findSimilarNotes(path, limit, minSimilarity);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  referencePath: path,
                  similarNotes: response.results,
                  count: response.results.length
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
                error: `Failed to find similar notes: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );
}
