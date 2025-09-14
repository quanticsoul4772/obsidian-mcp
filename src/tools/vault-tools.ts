import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { VaultUtils } from "../utils/vault-utils.js";

export function registerVaultTools(server: McpServer, vaultUtils: VaultUtils) {
  // Get vault statistics
  server.tool(
    "obsidian_get_vault_stats",
    "Get comprehensive statistics about the Obsidian vault",
    async () => {
      try {
        const response = await vaultUtils.getVaultStatistics();
        
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
                error: `Failed to get vault statistics: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Create daily note
  server.tool(
    "obsidian_create_daily_note",
    "Create a daily note with optional template",
    {
      date: z.string().optional().describe("Date for the daily note (ISO format, defaults to today)"),
      template: z.string().optional().describe("Template content to use"),
      folder: z.string().optional().default("Daily Notes").describe("Folder for daily notes")
    },
    async ({ date, template, folder }) => {
      try {
        const noteDate = date ? new Date(date) : new Date();
        const result = await vaultUtils.createDailyNote(noteDate, template, folder);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: result
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
                error: `Failed to create daily note: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Apply template
  server.tool(
    "obsidian_apply_template",
    "Apply a template to create a new note",
    {
      templatePath: z.string().describe("Path to the template note"),
      targetPath: z.string().describe("Path for the new note"),
      variables: z.record(z.string()).optional().describe("Variables to replace in template")
    },
    async ({ templatePath, targetPath, variables }) => {
      try {
        const result = await vaultUtils.applyTemplate(templatePath, targetPath, variables);
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: result
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
                error: `Failed to apply template: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Find broken links
  server.tool(
    "obsidian_find_broken_links",
    "Find all broken links in the vault",
    async () => {
      try {
        const response = await vaultUtils.findBrokenLinks();
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  brokenLinks: response.data,
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
                error: `Failed to find broken links: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Find duplicate notes
  server.tool(
    "obsidian_find_duplicate_notes",
    "Find potential duplicate notes based on content similarity",
    {
      threshold: z.number().optional().default(0.8).describe("Similarity threshold (0-1)"),
      checkContent: z.boolean().optional().default(true),
      checkTitles: z.boolean().optional().default(true)
    },
    async ({ threshold, checkContent, checkTitles }) => {
      try {
        const response = await vaultUtils.findDuplicateNotes({
          threshold,
          checkContent,
          checkTitles
        });
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  duplicates: response.data,
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
                error: `Failed to find duplicate notes: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Clean up vault
  server.tool(
    "obsidian_cleanup_vault",
    "Perform various cleanup operations on the vault",
    {
      removeOrphans: z.boolean().optional().default(false),
      fixBrokenLinks: z.boolean().optional().default(false),
      removeEmptyFolders: z.boolean().optional().default(false),
      normalizeFilenames: z.boolean().optional().default(false),
      dryRun: z.boolean().optional().default(true).describe("Preview changes without applying")
    },
    async ({ removeOrphans, fixBrokenLinks, removeEmptyFolders, normalizeFilenames, dryRun }) => {
      try {
        const response = await vaultUtils.cleanupVault({
          removeOrphans,
          fixBrokenLinks,
          removeEmptyFolders,
          normalizeFilenames,
          dryRun
        });
        
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                data: {
                  ...response.data,
                  dryRun
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
                error: `Failed to cleanup vault: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );

  // Export vault structure
  server.tool(
    "obsidian_export_vault_structure",
    "Export the vault's folder and file structure",
    {
      includeContent: z.boolean().optional().default(false),
      includeMetadata: z.boolean().optional().default(true),
      format: z.enum(["json", "tree", "flat"]).optional().default("json")
    },
    async ({ includeContent, includeMetadata, format }) => {
      try {
        const response = await vaultUtils.exportVaultStructure({
          includeContent,
          includeMetadata,
          format
        });
        
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
                error: `Failed to export vault structure: ${error}`
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    }
  );
}
