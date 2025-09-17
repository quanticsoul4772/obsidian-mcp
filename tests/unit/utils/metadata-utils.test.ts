import { MetadataUtils } from '../../../src/utils/metadata-utils';
import { FileUtils } from '../../../src/utils/file-utils';
import { ObsidianParser } from '../../../src/utils/obsidian-parser';

jest.mock('../../../src/utils/file-utils');
jest.mock('../../../src/utils/obsidian-parser');

describe('MetadataUtils', () => {
  let metadataUtils: MetadataUtils;
  let mockFileUtils: jest.Mocked<FileUtils>;
  let mockParser: jest.Mocked<ObsidianParser>;

  beforeEach(() => {
    mockFileUtils = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      listMarkdownFiles: jest.fn(),
    } as any;

    mockParser = {
      parseFrontmatter: jest.fn(),
      stringifyWithFrontmatter: jest.fn(),
      extractTags: jest.fn(),
    } as any;

    metadataUtils = new MetadataUtils(mockFileUtils, mockParser);
  });

  describe('getFrontmatter', () => {
    it('should get frontmatter from a note', async () => {
      const frontmatter = { title: 'Test', tags: ['tag1'] };
      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockReturnValue({
        data: frontmatter,
        content: 'body'
      });

      const result = await metadataUtils.getFrontmatter('note.md');
      expect(result).toEqual(frontmatter);
      expect(mockFileUtils.readFile).toHaveBeenCalledWith('note.md');
    });

    it('should throw error on failure', async () => {
      mockFileUtils.readFile.mockRejectedValue(new Error('Read failed'));

      await expect(metadataUtils.getFrontmatter('note.md'))
        .rejects.toThrow('Failed to get frontmatter');
    });
  });

  describe('updateFrontmatter', () => {
    it('should merge frontmatter by default', async () => {
      const existingFrontmatter = { title: 'Original', tags: ['tag1'] };
      const newFrontmatter = { author: 'John', tags: ['tag2'] };

      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockReturnValue({
        data: existingFrontmatter,
        content: 'body'
      });
      mockParser.stringifyWithFrontmatter.mockReturnValue('new content');

      await metadataUtils.updateFrontmatter('note.md', newFrontmatter);

      expect(mockParser.stringifyWithFrontmatter).toHaveBeenCalledWith(
        { title: 'Original', tags: ['tag2'], author: 'John' },
        'body'
      );
      expect(mockFileUtils.writeFile).toHaveBeenCalledWith('note.md', 'new content');
    });

    it('should replace frontmatter when merge is false', async () => {
      const existingFrontmatter = { title: 'Original', tags: ['tag1'] };
      const newFrontmatter = { author: 'John' };

      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockReturnValue({
        data: existingFrontmatter,
        content: 'body'
      });
      mockParser.stringifyWithFrontmatter.mockReturnValue('new content');

      await metadataUtils.updateFrontmatter('note.md', newFrontmatter, false);

      expect(mockParser.stringifyWithFrontmatter).toHaveBeenCalledWith(
        { author: 'John' },
        'body'
      );
    });

    it('should throw error on failure', async () => {
      mockFileUtils.readFile.mockRejectedValue(new Error('Read failed'));

      await expect(metadataUtils.updateFrontmatter('note.md', {}))
        .rejects.toThrow('Failed to update frontmatter');
    });
  });

  describe('getTags', () => {
    it('should get all tags from a note', async () => {
      const tags = ['tag1', 'tag2'];
      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockReturnValue({
        data: { tags: ['tag1'] },
        content: 'body #tag2'
      });
      mockParser.extractTags.mockReturnValue(tags);

      const result = await metadataUtils.getTags('note.md');
      expect(result).toEqual(tags);
    });

    it('should throw error on failure', async () => {
      mockFileUtils.readFile.mockRejectedValue(new Error('Read failed'));

      await expect(metadataUtils.getTags('note.md'))
        .rejects.toThrow('Failed to get tags');
    });
  });

  describe('addTags', () => {
    it('should add tags to frontmatter', async () => {
      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockReturnValue({
        data: { tags: ['existing'] },
        content: 'body'
      });
      mockParser.stringifyWithFrontmatter.mockReturnValue('new content');

      await metadataUtils.addTags('note.md', ['new1', 'new2'], 'frontmatter');

      expect(mockParser.stringifyWithFrontmatter).toHaveBeenCalledWith(
        { tags: ['existing', 'new1', 'new2'] },
        'body'
      );
      expect(mockFileUtils.writeFile).toHaveBeenCalledWith('note.md', 'new content');
    });

    it('should add tags inline', async () => {
      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockReturnValue({
        data: {},
        content: 'body content'
      });
      mockParser.stringifyWithFrontmatter.mockReturnValue('new content');

      await metadataUtils.addTags('note.md', ['tag1'], 'inline');

      expect(mockParser.stringifyWithFrontmatter).toHaveBeenCalled();
      const call = mockParser.stringifyWithFrontmatter.mock.calls[0];
      expect(call[1]).toContain('#tag1');
    });

    it('should normalize tags with # prefix', async () => {
      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockReturnValue({
        data: { tags: [] },
        content: 'body'
      });
      mockParser.stringifyWithFrontmatter.mockReturnValue('new content');

      await metadataUtils.addTags('note.md', ['#tag1', 'tag2'], 'frontmatter');

      expect(mockParser.stringifyWithFrontmatter).toHaveBeenCalledWith(
        { tags: ['tag1', 'tag2'] },
        'body'
      );
    });

    it('should add tags to both locations', async () => {
      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockReturnValue({
        data: { tags: [] },
        content: 'body'
      });
      mockParser.stringifyWithFrontmatter.mockReturnValue('new content');

      await metadataUtils.addTags('note.md', ['tag1'], 'both');

      const call = mockParser.stringifyWithFrontmatter.mock.calls[0];
      expect(call[0].tags).toContain('tag1');
      expect(call[1]).toContain('#tag1');
    });
  });

  describe('removeTags', () => {
    it('should remove tags from frontmatter', async () => {
      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockReturnValue({
        data: { tags: ['tag1', 'tag2', 'tag3'] },
        content: 'body'
      });
      mockParser.stringifyWithFrontmatter.mockReturnValue('new content');

      await metadataUtils.removeTags('note.md', ['tag2'], 'frontmatter');

      expect(mockParser.stringifyWithFrontmatter).toHaveBeenCalledWith(
        { tags: ['tag1', 'tag3'] },
        'body'
      );
    });

    it('should remove inline tags', async () => {
      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockReturnValue({
        data: {},
        content: 'body with #tag1 and #tag2'
      });
      mockParser.stringifyWithFrontmatter.mockReturnValue('new content');

      await metadataUtils.removeTags('note.md', ['tag1'], 'inline');

      const call = mockParser.stringifyWithFrontmatter.mock.calls[0];
      expect(call[1]).not.toContain('#tag1');
    });

    it('should remove tags from both locations', async () => {
      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockReturnValue({
        data: { tags: ['tag1', 'tag2'] },
        content: 'body #tag1'
      });
      mockParser.stringifyWithFrontmatter.mockReturnValue('new content');

      await metadataUtils.removeTags('note.md', ['tag1'], 'both');

      const call = mockParser.stringifyWithFrontmatter.mock.calls[0];
      expect(call[0].tags).toEqual(['tag2']);
      expect(call[1]).not.toContain('#tag1');
    });
  });

  describe('getAllTags', () => {
    it('should get all unique tags from vault', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockFileUtils.readFile.mockImplementation(async (file) => {
        if (file === 'note1.md') return 'content1';
        return 'content2';
      });
      mockParser.parseFrontmatter.mockReturnValue({ data: {}, content: '' });
      mockFileUtils.readFile.mockImplementation(async (file) => {
        if (file === 'note1.md') return 'content1';
        return 'content2';
      });
      mockParser.extractTags.mockImplementation((content) => {
        if (content === 'content1') return ['tag1', 'tag2'];
        return ['tag2', 'tag3'];
      });

      const result = await metadataUtils.getAllTags();
      expect(result.data).toEqual(['tag1', 'tag2', 'tag3']);
      expect(result.metadata?.totalProcessed).toBe(2);
    });

    it('should handle errors gracefully', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockFileUtils.readFile.mockImplementation(async (file) => {
        if (file === 'note1.md') throw new Error('Read failed');
        return 'content';
      });
      mockParser.parseFrontmatter.mockReturnValue({ data: {}, content: '' });
      mockParser.extractTags.mockReturnValue(['tag1']);

      const result = await metadataUtils.getAllTags();
      expect(result.data).toEqual(['tag1']);
      expect(result.errors).toHaveLength(1);
      expect(result.metadata?.errorCount).toBe(1);
    });
  });

  describe('findByFrontmatter', () => {
    it('should find notes with specific frontmatter field', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockImplementation((content) => {
        if (content === 'content1') {
          return { data: { status: 'published' }, content: '' };
        }
        return { data: { status: 'draft' }, content: '' };
      });
      mockFileUtils.readFile.mockImplementation(async (file) => {
        if (file === 'note1.md') return 'content1';
        return 'content2';
      });

      const result = await metadataUtils.findByFrontmatter('status', 'published');
      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toBe('note1.md');
    });

    it('should find all notes with field when no value specified', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockImplementation(() => ({
        data: { customField: 'value' },
        content: ''
      }));

      const result = await metadataUtils.findByFrontmatter('customField');
      expect(result.data).toHaveLength(2);
    });

    it('should handle non-exact matches when exactMatch is false', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md']);
      mockFileUtils.readFile.mockResolvedValue('content');
      mockParser.parseFrontmatter.mockReturnValue({
        data: { title: 'Testing Guide' },
        content: ''
      });

      const result = await metadataUtils.findByFrontmatter('title', 'test', false);
      expect(result.data).toHaveLength(1);
    });
  });
});