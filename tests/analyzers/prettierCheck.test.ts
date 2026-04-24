import { describe, it, expect, vi, beforeEach } from 'vitest';
import { check } from '../../src/analyzers/prettierCheck.js';
import type { FileEntry } from '../../src/types.js';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

function makeFile(relativePath: string, sizeBytes = 100): FileEntry {
  const ext = relativePath.includes('.') ? relativePath.substring(relativePath.lastIndexOf('.')) : '';
  const dir = relativePath.includes('/') ? relativePath.substring(0, relativePath.lastIndexOf('/')) : '.';
  return {
    relativePath,
    absolutePath: `/proj/${relativePath}`,
    extension: ext,
    sizeBytes,
    directory: dir,
  };
}

function mockPackageJson(pkg: Record<string, unknown> | null): void {
  vi.mocked(fs.readFile).mockImplementation(async (p) => {
    if (String(p).endsWith('package.json')) {
      if (pkg === null) throw new Error('ENOENT');
      return JSON.stringify(pkg);
    }
    return '';
  });
}

describe('prettierCheck', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns no issues when .prettierrc is present at the root', async () => {
    mockPackageJson({});
    const files = [makeFile('.prettierrc'), makeFile('src/index.ts')];
    const issues = await check('/proj', files);
    expect(issues).toHaveLength(0);
  });

  it.each([
    '.prettierrc.js',
    '.prettierrc.cjs',
    '.prettierrc.mjs',
    '.prettierrc.json',
    '.prettierrc.yml',
    '.prettierrc.yaml',
    '.prettierrc.toml',
    'prettier.config.js',
    'prettier.config.cjs',
    'prettier.config.mjs',
    'prettier.config.ts',
  ])('recognises %s as valid prettier config', async (configName) => {
    mockPackageJson({});
    const issues = await check('/proj', [makeFile(configName), makeFile('src/index.ts')]);
    expect(issues).toHaveLength(0);
  });

  it('does not treat a nested config file as root config', async () => {
    mockPackageJson({});
    const files = [makeFile('packages/lib/.prettierrc'), makeFile('src/index.ts')];
    const issues = await check('/proj', files);
    expect(issues.find((i) => i.id === 'missing-prettier')).toBeDefined();
  });

  it('returns no issues when package.json contains a prettier key', async () => {
    mockPackageJson({ prettier: { semi: false } });
    const files = [makeFile('src/index.ts')];
    const issues = await check('/proj', files);
    expect(issues).toHaveLength(0);
  });

  it('flags missing prettier config on JS/TS projects', async () => {
    mockPackageJson({});
    const files = [makeFile('src/index.ts')];
    const issues = await check('/proj', files);
    const issue = issues.find((i) => i.id === 'missing-prettier');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.category).toBe('formatting');
    expect(issue!.fixAvailable).toBe(true);
    expect(issue!.fixId).toBe('add-prettier');
  });

  it('flags missing prettier for CSS/HTML-only projects', async () => {
    mockPackageJson({});
    const files = [makeFile('style.css'), makeFile('index.html')];
    const issues = await check('/proj', files);
    expect(issues.find((i) => i.id === 'missing-prettier')).toBeDefined();
  });

  it('does not flag non-web projects', async () => {
    mockPackageJson({});
    const files = [makeFile('main.py'), makeFile('README.md')];
    const issues = await check('/proj', files);
    expect(issues).toHaveLength(0);
  });

  it('handles missing package.json gracefully', async () => {
    mockPackageJson(null);
    const files = [makeFile('src/index.ts')];
    const issues = await check('/proj', files);
    expect(issues.find((i) => i.id === 'missing-prettier')).toBeDefined();
  });
});
