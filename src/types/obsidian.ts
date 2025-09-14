// Type definitions for Obsidian MCP server

export interface ObsidianNote {
  path: string;
  content: string;
  frontmatter: Frontmatter;
  links: NoteLink[];
  tags: string[];
  created: Date;
  modified: Date;
}

export interface Frontmatter {
  [key: string]: any;
  title?: string;
  tags?: string | string[];
  aliases?: string | string[];
  created?: string;
  modified?: string;
}

export interface NoteLink {
  type: 'wiki' | 'markdown' | 'external';
  target: string;
  displayText?: string;
  position: {
    start: number;
    end: number;
  };
}

export interface Tag {
  name: string;
  count: number;
  notes: string[];
}

export interface GraphNode {
  id: string;
  path: string;
  title: string;
  links: number;
  backlinks: number;
  tags: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  type: 'wiki' | 'markdown';
}

export interface GraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
  orphaned: string[];
  hubs: string[]; // Most connected notes
}

export interface SearchResult {
  path: string;
  title: string;
  score: number;
  matches: SearchMatch[];
  context: string;
}

export interface SearchMatch {
  key: string;
  value: string;
  indices: Array<[number, number]>;
}

export interface VaultStats {
  totalNotes: number;
  totalTags: number;
  totalLinks: number;
  orphanedNotes: number;
  recentNotes: string[];
  largestNotes: Array<{ path: string; size: number }>;
  mostLinked: Array<{ path: string; count: number }>;
}

export interface Template {
  name: string;
  path: string;
  description?: string;
  frontmatter?: Frontmatter;
}

export interface DailyNoteConfig {
  folder?: string;
  format?: string;
  template?: string;
}

export interface ObsidianConfig {
  vaultPath: string;
  dailyNotes?: DailyNoteConfig;
  templatesFolder?: string;
  attachmentsFolder?: string;
}
