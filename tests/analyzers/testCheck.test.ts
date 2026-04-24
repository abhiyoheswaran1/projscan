import { describe, it, expect, vi, beforeEach } from 'vitest';
import { check } from '../../src/analyzers/testCheck.js';
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

describe('testCheck', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns no issues for non-JS/TS projects', async () => {
    mockPackageJson({});
    const files = [makeFile('main.py'), makeFile('README.md')];
    const issues = await check('/proj', files);
    expect(issues).toHaveLength(0);
  });

  it('flags missing test framework on JS/TS projects', async () => {
    mockPackageJson({ dependencies: {}, devDependencies: {} });
    const files = [makeFile('src/index.ts')];
    const issues = await check('/proj', files);
    const issue = issues.find((i) => i.id === 'missing-test-framework');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.category).toBe('testing');
    expect(issue!.fixAvailable).toBe(true);
    expect(issue!.fixId).toBe('add-tests');
  });

  it('does not flag when vitest is in devDependencies', async () => {
    mockPackageJson({ devDependencies: { vitest: '^2.0.0' } });
    const files = [makeFile('src/index.ts'), makeFile('src/index.test.ts')];
    const issues = await check('/proj', files);
    expect(issues.find((i) => i.id === 'missing-test-framework')).toBeUndefined();
  });

  it('detects each supported framework', async () => {
    for (const fw of ['jest', 'mocha', 'ava', 'tap', 'jasmine', '@playwright/test', 'cypress']) {
      mockPackageJson({ devDependencies: { [fw]: '*' } });
      const issues = await check('/proj', [makeFile('src/a.ts'), makeFile('src/a.test.ts')]);
      expect(
        issues.find((i) => i.id === 'missing-test-framework'),
        `framework ${fw} should be detected`,
      ).toBeUndefined();
    }
  });

  it('flags no-test-files when framework exists but no test files do', async () => {
    mockPackageJson({ devDependencies: { vitest: '^2.0.0' } });
    const files = [makeFile('src/index.ts'), makeFile('src/lib.ts')];
    const issues = await check('/proj', files);
    const issue = issues.find((i) => i.id === 'no-test-files');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
    expect(issue!.fixAvailable).toBe(false);
  });

  it('recognises .spec. and __tests__ patterns as test files', async () => {
    mockPackageJson({ devDependencies: { vitest: '*' } });
    const withSpec = await check('/proj', [makeFile('src/a.ts'), makeFile('src/a.spec.ts')]);
    const withDir = await check('/proj', [makeFile('src/a.ts'), makeFile('__tests__/a.ts')]);
    expect(withSpec.find((i) => i.id === 'no-test-files')).toBeUndefined();
    expect(withDir.find((i) => i.id === 'no-test-files')).toBeUndefined();
  });

  it('treats missing package.json as missing framework', async () => {
    mockPackageJson(null);
    const files = [makeFile('src/index.ts')];
    const issues = await check('/proj', files);
    expect(issues.find((i) => i.id === 'missing-test-framework')).toBeDefined();
  });
});
