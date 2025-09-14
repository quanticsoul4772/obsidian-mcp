import matter from 'gray-matter';
import { Frontmatter, NoteLink } from '../types/obsidian.js';

export class ObsidianParser {
  // Parse frontmatter from content
  parseFrontmatter(content: string): { data: Frontmatter; content: string } {
    const parsed = matter(content);
    return {
      data: parsed.data as Frontmatter,
      content: parsed.content
    };
  }

  // Stringify frontmatter and content back to markdown
  stringifyWithFrontmatter(frontmatter: Frontmatter, content: string): string {
    if (Object.keys(frontmatter).length === 0) {
      return content;
    }
    return matter.stringify(content, frontmatter);
  }

  // Extract all tags from content and frontmatter
  extractTags(content: string, frontmatter: Frontmatter): string[] {
    const tags = new Set<string>();

    // Tags from frontmatter
    if (frontmatter.tags) {
      const fmTags = Array.isArray(frontmatter.tags) 
        ? frontmatter.tags 
        : [frontmatter.tags];
      fmTags.forEach(tag => {
        const cleaned = tag.toString().replace(/^#/, '').trim();
        if (cleaned) tags.add(cleaned);
      });
    }

    // Tags from content (#tag format)
    const tagRegex = /#[a-zA-Z0-9_\-\/]+/g;
    const matches = content.match(tagRegex) || [];
    matches.forEach(tag => {
      const cleaned = tag.substring(1).trim();
      if (cleaned) tags.add(cleaned);
    });

    return Array.from(tags).sort();
  }

  // Extract wiki links [[target|display]]
  extractWikiLinks(content: string): NoteLink[] {
    const links: NoteLink[] = [];
    const wikiLinkRegex = /\[\[([^\]]+)\]\]/g;
    let match;

    while ((match = wikiLinkRegex.exec(content)) !== null) {
      const fullMatch = match[1];
      const [target, displayText] = fullMatch.split('|').map(s => s.trim());
      
      links.push({
        type: 'wiki',
        target: target,
        displayText: displayText,
        position: {
          start: match.index,
          end: match.index + match[0].length
        }
      });
    }

    return links;
  }

  // Extract markdown links [text](target)
  extractMarkdownLinks(content: string): NoteLink[] {
    const links: NoteLink[] = [];
    const mdLinkRegex = /\[([^\]]*)\]\(([^)]+)\)/g;
    let match;

    while ((match = mdLinkRegex.exec(content)) !== null) {
      const displayText = match[1];
      const target = match[2];
      
      // Skip external links
      if (target.startsWith('http://') || target.startsWith('https://')) {
        links.push({
          type: 'external',
          target: target,
          displayText: displayText,
          position: {
            start: match.index,
            end: match.index + match[0].length
          }
        });
      } else {
        links.push({
          type: 'markdown',
          target: target,
          displayText: displayText,
          position: {
            start: match.index,
            end: match.index + match[0].length
          }
        });
      }
    }

    return links;
  }

  // Extract all links from content
  extractAllLinks(content: string): NoteLink[] {
    const wikiLinks = this.extractWikiLinks(content);
    const markdownLinks = this.extractMarkdownLinks(content);
    return [...wikiLinks, ...markdownLinks].sort((a, b) => a.position.start - b.position.start);
  }

  // Update links in content
  updateLinks(content: string, oldPath: string, newPath: string): string {
    let updated = content;
    
    // Update wiki links
    updated = updated.replace(
      /\[\[([^\]]+)\]\]/g,
      (match, linkContent) => {
        const [target, display] = linkContent.split('|').map((s: string) => s.trim());
        if (target === oldPath || target === oldPath.replace('.md', '')) {
          const newTarget = newPath.replace('.md', '');
          return display ? `[[${newTarget}|${display}]]` : `[[${newTarget}]]`;
        }
        return match;
      }
    );

    // Update markdown links
    updated = updated.replace(
      /\[([^\]]*)\]\(([^)]+)\)/g,
      (match, text, target) => {
        if (target === oldPath || target === oldPath.replace('.md', '')) {
          return `[${text}](${newPath})`;
        }
        return match;
      }
    );

    return updated;
  }

  // Get note title from frontmatter or filename
  getNoteTitle(frontmatter: Frontmatter, filePath: string): string {
    if (frontmatter.title) {
      return frontmatter.title;
    }
    
    // Extract from filename
    const basename = filePath.split('/').pop() || filePath;
    return basename.replace('.md', '');
  }

  // Extract headings from content
  extractHeadings(content: string): Array<{ level: number; text: string; slug: string }> {
    const headings: Array<{ level: number; text: string; slug: string }> = [];
    const headingRegex = /^(#{1,6})\s+(.+)$/gm;
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length;
      const text = match[2].trim();
      const slug = text.toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-');
      
      headings.push({ level, text, slug });
    }

    return headings;
  }

  // Create a slug from text
  createSlug(text: string): string {
    return text.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  // Extract code blocks
  extractCodeBlocks(content: string): Array<{ language: string; code: string }> {
    const blocks: Array<{ language: string; code: string }> = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim()
      });
    }

    return blocks;
  }

  // Remove code blocks from content (useful for search)
  removeCodeBlocks(content: string): string {
    return content.replace(/```[\s\S]*?```/g, '');
  }

  // Extract first paragraph or sentence as preview
  extractPreview(content: string, maxLength: number = 200): string {
    // Remove frontmatter, code blocks, and headings
    let clean = content;
    clean = this.removeCodeBlocks(clean);
    clean = clean.replace(/^#{1,6}\s+.+$/gm, '');
    clean = clean.trim();

    // Get first paragraph
    const firstParagraph = clean.split('\n\n')[0] || '';
    
    if (firstParagraph.length <= maxLength) {
      return firstParagraph;
    }

    // Truncate at word boundary
    const truncated = firstParagraph.substring(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');
    return lastSpace > 0 ? truncated.substring(0, lastSpace) + '...' : truncated + '...';
  }

  // Extract links from content (for compatibility)
  extractLinks(content: string): NoteLink[] {
    return this.extractAllLinks(content);
  }

  // Remove a specific link from content
  removeLink(content: string, targetPath: string): string {
    let updated = content;
    
    // Remove wiki links
    updated = updated.replace(
      /\[\[([^\]]+)\]\]/g,
      (match, linkContent) => {
        const [target, display] = linkContent.split('|').map((s: string) => s.trim());
        if (target === targetPath || target === targetPath.replace('.md', '')) {
          return display || '';
        }
        return match;
      }
    );

    // Remove markdown links
    updated = updated.replace(
      /\[([^\]]*)\]\(([^)]+)\)/g,
      (match, text, target) => {
        if (target === targetPath || target === targetPath.replace('.md', '')) {
          return text;
        }
        return match;
      }
    );

    return updated;
  }
}
