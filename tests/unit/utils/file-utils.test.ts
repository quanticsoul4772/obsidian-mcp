import { FileUtils } from '../../../src/utils/file-utils';
import * as fs from 'fs/promises';
import { LRUCache } from '../../../src/lru-cache';

jest.mock('fs/promises');
jest.mock('glob');

describe('FileUtils', () => {
  let fileUtils: FileUtils;
  let mockCache: jest.Mocked<LRUCache<string>>;
  const vaultPath = '/test/vault';

  beforeEach(() => {
    jest.clearAllMocks();
    mockCache = {
      get: jest.fn(),
      set: jest.fn(),
      has: jest.fn(),
      delete: jest.fn(),
      clear: jest.fn(),
      getCurrentSize: jest.fn(),
      getStats: jest.fn(),
    } as any;
    fileUtils = new FileUtils(vaultPath, mockCache);
  });

  describe('toAbsolutePath', () => {
    it('should return absolute path unchanged', () => {
      const absPath = '/absolute/path/file.md';
      expect(fileUtils.toAbsolutePath(absPath)).toBe(absPath);
    });

    it('should convert relative path to absolute vault path', () => {
      const relPath = 'notes/file.md';
      expect(fileUtils.toAbsolutePath(relPath)).toBe('/test/vault/notes/file.md');
    });
  });

  describe('toRelativePath', () => {
    it('should convert absolute vault path to relative', () => {
      const absPath = '/test/vault/notes/file.md';
      expect(fileUtils.toRelativePath(absPath)).toBe('notes/file.md');
    });

    it('should handle paths outside vault', () => {
      const absPath = '/other/path/file.md';
      expect(fileUtils.toRelativePath(absPath)).toBe('../../other/path/file.md');
    });
  });

  describe('ensureMarkdownExtension', () => {
    it('should add .md extension if missing', () => {
      expect(fileUtils.ensureMarkdownExtension('file')).toBe('file.md');
    });

    it('should not add .md extension if present', () => {
      expect(fileUtils.ensureMarkdownExtension('file.md')).toBe('file.md');
    });
  });

  describe('exists', () => {
    it('should return true when file exists', async () => {
      (fs.access as jest.Mock).mockResolvedValue(undefined);
      const result = await fileUtils.exists('file.md');
      expect(result).toBe(true);
      expect(fs.access).toHaveBeenCalledWith('/test/vault/file.md');
    });

    it('should return false when file does not exist', async () => {
      (fs.access as jest.Mock).mockRejectedValue(new Error('ENOENT'));
      const result = await fileUtils.exists('file.md');
      expect(result).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return file stats', async () => {
      const mockStats = { size: 1024, mtime: new Date() };
      (fs.stat as jest.Mock).mockResolvedValue(mockStats);

      const result = await fileUtils.getStats('file.md');
      expect(result).toBe(mockStats);
      expect(fs.stat).toHaveBeenCalledWith('/test/vault/file.md');
    });
  });

  describe('readFile', () => {
    it('should return cached content if available', async () => {
      const cachedContent = 'cached content';
      mockCache.get.mockReturnValue(cachedContent);

      const result = await fileUtils.readFile('file.md');
      expect(result).toBe(cachedContent);
      expect(mockCache.get).toHaveBeenCalledWith('file.md');
      expect(fs.readFile).not.toHaveBeenCalled();
    });

    it('should read from disk if not cached', async () => {
      const fileContent = 'file content';
      mockCache.get.mockReturnValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(fileContent);

      const result = await fileUtils.readFile('file.md');
      expect(result).toBe(fileContent);
      expect(fs.readFile).toHaveBeenCalledWith('/test/vault/file.md', 'utf-8');
    });

    it('should cache content if under 5MB', async () => {
      const fileContent = 'small content';
      mockCache.get.mockReturnValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(fileContent);

      await fileUtils.readFile('file.md');
      expect(mockCache.set).toHaveBeenCalledWith(
        'file.md',
        fileContent,
        Buffer.byteLength(fileContent, 'utf8')
      );
    });

    it('should not cache content if over 5MB', async () => {
      const largeContent = 'x'.repeat(6 * 1024 * 1024);
      mockCache.get.mockReturnValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue(largeContent);

      await fileUtils.readFile('file.md');
      expect(mockCache.set).not.toHaveBeenCalled();
    });

    it('should ensure markdown extension', async () => {
      mockCache.get.mockReturnValue(undefined);
      (fs.readFile as jest.Mock).mockResolvedValue('content');

      await fileUtils.readFile('file');
      expect(mockCache.get).toHaveBeenCalledWith('file.md');
      expect(fs.readFile).toHaveBeenCalledWith('/test/vault/file.md', 'utf-8');
    });
  });

  describe('writeFile', () => {
    it('should write content to file', async () => {
      const content = 'new content';
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await fileUtils.writeFile('file.md', content);
      expect(fs.writeFile).toHaveBeenCalledWith('/test/vault/file.md', content, 'utf-8');
    });

    it('should create directory if it does not exist', async () => {
      (fs.writeFile as jest.Mock).mockRejectedValueOnce({ code: 'ENOENT' });
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeFile as jest.Mock).mockResolvedValueOnce(undefined);

      await fileUtils.writeFile('notes/file.md', 'content');
      expect(fs.mkdir).toHaveBeenCalledWith('/test/vault/notes', { recursive: true });
      expect(fs.writeFile).toHaveBeenCalledTimes(2);
    });

    it('should invalidate cache after write', async () => {
      (fs.writeFile as jest.Mock).mockResolvedValue(undefined);

      await fileUtils.writeFile('file.md', 'content');
      expect(mockCache.delete).toHaveBeenCalledWith('file.md');
    });
  });

  describe('deleteFile', () => {
    it('should delete file', async () => {
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await fileUtils.deleteFile('file.md');
      expect(fs.unlink).toHaveBeenCalledWith('/test/vault/file.md');
    });

    it('should invalidate cache after delete', async () => {
      (fs.unlink as jest.Mock).mockResolvedValue(undefined);

      await fileUtils.deleteFile('file.md');
      expect(mockCache.delete).toHaveBeenCalledWith('file.md');
    });
  });

  describe('listMarkdownFiles', () => {
    it('should list markdown files', async () => {
      const glob = require('glob');
      glob.glob = jest.fn().mockResolvedValue([
        'notes/file1.md',
        'notes/file2.md'
      ]);

      const result = await fileUtils.listMarkdownFiles();
      expect(result).toEqual(['notes/file1.md', 'notes/file2.md']);
      expect(glob.glob).toHaveBeenCalledWith('**/*.md', {
        cwd: '/test/vault',
        ignore: ['node_modules/**', '.obsidian/**', '.trash/**']
      });
    });

    it('should handle pattern filtering', async () => {
      const glob = require('glob');
      glob.glob = jest.fn().mockResolvedValue([
        'test1.md',
        'test2.md'
      ]);

      const result = await fileUtils.listMarkdownFiles('test*.md');
      expect(result).toEqual(['test1.md', 'test2.md']);
      expect(glob.glob).toHaveBeenCalledWith('test*.md', {
        cwd: '/test/vault',
        ignore: ['node_modules/**', '.obsidian/**', '.trash/**']
      });
    });
  });

  describe('ensureFolder', () => {
    it('should create folder if it does not exist', async () => {
      (fs.mkdir as jest.Mock).mockResolvedValue(undefined);

      await fileUtils.ensureFolder('notes/subfolder');
      expect(fs.mkdir).toHaveBeenCalledWith('/test/vault/notes/subfolder', { recursive: true });
    });
  });

});