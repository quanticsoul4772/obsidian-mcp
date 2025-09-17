import { ObsidianParser } from '../../../src/utils/obsidian-parser';
import { Frontmatter } from '../../../src/types/obsidian';

describe('ObsidianParser', () => {
  let parser: ObsidianParser;

  beforeEach(() => {
    parser = new ObsidianParser();
  });

  describe('parseFrontmatter', () => {
    it('should parse YAML frontmatter', () => {
      const content = `---
title: Test Note
tags: [tag1, tag2]
date: 2024-01-01
---

# Content here`;

      const result = parser.parseFrontmatter(content);
      expect(result.data.title).toBe('Test Note');
      expect(result.data.tags).toEqual(['tag1', 'tag2']);
      expect(result.data.date).toBeTruthy();
      expect(result.content).toBe('\n# Content here');
    });

    it('should handle content without frontmatter', () => {
      const content = '# Just content';
      const result = parser.parseFrontmatter(content);
      expect(result.data).toEqual({});
      expect(result.content).toBe('# Just content');
    });

    it('should handle empty frontmatter', () => {
      const content = `---
---

# Content`;
      const result = parser.parseFrontmatter(content);
      expect(result.data).toEqual({});
      expect(result.content).toBe('\n# Content');
    });
  });

  describe('stringifyWithFrontmatter', () => {
    it('should stringify content with frontmatter', () => {
      const frontmatter = { title: 'Test', tags: ['tag1'] };
      const content = '# Content';

      const result = parser.stringifyWithFrontmatter(frontmatter, content);
      expect(result).toContain('---');
      expect(result).toContain('title: Test');
      expect(result).toContain('tags:');
      expect(result).toContain('  - tag1');
      expect(result).toContain('# Content');
    });

    it('should return content only if frontmatter is empty', () => {
      const frontmatter = {};
      const content = '# Content';

      const result = parser.stringifyWithFrontmatter(frontmatter, content);
      expect(result).toBe('# Content');
    });
  });

  describe('extractTags', () => {
    it('should extract tags from frontmatter array', () => {
      const frontmatter: Frontmatter = { tags: ['tag1', 'tag2'] };
      const content = 'Some content';

      const tags = parser.extractTags(content, frontmatter);
      expect(tags).toEqual(['tag1', 'tag2']);
    });

    it('should extract tags from frontmatter string', () => {
      const frontmatter: Frontmatter = { tags: 'single-tag' };
      const content = 'Some content';

      const tags = parser.extractTags(content, frontmatter);
      expect(tags).toEqual(['single-tag']);
    });

    it('should extract inline tags from content', () => {
      const frontmatter: Frontmatter = {};
      const content = 'Content with #tag1 and #tag2 inline';

      const tags = parser.extractTags(content, frontmatter);
      expect(tags).toEqual(['tag1', 'tag2']);
    });

    it('should handle tags with special characters', () => {
      const frontmatter: Frontmatter = {};
      const content = '#tag-with-dash #tag_with_underscore #nested/tag';

      const tags = parser.extractTags(content, frontmatter);
      expect(tags).toEqual(['nested/tag', 'tag-with-dash', 'tag_with_underscore']);
    });

    it('should combine and deduplicate tags from both sources', () => {
      const frontmatter: Frontmatter = { tags: ['tag1', 'tag2'] };
      const content = 'Content with #tag2 and #tag3';

      const tags = parser.extractTags(content, frontmatter);
      expect(tags).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should clean # prefix from frontmatter tags', () => {
      const frontmatter: Frontmatter = { tags: ['#tag1', 'tag2'] };
      const content = '';

      const tags = parser.extractTags(content, frontmatter);
      expect(tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('extractWikiLinks', () => {
    it('should extract simple wiki links', () => {
      const content = 'Link to [[Note Name]] here';
      const links = parser.extractWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({
        type: 'wiki',
        target: 'Note Name',
        displayText: undefined,
        position: { start: 8, end: 21 }
      });
    });

    it('should extract wiki links with display text', () => {
      const content = 'Link to [[target|display text]] here';
      const links = parser.extractWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0]).toMatchObject({
        type: 'wiki',
        target: 'target',
        displayText: 'display text',
        position: { start: 8, end: 31 }
      });
    });

    it('should extract multiple wiki links', () => {
      const content = '[[First]] and [[Second]] and [[Third|Custom]]';
      const links = parser.extractWikiLinks(content);

      expect(links).toHaveLength(3);
      expect(links[0].target).toBe('First');
      expect(links[1].target).toBe('Second');
      expect(links[2].target).toBe('Third');
      expect(links[2].displayText).toBe('Custom');
    });

    it('should handle nested paths in wiki links', () => {
      const content = '[[folder/subfolder/note]]';
      const links = parser.extractWikiLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].target).toBe('folder/subfolder/note');
    });
  });

  describe('extractMarkdownLinks', () => {
    it('should extract markdown links', () => {
      const content = 'Link to [display](target.md) here';
      const links = parser.extractMarkdownLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].type).toBe('markdown');
      expect(links[0].target).toBe('target.md');
      expect(links[0].displayText).toBe('display');
      expect(links[0].position.start).toBe(8);
    });

    it('should handle external URLs', () => {
      const content = '[External](https://example.com)';
      const links = parser.extractMarkdownLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].target).toBe('https://example.com');
    });

    it('should handle relative paths', () => {
      const content = '[Relative](../folder/note.md)';
      const links = parser.extractMarkdownLinks(content);

      expect(links).toHaveLength(1);
      expect(links[0].target).toBe('../folder/note.md');
    });

    it('should extract multiple markdown links', () => {
      const content = '[First](first.md) and [Second](second.md)';
      const links = parser.extractMarkdownLinks(content);

      expect(links).toHaveLength(2);
      expect(links[0].target).toBe('first.md');
      expect(links[1].target).toBe('second.md');
    });
  });

  describe('extractAllLinks', () => {
    it('should extract both wiki and markdown links', () => {
      const content = '[[Wiki Link]] and [Markdown](link.md)';
      const links = parser.extractAllLinks(content);

      expect(links).toHaveLength(2);
      expect(links[0].type).toBe('wiki');
      expect(links[1].type).toBe('markdown');
    });

    it('should preserve order of links', () => {
      const content = '[First](1.md) [[Second]] [Third](3.md) [[Fourth]]';
      const links = parser.extractAllLinks(content);

      expect(links).toHaveLength(4);
      expect(links[0].target).toBe('1.md');
      expect(links[1].target).toBe('Second');
      expect(links[2].target).toBe('3.md');
      expect(links[3].target).toBe('Fourth');
    });
  });

  describe('updateLinks', () => {
    it('should update wiki links', () => {
      const content = 'Link to [[old-note]] here';
      const result = parser.updateLinks(content, 'old-note', 'new-note');

      expect(result).toContain('[[new-note]]');
      expect(result).not.toContain('[[old-note]]');
    });

    it('should update markdown links', () => {
      const content = 'Link to [text](old-note.md) here';
      const result = parser.updateLinks(content, 'old-note.md', 'new-note.md');

      expect(result).toContain('[text](new-note.md)');
      expect(result).not.toContain('old-note.md');
    });

    it('should preserve display text in wiki links', () => {
      const content = '[[old-note|Custom Display]]';
      const result = parser.updateLinks(content, 'old-note', 'new-note');

      expect(result).toBe('[[new-note|Custom Display]]');
    });
  });

  describe('getNoteTitle', () => {
    it('should get title from frontmatter', () => {
      const frontmatter: Frontmatter = { title: 'My Title' };
      const result = parser.getNoteTitle(frontmatter, 'file.md');

      expect(result).toBe('My Title');
    });

    it('should use filename if no title in frontmatter', () => {
      const frontmatter: Frontmatter = {};
      const result = parser.getNoteTitle(frontmatter, 'my-note.md');

      expect(result).toBe('my-note');
    });
  });
});