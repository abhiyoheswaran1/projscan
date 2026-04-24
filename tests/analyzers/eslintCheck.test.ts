import { describe, it, expect, vi, beforeEach } from 'vitest';
import { check } from '../../src/analyzers/eslintCheck.js';
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

describe('eslintCheck', () => {
  beforeEach(() => vi.restoreAllMocks());

  it.each([
    '.eslintrc',
    '.eslintrc.js',
    '.eslintrc.cjs',
    '.eslintrc.json',
    '.eslintrc.yml',
    '.eslintrc.yaml',
    'eslint.config.js',
    'eslint.config.mjs',
    'eslint.config.cjs',
    'eslint.config.ts',
    'eslint.config.mts',
  ])('returns no issues when %s exists at root', async (configName) => {
    mockPackageJson({});
    const issues = await check('/proj', [makeFile(configName), makeFile('src/index.ts')]);
    expect(issues).toHaveLength(0);
  });

  it('does not treat nested eslint config as root config', async () => {
    mockPackageJson({});
    const files = [makeFile('packages/a/.eslintrc.js'), makeFile('src/index.ts')];
    const issues = await check('/proj', files);
    expect(issues.find((i) => i.id === 'missing-eslint')).toBeDefined();
  });

  it('returns no issues when package.json has eslintConfig', async () => {
    mockPackageJson({ eslintConfig: { extends: 'standard' } });
    const issues = await check('/proj', [makeFile('src/index.ts')]);
    expect(issues).toHaveLength(0);
  });

  it('flags missing ESLint config for JS/TS projects', async () => {
    mockPackageJson({});
    const issues = await check('/proj', [makeFile('src/index.ts')]);
    const issue = issues.find((i) => i.id === 'missing-eslint');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.category).toBe('linting');
    expect(issue!.fixAvailable).toBe(true);
    expect(issue!.fixId).toBe('add-eslint');
  });

  it('does not flag non-JS/TS projects', async () => {
    mockPackageJson({});
    const issues = await check('/proj', [makeFile('main.py'), makeFile('README.md')]);
    expect(issues).toHaveLength(0);
  });

  it.each(['.js', '.jsx', '.ts', '.tsx', '.mjs', '.cjs'])(
    'flags for %s files',
    async (ext) => {
      mockPackageJson({});
      const issues = await check('/proj', [makeFile(`src/file${ext}`)]);
      expect(issues.find((i) => i.id === 'missing-eslint')).toBeDefined();
    },
  );

  it('handles missing package.json gracefully', async () => {
    mockPackageJson(null);
    const issues = await check('/proj', [makeFile('src/index.ts')]);
    expect(issues.find((i) => i.id === 'missing-eslint')).toBeDefined();
  });

  it('handles malformed package.json gracefully', async () => {
    vi.mocked(fs.readFile).mockImplementation(async (p) => {
      if (String(p).endsWith('package.json')) return '{not valid json';
      return '';
    });
    const issues = await check('/proj', [makeFile('src/index.ts')]);
    expect(issues.find((i) => i.id === 'missing-eslint')).toBeDefined();
  });
});
