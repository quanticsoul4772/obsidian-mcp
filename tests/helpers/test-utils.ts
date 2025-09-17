import { jest } from '@jest/globals';
import { LRUCache } from '@/lru-cache';

export const createMockVault = (files: Record<string, string>) => {
  return {
    files,
    getFile: jest.fn((path: string) => files[path]),
    writeFile: jest.fn(),
    deleteFile: jest.fn(),
    listFiles: jest.fn(() => Object.keys(files)),
    exists: jest.fn((path: string) => path in files)
  };
};

export const createMockCache = <T>() => {
  const cache = new Map<string, T>();
  return {
    get: jest.fn((key: string) => cache.get(key)),
    set: jest.fn((key: string, value: T) => cache.set(key, value)),
    has: jest.fn((key: string) => cache.has(key)),
    delete: jest.fn((key: string) => cache.delete(key)),
    clear: jest.fn(() => cache.clear()),
    size: () => cache.size
  };
};

export const createMockFileSystem = () => {
  const files = new Map<string, string>();
  return {
    readFile: jest.fn(async (path: string) => {
      if (!files.has(path)) {
        throw new Error(`ENOENT: no such file or directory, open '${path}'`);
      }
      return files.get(path);
    }),
    writeFile: jest.fn(async (path: string, content: string) => {
      files.set(path, content);
    }),
    unlink: jest.fn(async (path: string) => {
      if (!files.has(path)) {
        throw new Error(`ENOENT: no such file or directory, unlink '${path}'`);
      }
      files.delete(path);
    }),
    exists: jest.fn(async (path: string) => files.has(path)),
    mkdir: jest.fn(),
    readdir: jest.fn(async () => Array.from(files.keys())),
    stat: jest.fn(async (path: string) => ({
      isFile: () => files.has(path),
      isDirectory: () => !files.has(path),
      size: files.get(path)?.length || 0,
      mtime: new Date()
    })),
    _setFile: (path: string, content: string) => files.set(path, content),
    _getFiles: () => files
  };
};

export const waitForAsync = (ms: number = 0): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, ms));

export const createTestNote = (overrides: Partial<any> = {}) => {
  return {
    path: 'test-note.md',
    content: '# Test Note\n\nContent here',
    frontmatter: {},
    tags: [],
    links: [],
    ...overrides
  };
};

export const createTestVaultStructure = () => {
  return {
    '/vault/note1.md': '# Note 1\n\nContent with [[link]]',
    '/vault/note2.md': '---\ntags: [test, example]\n---\n# Note 2',
    '/vault/folder/note3.md': '# Note 3\n\n#tag1 #tag2',
    '/vault/daily/2024-01-01.md': '# Daily Note\n\n- [ ] Task 1\n- [x] Task 2',
    '/vault/.obsidian/config': JSON.stringify({ theme: 'dark' })
  };
};

export const mockPerformance = () => {
  let time = 0;
  return {
    now: jest.fn(() => time++),
    mark: jest.fn(),
    measure: jest.fn(),
    clearMarks: jest.fn(),
    clearMeasures: jest.fn(),
    getEntriesByName: jest.fn(() => []),
    getEntriesByType: jest.fn(() => [])
  };
};

export class TestableDate extends Date {
  private static mockDate: Date | null = null;

  constructor(...args: any[]) {
    if (args.length === 0 && TestableDate.mockDate) {
      super(TestableDate.mockDate.getTime());
    } else {
      super(...args);
    }
  }

  static setMockDate(date: Date | string | null) {
    TestableDate.mockDate = date ? new Date(date) : null;
  }

  static resetMockDate() {
    TestableDate.mockDate = null;
  }
}