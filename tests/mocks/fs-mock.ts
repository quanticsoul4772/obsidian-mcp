import { vol, fs as memfsFs } from 'memfs';
import { jest } from '@jest/globals';

export const createFsMock = (initialFiles: Record<string, string> = {}) => {
  // Reset volume
  vol.reset();

  // Initialize with files
  vol.fromJSON(initialFiles);

  return vol;
};

export const mockFs = () => {
  jest.mock('fs/promises', () => memfsFs.promises);
  jest.mock('fs', () => memfsFs);
};

export const unmockFs = () => {
  jest.unmock('fs/promises');
  jest.unmock('fs');
};

export const createVaultMock = () => {
  return createFsMock({
    '/vault/note1.md': '# Note 1\n\nContent here\n\n[[link to note2]]',
    '/vault/note2.md': '---\ntags: [test, example]\n---\n# Note 2\n\nContent',
    '/vault/folder/note3.md': '# Note 3\n\n#inline-tag #another-tag',
    '/vault/folder/subfolder/note4.md': '# Note 4\n\nNested content',
    '/vault/Templates/Daily Note.md': '# {{date}}\n\n## Tasks\n- [ ] ',
    '/vault/Daily Notes/2024-01-01.md': '# 2024-01-01\n\n## Tasks\n- [x] Completed task',
    '/vault/.obsidian/config.json': JSON.stringify({
      theme: 'moonstone',
      enabledPlugins: [],
      vaultName: 'Test Vault'
    })
  });
};