import * as path from 'path';
import { FileUtils } from './file-utils.js';
import { ObsidianParser } from './obsidian-parser.js';
import { GraphNode, GraphEdge, GraphData } from '../types/obsidian.js';

export class LinkParser {
  private fileUtils: FileUtils;
  private parser: ObsidianParser;
  private linkCache: Map<string, Set<string>> = new Map();
  private backlinkCache: Map<string, Set<string>> = new Map();

  constructor(fileUtils: FileUtils, parser: ObsidianParser) {
    this.fileUtils = fileUtils;
    this.parser = parser;
  }

  // Build complete link graph
  async buildLinkGraph(): Promise<GraphData> {
    this.linkCache.clear();
    this.backlinkCache.clear();

    const files = await this.fileUtils.listMarkdownFiles();
    const nodes: Map<string, GraphNode> = new Map();
    const edges: GraphEdge[] = [];

    // First pass: collect all notes and their outgoing links
    for (const file of files) {
      const content = await this.fileUtils.readFile(file);
      const { data: frontmatter } = this.parser.parseFrontmatter(content);
      const links = this.parser.extractAllLinks(content);
      const tags = this.parser.extractTags(content, frontmatter);
      
      // Initialize node
      const node: GraphNode = {
        id: file,
        path: file,
        title: this.parser.getNoteTitle(frontmatter, file),
        links: 0,
        backlinks: 0,
        tags
      };
      nodes.set(file, node);

      // Process links
      const outgoingLinks = new Set<string>();
      for (const link of links) {
        if (link.type === 'wiki' || link.type === 'markdown') {
          const targetPath = this.resolveLink(link.target, file);
          if (targetPath && targetPath !== file) {
            outgoingLinks.add(targetPath);
            edges.push({
              source: file,
              target: targetPath,
              type: link.type
            });
          }
        }
      }
      
      this.linkCache.set(file, outgoingLinks);
      node.links = outgoingLinks.size;
    }

    // Second pass: calculate backlinks
    for (const [source, targets] of this.linkCache.entries()) {
      for (const target of targets) {
        if (!this.backlinkCache.has(target)) {
          this.backlinkCache.set(target, new Set());
        }
        this.backlinkCache.get(target)!.add(source);
      }
    }

    // Update backlink counts
    for (const [file, backlinks] of this.backlinkCache.entries()) {
      const node = nodes.get(file);
      if (node) {
        node.backlinks = backlinks.size;
      }
    }

    // Find orphaned notes (no incoming or outgoing links)
    const orphaned = Array.from(nodes.values())
      .filter(node => node.links === 0 && node.backlinks === 0)
      .map(node => node.path);

    // Find hubs (most connected notes)
    const hubs = Array.from(nodes.values())
      .sort((a, b) => (b.links + b.backlinks) - (a.links + a.backlinks))
      .slice(0, 10)
      .map(node => node.path);

    return {
      nodes: Array.from(nodes.values()),
      edges,
      orphaned,
      hubs
    };
  }

  // Resolve a link to its actual file path
  private resolveLink(link: string, fromFile: string): string | null {
    // Remove .md extension if present
    const linkWithoutExt = link.replace(/\.md$/, '');
    
    // Handle absolute vault paths
    if (linkWithoutExt.startsWith('/')) {
      return linkWithoutExt.substring(1) + '.md';
    }

    // Handle relative paths
    if (linkWithoutExt.includes('/')) {
      const fromDir = path.dirname(fromFile);
      const resolved = path.join(fromDir, linkWithoutExt);
      return path.normalize(resolved) + '.md';
    }

    // Simple filename - need to search for it
    // In a real implementation, we'd search the vault
    // For now, assume it's in the same directory
    const fromDir = path.dirname(fromFile);
    if (fromDir === '.') {
      return linkWithoutExt + '.md';
    }
    return path.join(fromDir, linkWithoutExt) + '.md';
  }

  // Get backlinks for a specific note
  async getBacklinks(notePath: string): Promise<string[]> {
    if (this.backlinkCache.size === 0) {
      await this.buildLinkGraph();
    }
    
    const backlinks = this.backlinkCache.get(notePath);
    return backlinks ? Array.from(backlinks) : [];
  }

  // Get forward links for a specific note
  async getForwardLinks(notePath: string): Promise<string[]> {
    if (this.linkCache.size === 0) {
      await this.buildLinkGraph();
    }
    
    const links = this.linkCache.get(notePath);
    return links ? Array.from(links) : [];
  }

  // Find shortest path between two notes
  async findShortestPath(from: string, to: string): Promise<string[] | null> {
    if (this.linkCache.size === 0) {
      await this.buildLinkGraph();
    }

    // BFS to find shortest path
    const queue: Array<{ node: string; path: string[] }> = [{ node: from, path: [from] }];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { node, path } = queue.shift()!;
      
      if (node === to) {
        return path;
      }

      if (visited.has(node)) {
        continue;
      }
      visited.add(node);

      const links = this.linkCache.get(node) || new Set();
      for (const link of links) {
        if (!visited.has(link)) {
          queue.push({ node: link, path: [...path, link] });
        }
      }
    }

    return null; // No path found
  }

  // Find all notes within N links of a given note
  async findNotesWithinDistance(notePath: string, maxDistance: number): Promise<Map<string, number>> {
    if (this.linkCache.size === 0) {
      await this.buildLinkGraph();
    }

    const distances = new Map<string, number>();
    const queue: Array<{ node: string; distance: number }> = [{ node: notePath, distance: 0 }];
    distances.set(notePath, 0);

    while (queue.length > 0) {
      const { node, distance } = queue.shift()!;
      
      if (distance >= maxDistance) {
        continue;
      }

      // Check both forward and back links
      const forwardLinks = this.linkCache.get(node) || new Set();
      const backLinks = this.backlinkCache.get(node) || new Set();
      const allLinks = new Set([...forwardLinks, ...backLinks]);

      for (const link of allLinks) {
        if (!distances.has(link) || distances.get(link)! > distance + 1) {
          distances.set(link, distance + 1);
          queue.push({ node: link, distance: distance + 1 });
        }
      }
    }

    return distances;
  }

  // Find link clusters (connected components)
  async findLinkClusters(): Promise<Array<Set<string>>> {
    if (this.linkCache.size === 0) {
      await this.buildLinkGraph();
    }

    const visited = new Set<string>();
    const clusters: Array<Set<string>> = [];

    for (const [node] of this.linkCache) {
      if (!visited.has(node)) {
        const cluster = new Set<string>();
        this.dfsCluster(node, visited, cluster);
        if (cluster.size > 1) {
          clusters.push(cluster);
        }
      }
    }

    return clusters.sort((a, b) => b.size - a.size);
  }

  private dfsCluster(node: string, visited: Set<string>, cluster: Set<string>): void {
    if (visited.has(node)) return;
    
    visited.add(node);
    cluster.add(node);

    const forwardLinks = this.linkCache.get(node) || new Set();
    const backLinks = this.backlinkCache.get(node) || new Set();
    
    for (const link of forwardLinks) {
      this.dfsCluster(link, visited, cluster);
    }
    
    for (const link of backLinks) {
      this.dfsCluster(link, visited, cluster);
    }
  }

  // Check for broken links
  async findBrokenLinks(): Promise<Array<{ source: string; target: string; type: string }>> {
    const brokenLinks: Array<{ source: string; target: string; type: string }> = [];
    const files = await this.fileUtils.listMarkdownFiles();

    for (const file of files) {
      const content = await this.fileUtils.readFile(file);
      const links = this.parser.extractAllLinks(content);

      for (const link of links) {
        if (link.type === 'wiki' || link.type === 'markdown') {
          const targetPath = this.resolveLink(link.target, file);
          if (targetPath && !(await this.fileUtils.exists(targetPath))) {
            brokenLinks.push({
              source: file,
              target: link.target,
              type: link.type
            });
          }
        }
      }
    }

    return brokenLinks;
  }
}
