import { describe, it, expect, afterEach } from 'vitest';
import { walkFiles, getDefaultIgnorePatterns } from '../../src/utils/fileWalker.js';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

describe('fileWalker', () => {
  let tmpDir: string;

  async function createTmpDir(): Promise<string> {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-test-'));
    return dir;
  }

  async function createFile(dir: string, relativePath: string, content = ''): Promise<void> {
    const fullPath = path.join(dir, relativePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf-8');
  }

  afterEach(async () => {
    if (tmpDir) {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  });

  it('should find all files in a directory', async () => {
    tmpDir = await createTmpDir();
    await createFile(tmpDir, 'index.ts', 'export {}');
    await createFile(tmpDir, 'utils/helper.ts', 'export {}');
    await createFile(tmpDir, 'styles/main.css', 'body {}');

    const files = await walkFiles(tmpDir);
    expect(files).toHaveLength(3);

    const paths = files.map((f) => f.relativePath).sort();
    expect(paths).toContain('index.ts');
    expect(paths).toContain('utils/helper.ts');
    expect(paths).toContain('styles/main.css');
  });

  it('should ignore node_modules by default', async () => {
    tmpDir = await createTmpDir();
    await createFile(tmpDir, 'index.ts', 'export {}');
    await createFile(tmpDir, 'node_modules/pkg/index.js', 'module.exports = {}');

    const files = await walkFiles(tmpDir);
    expect(files).toHaveLength(1);
    expect(files[0].relativePath).toBe('index.ts');
  });

  it('should return correct file extensions', async () => {
    tmpDir = await createTmpDir();
    await createFile(tmpDir, 'app.tsx', '');
    await createFile(tmpDir, 'style.scss', '');
    await createFile(tmpDir, 'data.json', '{}');

    const files = await walkFiles(tmpDir);
    const extensions = files.map((f) => f.extension).sort();
    expect(extensions).toEqual(['.json', '.scss', '.tsx']);
  });

  it('should filter by extensions when provided', async () => {
    tmpDir = await createTmpDir();
    await createFile(tmpDir, 'index.ts', '');
    await createFile(tmpDir, 'style.css', '');
    await createFile(tmpDir, 'data.json', '{}');

    const files = await walkFiles(tmpDir, { extensions: ['.ts'] });
    expect(files).toHaveLength(1);
    expect(files[0].extension).toBe('.ts');
  });

  it('should return default ignore patterns', () => {
    const patterns = getDefaultIgnorePatterns();
    expect(patterns).toContain('**/node_modules/**');
    expect(patterns).toContain('**/.git/**');
    expect(patterns).toContain('**/dist/**');
  });
});
