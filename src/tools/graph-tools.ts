import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GraphUtils } from "../utils/graph-utils.js";

export function registerGraphTools(server: McpServer, graphUtils: GraphUtils) {
  // Get backlinks for a file
  server.tool(
    "obsidian_get_backlinks",
    "Get all notes that link to a specific note",
    {
      path: z.string().describe("Path to the note")
    },
    async ({ path }) => {
      try {
        const response = await graphUtils.getBacklinks(path);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path,
                  backlinks: response.data
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
                error: `Failed to get backlinks: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get forward links from a file
  server.tool(
    "obsidian_get_forward_links",
    "Get all notes that this note links to",
    {
      path: z.string().describe("Path to the note")
    },
    async ({ path }) => {
      try {
        const response = await graphUtils.getForwardLinks(path);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path,
                  forwardLinks: response.data
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
                error: `Failed to get forward links: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Find orphaned notes
  server.tool(
    "obsidian_find_orphaned_notes",
    "Find all notes that have no incoming or outgoing links",
    async () => {
      try {
        const response = await graphUtils.findOrphanedNotes();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  orphanedNotes: response.data,
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
                error: `Failed to find orphaned notes: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get note connections (both directions)
  server.tool(
    "obsidian_get_note_connections",
    "Get all connections (backlinks and forward links) for a note",
    {
      path: z.string().describe("Path to the note"),
      depth: z.number().optional().default(1).describe("Depth of connections to retrieve")
    },
    async ({ path, depth }) => {
      try {
        const response = await graphUtils.getNoteConnections(path, depth);
        
        // Convert Map to array for JSON serialization
        const connectionsArray = Array.from(response.data.entries()).map(([key, value]) => ({
          ...value,
          path: key
        }));
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  path,
                  depth,
                  connections: connectionsArray
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
                error: `Failed to get note connections: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Find most connected notes
  server.tool(
    "obsidian_find_most_connected_notes",
    "Find the most connected notes in the vault",
    {
      limit: z.number().optional().default(10).describe("Number of notes to return")
    },
    async ({ limit }) => {
      try {
        const response = await graphUtils.findMostConnectedNotes(limit);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  mostConnected: response.data,
                  limit
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
                error: `Failed to find most connected notes: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Find shortest path between notes
  server.tool(
    "obsidian_find_path_between_notes",
    "Find the shortest path of links between two notes",
    {
      sourcePath: z.string().describe("Path to the source note"),
      targetPath: z.string().describe("Path to the target note")
    },
    async ({ sourcePath, targetPath }) => {
      try {
        const response = await graphUtils.findShortestPath(sourcePath, targetPath);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  sourcePath,
                  targetPath,
                  path: response.data,
                  found: response.data.length > 0,
                  distance: response.data.length > 0 ? response.data.length - 1 : -1
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
                error: `Failed to find path between notes: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Get graph statistics
  server.tool(
    "obsidian_get_graph_stats",
    "Get statistics about the vault's link graph",
    async () => {
      try {
        const response = await graphUtils.getGraphStatistics();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: response.data,
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
                error: `Failed to get graph statistics: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );
}
