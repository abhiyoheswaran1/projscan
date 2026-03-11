import { describe, it, expect, vi, beforeEach } from 'vitest';
import { check as eslintCheck } from '../../src/analyzers/eslintCheck.js';
import { check as prettierCheck } from '../../src/analyzers/prettierCheck.js';
import { check as testCheck } from '../../src/analyzers/testCheck.js';
import { check as architectureCheck } from '../../src/analyzers/architectureCheck.js';
import type { FileEntry } from '../../src/types.js';
import fs from 'node:fs/promises';

vi.mock('node:fs/promises');

function makeFile(relativePath: string): FileEntry {
  const ext = relativePath.includes('.') ? relativePath.substring(relativePath.lastIndexOf('.')) : '';
  const dir = relativePath.includes('/') ? relativePath.substring(0, relativePath.lastIndexOf('/')) : '.';
  return {
    relativePath,
    absolutePath: `/proj/${relativePath}`,
    extension: ext,
    sizeBytes: 100,
    directory: dir,
  };
}

describe('eslintCheck', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('should flag missing ESLint config in JS/TS project', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}));
    const files = [makeFile('src/index.ts'), makeFile('package.json')];
    const issues = await eslintCheck('/proj', files);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('missing-eslint');
    expect(issues[0].fixAvailable).toBe(true);
  });

  it('should not flag when .eslintrc.json exists', async () => {
    const files = [makeFile('src/index.ts'), makeFile('.eslintrc.json')];
    const issues = await eslintCheck('/proj', files);
    expect(issues).toHaveLength(0);
  });

  it('should not flag when eslint.config.js exists', async () => {
    const files = [makeFile('src/index.ts'), makeFile('eslint.config.js')];
    const issues = await eslintCheck('/proj', files);
    expect(issues).toHaveLength(0);
  });

  it('should not flag non-JS projects', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    const files = [makeFile('main.py'), makeFile('utils.py')];
    const issues = await eslintCheck('/proj', files);
    expect(issues).toHaveLength(0);
  });
});

describe('prettierCheck', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('should flag missing Prettier config', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({}));
    const files = [makeFile('src/index.ts'), makeFile('package.json')];
    const issues = await prettierCheck('/proj', files);
    expect(issues).toHaveLength(1);
    expect(issues[0].fixId).toBe('add-prettier');
  });

  it('should not flag when .prettierrc exists', async () => {
    const files = [makeFile('src/index.ts'), makeFile('.prettierrc')];
    const issues = await prettierCheck('/proj', files);
    expect(issues).toHaveLength(0);
  });
});

describe('testCheck', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('should flag missing test framework', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify({ dependencies: {} }));
    const files = [makeFile('src/index.ts'), makeFile('package.json')];
    const issues = await testCheck('/proj', files);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('missing-test-framework');
  });

  it('should flag no test files when framework present', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }),
    );
    const files = [makeFile('src/index.ts'), makeFile('package.json')];
    const issues = await testCheck('/proj', files);
    expect(issues).toHaveLength(1);
    expect(issues[0].id).toBe('no-test-files');
  });

  it('should pass when framework and test files exist', async () => {
    vi.mocked(fs.readFile).mockResolvedValue(
      JSON.stringify({ devDependencies: { vitest: '^1.0.0' } }),
    );
    const files = [
      makeFile('src/index.ts'),
      makeFile('tests/index.test.ts'),
      makeFile('package.json'),
    ];
    const issues = await testCheck('/proj', files);
    expect(issues).toHaveLength(0);
  });
});

describe('architectureCheck', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('should flag large utils directory', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    const files: FileEntry[] = [];
    for (let i = 0; i < 15; i++) {
      files.push(makeFile(`src/utils/file${i}.ts`));
    }
    files.push(makeFile('src/index.ts'));

    const issues = await architectureCheck('/proj', files);
    const largeDir = issues.find((i) => i.id.startsWith('large-'));
    expect(largeDir).toBeDefined();
    expect(largeDir!.title).toContain('15 files');
  });

  it('should flag missing .editorconfig', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    const files = [makeFile('src/index.ts')];
    const issues = await architectureCheck('/proj', files);
    const editorconfig = issues.find((i) => i.id === 'missing-editorconfig');
    expect(editorconfig).toBeDefined();
    expect(editorconfig!.fixAvailable).toBe(true);
  });

  it('should flag missing README', async () => {
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT'));
    const files = [makeFile('src/index.ts')];
    const issues = await architectureCheck('/proj', files);
    const readme = issues.find((i) => i.id === 'missing-readme');
    expect(readme).toBeDefined();
  });
});
