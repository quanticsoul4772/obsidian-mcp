import { SearchUtils } from '../../../src/utils/search-utils';
import { FileUtils } from '../../../src/utils/file-utils';
import { ObsidianParser } from '../../../src/utils/obsidian-parser';
import { LinkParser } from '../../../src/utils/link-parser';
import { LRUCache } from '../../../src/lru-cache';

jest.mock('../../../src/utils/file-utils');
jest.mock('../../../src/utils/obsidian-parser');
jest.mock('../../../src/utils/link-parser');

describe('SearchUtils', () => {
  let searchUtils: SearchUtils;
  let mockFileUtils: jest.Mocked<FileUtils>;
  let mockParser: jest.Mocked<ObsidianParser>;
  let mockLinkParser: jest.Mocked<LinkParser>;
  let mockCache: jest.Mocked<LRUCache<any>>;

  beforeEach(() => {
    mockFileUtils = {
      listMarkdownFiles: jest.fn(),
      readFile: jest.fn(),
      getStats: jest.fn(),
      toRelativePath: jest.fn(),
    } as any;

    mockParser = {
      parseFrontmatter: jest.fn(),
      extractTags: jest.fn(),
    } as any;

    mockLinkParser = {
      getBacklinks: jest.fn(),
      getForwardLinks: jest.fn(),
    } as any;

    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      getCurrentSize: jest.fn(),
      getStats: jest.fn(),
    } as any;

    searchUtils = new SearchUtils(mockFileUtils, mockParser, mockLinkParser, mockCache);
  });

  describe('searchText', () => {
    it('should return cached results if available', async () => {
      const cachedResults = {
        results: [{ path: 'note.md', matches: [] }],
        metadata: { totalProcessed: 1, successCount: 1, errorCount: 0 }
      };
      mockCache.get.mockReturnValue(cachedResults);

      const result = await searchUtils.searchText('query');
      expect(result).toBe(cachedResults);
      expect(mockFileUtils.listMarkdownFiles).not.toHaveBeenCalled();
    });

    it('should search for text in files', async () => {
      mockCache.get.mockReturnValue(undefined);
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockFileUtils.readFile.mockImplementation(async (file) => {
        if (file === 'note1.md') return 'Line 1\nLine with search term\nLine 3';
        return 'No match here';
      });

      const result = await searchUtils.searchText('search term');

      expect(result.results).toHaveLength(1);
      expect(result.results[0].path).toBe('note1.md');
      expect(result.results[0].matches).toHaveLength(1);
      expect(result.results[0].matches[0].text).toContain('search term');
    });

    it('should handle case-insensitive search', async () => {
      mockCache.get.mockReturnValue(undefined);
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note.md']);
      mockFileUtils.readFile.mockResolvedValue('UPPERCASE text');

      const result = await searchUtils.searchText('uppercase', { caseSensitive: false });
      expect(result.results).toHaveLength(1);
    });

    it('should handle whole word search', async () => {
      mockCache.get.mockReturnValue(undefined);
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note.md']);
      mockFileUtils.readFile.mockResolvedValue('testing test tested');

      const result = await searchUtils.searchText('test', { wholeWord: true });
      expect(result.results[0].matches).toHaveLength(1);
    });

    it('should handle regex search', async () => {
      mockCache.get.mockReturnValue(undefined);
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note.md']);
      mockFileUtils.readFile.mockResolvedValue('test123 test456');

      const result = await searchUtils.searchText('test\\d+', { regex: true });
      expect(result.results[0].matches).toHaveLength(2);
    });

    it('should respect limit option', async () => {
      mockCache.get.mockReturnValue(undefined);
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md', 'note3.md']);
      mockFileUtils.readFile.mockResolvedValue('match');

      const result = await searchUtils.searchText('match', { limit: 2 });
      expect(result.results).toHaveLength(2);
    });

    it('should cache results', async () => {
      mockCache.get.mockReturnValue(undefined);
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note.md']);
      mockFileUtils.readFile.mockResolvedValue('content');

      await searchUtils.searchText('query');
      expect(mockCache.set).toHaveBeenCalled();
    });
  });

  describe('searchByTags', () => {
    it('should find notes with specific tags', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockFileUtils.readFile.mockImplementation(async (file) => {
        if (file === 'note1.md') return 'Content with #tag1';
        return 'Content with #tag2';
      });
      mockParser.parseFrontmatter.mockReturnValue({ data: {}, content: '' });
      mockParser.extractTags.mockImplementation((content) => {
        if (content.includes('#tag1')) return ['tag1'];
        if (content.includes('#tag2')) return ['tag2'];
        return [];
      });

      const result = await searchUtils.searchByTags(['tag1']);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toBe('note1.md');
    });

    it('should match all tags when matchAll is true', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockFileUtils.readFile.mockResolvedValue('Content');
      mockParser.parseFrontmatter.mockReturnValue({ data: {}, content: '' });
      mockFileUtils.readFile.mockImplementation(async (file) => {
        if (file === 'note1.md') return 'content1';
        return 'content2';
      });
      mockParser.extractTags.mockImplementation((content) => {
        if (content === 'content1') return ['tag1', 'tag2'];
        return ['tag1'];
      });

      const result = await searchUtils.searchByTags(['tag1', 'tag2'], true);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toBe('note1.md');
    });
  });

  describe('searchByLinks', () => {
    it('should find notes that link to specified paths', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockLinkParser.getBacklinks.mockImplementation(async (path) => {
        if (path === 'target.md') return ['note1.md'];
        return [];
      });

      const result = await searchUtils.searchByLinks(['target.md'], 'to', false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toBe('note1.md');
    });

    it('should find notes linked from specified paths', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockLinkParser.getForwardLinks.mockImplementation(async (path) => {
        if (path === 'source.md') return ['note1.md'];
        return [];
      });

      const result = await searchUtils.searchByLinks(['source.md'], 'from', false);
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toBe('note1.md');
    });

    it('should find notes with bidirectional links', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockLinkParser.getBacklinks.mockResolvedValue(['note1.md']);
      mockLinkParser.getForwardLinks.mockResolvedValue(['note2.md']);

      const result = await searchUtils.searchByLinks(['target.md'], 'both', false);
      expect(result.results).toHaveLength(2);
    });
  });

  describe('searchByDate', () => {
    it('should find notes created within date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockFileUtils.getStats.mockImplementation(async (file) => {
        if (file === 'note1.md') {
          return {
            birthtime: new Date('2024-06-15'),
            mtime: new Date('2024-06-15')
          } as any;
        }
        return {
          birthtime: new Date('2023-01-01'),
          mtime: new Date('2023-01-01')
        } as any;
      });

      const result = await searchUtils.searchByDate({ startDate, endDate, dateField: 'created' });
      expect(result.results).toHaveLength(1);
      expect(result.results[0]).toBe('note1.md');
    });

    it('should find notes modified within date range', async () => {
      const startDate = new Date('2024-01-01');
      const endDate = new Date('2024-12-31');

      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note.md']);
      mockFileUtils.getStats.mockResolvedValue({
        birthtime: new Date('2023-01-01'),
        mtime: new Date('2024-06-15')
      } as any);

      const result = await searchUtils.searchByDate({ startDate, endDate, dateField: 'modified' });
      expect(result.results).toHaveLength(1);
    });
  });

  describe('advancedSearch', () => {
    it('should combine multiple search criteria', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['folder/note.md', 'other.md']);
      mockFileUtils.readFile.mockResolvedValue('Content with search term #tag1');
      mockParser.parseFrontmatter.mockReturnValue({
        data: { status: 'published' },
        content: 'Content'
      });
      mockParser.extractTags.mockReturnValue(['tag1']);

      const result = await searchUtils.advancedSearch({
        text: 'search term',
        tags: ['tag1'],
        frontmatter: { status: 'published' },
        folder: 'folder'
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].path).toBe('folder/note.md');
    });

    it('should filter by file pattern', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['test-note.md', 'other.md']);
      mockFileUtils.readFile.mockResolvedValue('Content');
      mockParser.parseFrontmatter.mockReturnValue({ data: {}, content: '' });
      mockParser.extractTags.mockReturnValue([]);

      const result = await searchUtils.advancedSearch({
        filePattern: 'test-.*\\.md'
      });

      expect(result.results).toHaveLength(1);
      expect(result.results[0].path).toBe('test-note.md');
    });
  });

  describe('findSimilarNotes', () => {
    it('should find notes with similar content', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md', 'note3.md']);
      mockFileUtils.readFile.mockImplementation(async (file) => {
        if (file === 'note1.md') return 'JavaScript programming tutorial';
        if (file === 'note2.md') return 'JavaScript coding guide';
        return 'Python programming';
      });
      mockParser.parseFrontmatter.mockReturnValue({ data: {}, content: '' });
      mockParser.extractTags.mockReturnValue([]);

      const result = await searchUtils.findSimilarNotes('note1.md', 0.3);

      expect(result.results.length).toBeGreaterThan(0);
      expect(result.results[0].similarity).toBeGreaterThan(0);
    });

    it('should consider tags in similarity', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockFileUtils.readFile.mockResolvedValue('Content');
      mockParser.parseFrontmatter.mockReturnValue({ data: {}, content: '' });
      mockParser.extractTags.mockImplementation((_, file) => {
        if (file === 'note1.md') return ['tag1', 'tag2'];
        if (file === 'note2.md') return ['tag1', 'tag2'];
        return [];
      });

      const result = await searchUtils.findSimilarNotes('note1.md', 0.1);
      expect(result.results.length).toBeGreaterThan(0);
    });
  });
});