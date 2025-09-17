import { LinkParser } from '../../../src/utils/link-parser';
import { FileUtils } from '../../../src/utils/file-utils';
import { ObsidianParser } from '../../../src/utils/obsidian-parser';

jest.mock('../../../src/utils/file-utils');
jest.mock('../../../src/utils/obsidian-parser');

describe('LinkParser', () => {
  let linkParser: LinkParser;
  let mockFileUtils: jest.Mocked<FileUtils>;
  let mockParser: jest.Mocked<ObsidianParser>;

  beforeEach(() => {
    mockFileUtils = {
      listMarkdownFiles: jest.fn(),
      readFile: jest.fn(),
      exists: jest.fn(),
      toRelativePath: jest.fn(),
      ensureMarkdownExtension: jest.fn(),
    } as any;

    mockParser = {
      parseFrontmatter: jest.fn(),
      extractAllLinks: jest.fn(),
      extractTags: jest.fn(),
      getNoteTitle: jest.fn(),
    } as any;

    linkParser = new LinkParser(mockFileUtils, mockParser);
  });

  describe('buildLinkGraph', () => {
    it('should build a complete link graph', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md', 'note3.md']);

      mockFileUtils.readFile.mockImplementation(async (file) => {
        if (file === 'note1.md') return 'Content with [[note2]] link';
        if (file === 'note2.md') return 'Content with [[note3]] and [[note1]]';
        return 'No links';
      });

      mockParser.parseFrontmatter.mockReturnValue({ data: {}, content: '' });
      mockParser.extractTags.mockReturnValue([]);
      mockParser.getNoteTitle.mockImplementation((_, file) => file.replace('.md', ''));

      mockParser.extractAllLinks.mockImplementation((content) => {
        if (content.includes('[[note2]]')) {
          return [{ type: 'wiki', target: 'note2', displayText: undefined, position: { start: 0, end: 10 } }];
        }
        if (content.includes('[[note3]]') && content.includes('[[note1]]')) {
          return [
            { type: 'wiki', target: 'note3', displayText: undefined, position: { start: 0, end: 10 } },
            { type: 'wiki', target: 'note1', displayText: undefined, position: { start: 11, end: 21 } }
          ];
        }
        return [];
      });

      // Mock resolveLink to return proper paths
      jest.spyOn(linkParser as any, 'resolveLink').mockImplementation((target) => {
        return `${target}.md`;
      });

      const graph = await linkParser.buildLinkGraph();

      expect(graph.nodes).toHaveLength(3);
      expect(graph.edges).toHaveLength(3);

      const note1 = graph.nodes.find(n => n.id === 'note1.md');
      expect(note1?.links).toBe(1);
      expect(note1?.backlinks).toBe(1);
    });

    it('should handle notes with tags', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note.md']);
      mockFileUtils.readFile.mockResolvedValue('Content');
      mockParser.parseFrontmatter.mockReturnValue({ data: { tags: ['tag1'] }, content: '' });
      mockParser.extractTags.mockReturnValue(['tag1', 'tag2']);
      mockParser.extractAllLinks.mockReturnValue([]);
      mockParser.getNoteTitle.mockReturnValue('Note');

      const graph = await linkParser.buildLinkGraph();

      expect(graph.nodes[0].tags).toEqual(['tag1', 'tag2']);
    });
  });

  describe('getBacklinks', () => {
    it('should return backlinks for a note', async () => {
      // Setup cache
      await setupLinkCache();

      const backlinks = await linkParser.getBacklinks('note2.md');
      expect(backlinks).toContain('note1.md');
    });

    it('should return empty array for note with no backlinks', async () => {
      await setupLinkCache();

      const backlinks = await linkParser.getBacklinks('orphan.md');
      expect(backlinks).toEqual([]);
    });
  });

  describe('getForwardLinks', () => {
    it('should return forward links for a note', async () => {
      await setupLinkCache();

      const links = await linkParser.getForwardLinks('note1.md');
      expect(links).toContain('note2.md');
    });

    it('should return empty array for note with no forward links', async () => {
      await setupLinkCache();

      const links = await linkParser.getForwardLinks('orphan.md');
      expect(links).toEqual([]);
    });
  });

  describe('findOrphanedNotes', () => {
    it('should identify orphaned notes', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md', 'orphan.md']);

      mockFileUtils.readFile.mockImplementation(async (file) => {
        if (file === 'note1.md') return 'Links to [[note2]]';
        if (file === 'note2.md') return 'Links to [[note1]]';
        return 'No links';
      });

      mockParser.parseFrontmatter.mockReturnValue({ data: {}, content: '' });
      mockParser.extractTags.mockReturnValue([]);
      mockParser.getNoteTitle.mockImplementation((_, file) => file);

      mockParser.extractAllLinks.mockImplementation((content) => {
        if (content.includes('[[note2]]')) {
          return [{ type: 'wiki', target: 'note2', displayText: undefined, position: { start: 0, end: 10 } }];
        }
        if (content.includes('[[note1]]')) {
          return [{ type: 'wiki', target: 'note1', displayText: undefined, position: { start: 0, end: 10 } }];
        }
        return [];
      });

      jest.spyOn(linkParser as any, 'resolveLink').mockImplementation((target) => {
        return `${target}.md`;
      });

      const orphans = await (linkParser as any).findOrphanedNotes();
      expect(orphans).toEqual(['orphan.md']);
    });
  });

  describe('resolveLink', () => {
    it('should resolve wiki link to markdown file', () => {
      mockFileUtils.ensureMarkdownExtension.mockReturnValue('target.md');
      mockFileUtils.exists.mockResolvedValue(true);

      const resolved = linkParser['resolveLink']('target', 'source.md');
      expect(resolved).toBe('target.md');
    });

    it('should resolve relative path', () => {
      mockFileUtils.ensureMarkdownExtension.mockReturnValue('../folder/target.md');
      mockFileUtils.exists.mockResolvedValue(true);

      const resolved = linkParser['resolveLink']('../folder/target', 'notes/source.md');
      expect(resolved).toBe('../folder/target.md');
    });

    it('should return null for external URLs', () => {
      const resolved = linkParser['resolveLink']('https://example.com', 'source.md');
      expect(resolved).toBeNull();
    });

    it('should handle paths with fragments', () => {
      mockFileUtils.ensureMarkdownExtension.mockReturnValue('target.md');
      mockFileUtils.exists.mockResolvedValue(true);

      const resolved = linkParser['resolveLink']('target#section', 'source.md');
      expect(resolved).toBe('target.md');
    });
  });

  describe('getMostConnectedNotes', () => {
    it('should return notes sorted by total connections', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['hub.md', 'spoke1.md', 'spoke2.md']);

      mockFileUtils.readFile.mockImplementation(async (file) => {
        if (file === 'hub.md') return 'Links [[spoke1]] [[spoke2]]';
        if (file === 'spoke1.md') return 'Links [[hub]]';
        if (file === 'spoke2.md') return 'Links [[hub]]';
        return '';
      });

      mockParser.parseFrontmatter.mockReturnValue({ data: {}, content: '' });
      mockParser.extractTags.mockReturnValue([]);
      mockParser.getNoteTitle.mockImplementation((_, file) => file);

      mockParser.extractAllLinks.mockImplementation((content) => {
        const links = [];
        if (content.includes('[[spoke1]]')) {
          links.push({ type: 'wiki', target: 'spoke1', displayText: undefined, position: { start: 0, end: 10 } });
        }
        if (content.includes('[[spoke2]]')) {
          links.push({ type: 'wiki', target: 'spoke2', displayText: undefined, position: { start: 0, end: 10 } });
        }
        if (content.includes('[[hub]]')) {
          links.push({ type: 'wiki', target: 'hub', displayText: undefined, position: { start: 0, end: 10 } });
        }
        return links;
      });

      jest.spyOn(linkParser as any, 'resolveLink').mockImplementation((target) => {
        return `${target}.md`;
      });

      await linkParser.buildLinkGraph();
      const connected = (linkParser as any).getMostConnectedNotes(2);

      expect(connected[0].path).toBe('hub.md');
      expect(connected[0].totalConnections).toBe(4); // 2 outgoing + 2 incoming
    });
  });

  // Helper function to setup link cache for testing
  async function setupLinkCache() {
    mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);

    mockFileUtils.readFile.mockImplementation(async (file) => {
      if (file === 'note1.md') return 'Links to [[note2]]';
      return 'No links';
    });

    mockParser.parseFrontmatter.mockReturnValue({ data: {}, content: '' });
    mockParser.extractTags.mockReturnValue([]);
    mockParser.getNoteTitle.mockReturnValue('Title');

    mockParser.extractAllLinks.mockImplementation((content) => {
      if (content.includes('[[note2]]')) {
        return [{ type: 'wiki', target: 'note2', displayText: undefined, position: { start: 0, end: 10 } }];
      }
      return [];
    });

    jest.spyOn(linkParser as any, 'resolveLink').mockImplementation((target) => {
      return `${target}.md`;
    });

    await linkParser.buildLinkGraph();
  }
});