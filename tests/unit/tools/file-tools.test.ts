import { registerFileTools } from '../../../src/tools/file-tools';
import { FileUtils } from '../../../src/utils/file-utils';
import { ObsidianParser } from '../../../src/utils/obsidian-parser';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

jest.mock('../../../src/utils/file-utils');
jest.mock('../../../src/utils/obsidian-parser');
jest.mock('@modelcontextprotocol/sdk/server/mcp.js');

describe('file-tools', () => {
  let mockServer: jest.Mocked<McpServer>;
  let mockFileUtils: jest.Mocked<FileUtils>;
  let mockParser: jest.Mocked<ObsidianParser>;
  let registeredTools: Map<string, any>;

  beforeEach(() => {
    registeredTools = new Map();

    mockServer = {
      tool: jest.fn((name, description, schema, handler) => {
        registeredTools.set(name, { description, schema, handler });
      })
    } as any;

    mockFileUtils = {
      readFile: jest.fn(),
      writeFile: jest.fn(),
      deleteFile: jest.fn(),
      renameFile: jest.fn(),
      listMarkdownFiles: jest.fn(),
      exists: jest.fn(),
      ensureMarkdownExtension: jest.fn((path) => path.endsWith('.md') ? path : `${path}.md`),
      ensureFolder: jest.fn(),
      getFilesInFolder: jest.fn(),
      getStats: jest.fn(),
      listAllFiles: jest.fn(),
      listFolders: jest.fn(),
      isFolder: jest.fn(),
      deleteFolder: jest.fn(),
    } as any;

    mockParser = {
      parseFrontmatter: jest.fn(),
      stringifyWithFrontmatter: jest.fn(),
      extractTags: jest.fn(),
      updateLinks: jest.fn(),
    } as any;

    registerFileTools(mockServer, mockFileUtils, mockParser);
  });

  describe('obsidian_read_file', () => {
    it('should read a file successfully', async () => {
      const content = 'Test content';
      const frontmatter = { title: 'Test' };
      const body = 'Body content';
      const tags = ['tag1', 'tag2'];

      mockFileUtils.readFile.mockResolvedValue(content);
      mockParser.parseFrontmatter.mockReturnValue({ data: frontmatter, content: body });
      mockParser.extractTags.mockReturnValue(tags);

      const tool = registeredTools.get('obsidian_read_file');
      const result = await tool.handler({ path: 'test.md' });

      expect(mockFileUtils.readFile).toHaveBeenCalledWith('test.md');
      expect(result.content[0].type).toBe('text');

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.data.content).toBe(content);
      expect(data.data.frontmatter).toEqual(frontmatter);
      expect(data.data.tags).toEqual(tags);
    });

    it('should handle read errors', async () => {
      mockFileUtils.readFile.mockRejectedValue(new Error('File not found'));

      const tool = registeredTools.get('obsidian_read_file');
      const result = await tool.handler({ path: 'nonexistent.md' });

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('File not found');
      expect(result.isError).toBe(true);
    });
  });

  describe('obsidian_create_file', () => {
    it('should create a new file', async () => {
      mockFileUtils.exists.mockResolvedValue(false);
      mockParser.stringifyWithFrontmatter.mockReturnValue('formatted content');

      const tool = registeredTools.get('obsidian_create_file');
      const result = await tool.handler({
        path: 'new-note.md',
        content: 'Note content',
        frontmatter: { title: 'New Note' }
      });

      expect(mockFileUtils.writeFile).toHaveBeenCalledWith('new-note.md', 'formatted content');
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('should not overwrite existing file without flag', async () => {
      mockFileUtils.exists.mockResolvedValue(true);

      const tool = registeredTools.get('obsidian_create_file');
      const result = await tool.handler({
        path: 'existing.md',
        content: 'content',
        overwrite: false
      });

      expect(mockFileUtils.writeFile).not.toHaveBeenCalled();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('already exists');
    });

    it('should overwrite existing file with flag', async () => {
      mockFileUtils.exists.mockResolvedValue(true);
      mockParser.stringifyWithFrontmatter.mockReturnValue('new content');

      const tool = registeredTools.get('obsidian_create_file');
      const result = await tool.handler({
        path: 'existing.md',
        content: 'new content',
        overwrite: true
      });

      expect(mockFileUtils.writeFile).toHaveBeenCalled();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });
  });

  describe('obsidian_update_file', () => {
    it('should update an existing file', async () => {
      mockFileUtils.exists.mockResolvedValue(true);

      const tool = registeredTools.get('obsidian_update_file');
      const result = await tool.handler({
        path: 'note.md',
        content: 'New content'
      });

      expect(mockFileUtils.writeFile).toHaveBeenCalledWith('note.md', 'New content');
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('should preserve frontmatter when flag is set', async () => {
      mockFileUtils.exists.mockResolvedValue(true);
      const oldContent = '---\ntitle: Keep This\n---\nOld content';
      mockFileUtils.readFile.mockResolvedValue(oldContent);
      mockParser.parseFrontmatter.mockReturnValue({
        data: { title: 'Keep This' },
        content: 'Old content'
      });
      mockParser.stringifyWithFrontmatter.mockReturnValue('final content');

      const tool = registeredTools.get('obsidian_update_file');
      await tool.handler({
        path: 'note.md',
        content: 'New content',
        preserveFrontmatter: true
      });

      expect(mockParser.stringifyWithFrontmatter).toHaveBeenCalledWith(
        { title: 'Keep This' },
        'New content'
      );
      expect(mockFileUtils.writeFile).toHaveBeenCalledWith('note.md', 'final content');
    });

    it('should merge frontmatter when provided', async () => {
      mockFileUtils.exists.mockResolvedValue(true);
      const oldContent = '---\ntitle: Old\nauthor: John\n---\nContent';
      mockFileUtils.readFile.mockResolvedValue(oldContent);
      mockParser.parseFrontmatter.mockReturnValue({
        data: { title: 'Old', author: 'John' },
        content: 'Content'
      });
      mockParser.stringifyWithFrontmatter.mockReturnValue('final content');

      const tool = registeredTools.get('obsidian_update_file');
      await tool.handler({
        path: 'note.md',
        content: 'New content',
        mergeFrontmatter: { title: 'New', tags: ['tag1'] }
      });

      expect(mockParser.stringifyWithFrontmatter).toHaveBeenCalledWith(
        { title: 'New', author: 'John', tags: ['tag1'] },
        'New content'
      );
      expect(mockFileUtils.writeFile).toHaveBeenCalledWith('note.md', 'final content');
    });
  });

  describe('obsidian_delete_file', () => {
    it('should delete a file with confirmation', async () => {
      mockFileUtils.exists.mockResolvedValue(true);

      const tool = registeredTools.get('obsidian_delete_file');
      const result = await tool.handler({
        path: 'note.md',
        confirm: true
      });

      expect(mockFileUtils.deleteFile).toHaveBeenCalledWith('note.md');
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
    });

    it('should not delete without confirmation', async () => {
      const tool = registeredTools.get('obsidian_delete_file');
      const result = await tool.handler({
        path: 'note.md',
        confirm: false
      });

      expect(mockFileUtils.deleteFile).not.toHaveBeenCalled();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Confirmation');
    });

    it('should handle non-existent files', async () => {
      mockFileUtils.exists.mockResolvedValue(false);

      const tool = registeredTools.get('obsidian_delete_file');
      const result = await tool.handler({
        path: 'nonexistent.md',
        confirm: true
      });

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('does not exist');
    });
  });

  describe('obsidian_rename_file', () => {
    it('should rename a file and update links', async () => {
      mockFileUtils.exists.mockResolvedValueOnce(true); // old exists
      mockFileUtils.exists.mockResolvedValueOnce(false); // new doesn't exist
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['other.md']);
      mockFileUtils.readFile.mockResolvedValue('Link to [[old-note]]');
      mockParser.updateLinks.mockReturnValue('Link to [[new-note]]');

      const tool = registeredTools.get('obsidian_rename_file');
      const result = await tool.handler({
        oldPath: 'old-note.md',
        newPath: 'new-note.md',
        updateLinks: true
      });

      expect(mockFileUtils.renameFile).toHaveBeenCalledWith('old-note.md', 'new-note.md');
      expect(mockParser.updateLinks).toHaveBeenCalled();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.data.updatedFiles).toBe(1);
    });

    it('should not rename if target exists', async () => {
      mockFileUtils.exists.mockResolvedValueOnce(true); // old exists
      mockFileUtils.exists.mockResolvedValueOnce(true); // new also exists

      const tool = registeredTools.get('obsidian_rename_file');
      const result = await tool.handler({
        oldPath: 'old.md',
        newPath: 'existing.md'
      });

      expect(mockFileUtils.renameFile).not.toHaveBeenCalled();
      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(false);
      expect(data.error).toContain('already exists');
    });
  });

  describe('obsidian_list_files', () => {
    it('should list files with metadata', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['note1.md', 'note2.md']);
      mockFileUtils.getStats.mockImplementation(async (file) => ({
        size: 1024,
        mtime: new Date('2024-01-01'),
        birthtime: new Date('2023-12-01')
      } as any));

      const tool = registeredTools.get('obsidian_list_files');
      const result = await tool.handler({});

      const data = JSON.parse(result.content[0].text);
      expect(data.success).toBe(true);
      expect(data.data.files).toHaveLength(2);
      expect(data.data.files[0]).toHaveProperty('path');
      expect(data.data.files[0]).toHaveProperty('size');
      expect(data.data.files[0]).toHaveProperty('modified');
    });

    it('should filter by folder', async () => {
      mockFileUtils.getFilesInFolder.mockResolvedValue(['folder/note.md']);

      const tool = registeredTools.get('obsidian_list_files');
      const result = await tool.handler({ folder: 'folder' });

      expect(mockFileUtils.getFilesInFolder).toHaveBeenCalledWith('folder');
      const data = JSON.parse(result.content[0].text);
      expect(data.data.files).toHaveLength(1);
    });

    it('should sort files by name', async () => {
      mockFileUtils.listMarkdownFiles.mockResolvedValue(['b.md', 'a.md', 'c.md']);
      mockFileUtils.getStats.mockResolvedValue({
        size: 100,
        mtime: new Date(),
        birthtime: new Date()
      } as any);

      const tool = registeredTools.get('obsidian_list_files');
      const result = await tool.handler({ sortBy: 'name', sortOrder: 'asc' });

      const data = JSON.parse(result.content[0].text);
      expect(data.data.files[0].path).toBe('a.md');
      expect(data.data.files[1].path).toBe('b.md');
      expect(data.data.files[2].path).toBe('c.md');
    });
  });
});