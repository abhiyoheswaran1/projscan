import { describe, it, expect, vi } from 'vitest';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import type { FileEntry } from '../../src/types.js';

vi.mock('../../src/utils/fileWalker.js', () => ({
  walkFiles: vi.fn().mockResolvedValue([
    { relativePath: 'src/index.ts', absolutePath: '/proj/src/index.ts', extension: '.ts', sizeBytes: 200, directory: 'src' },
    { relativePath: 'src/utils/helper.ts', absolutePath: '/proj/src/utils/helper.ts', extension: '.ts', sizeBytes: 150, directory: 'src/utils' },
    { relativePath: 'src/utils/format.ts', absolutePath: '/proj/src/utils/format.ts', extension: '.ts', sizeBytes: 100, directory: 'src/utils' },
    { relativePath: 'package.json', absolutePath: '/proj/package.json', extension: '.json', sizeBytes: 500, directory: '.' },
    { relativePath: 'README.md', absolutePath: '/proj/README.md', extension: '.md', sizeBytes: 300, directory: '.' },
  ] as FileEntry[]),
}));

describe('scanRepository', () => {
  it('should return correct file count', async () => {
    const result = await scanRepository('/proj');
    expect(result.totalFiles).toBe(5);
  });

  it('should return correct directory count', async () => {
    const result = await scanRepository('/proj');
    // directories: '.', 'src', 'src/utils'
    expect(result.totalDirectories).toBe(3);
  });

  it('should build a valid directory tree', async () => {
    const result = await scanRepository('/proj');

    expect(result.directoryTree.name).toBe('proj');
    expect(result.directoryTree.totalFileCount).toBe(5);

    // Should have 'src' as a child
    const srcNode = result.directoryTree.children.find((c) => c.name === 'src');
    expect(srcNode).toBeDefined();
    expect(srcNode!.totalFileCount).toBe(3); // index.ts + 2 utils files
  });

  it('should compute nested directory counts correctly', async () => {
    const result = await scanRepository('/proj');

    const srcNode = result.directoryTree.children.find((c) => c.name === 'src');
    const utilsNode = srcNode?.children.find((c) => c.name === 'utils');
    expect(utilsNode).toBeDefined();
    expect(utilsNode!.fileCount).toBe(2);
    expect(utilsNode!.totalFileCount).toBe(2);
  });

  it('should report scan duration', async () => {
    const result = await scanRepository('/proj');
    expect(result.scanDurationMs).toBeGreaterThanOrEqual(0);
  });
});
