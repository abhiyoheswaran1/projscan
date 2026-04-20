import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { check } from '../../src/analyzers/unusedDependencyCheck.js';
import type { FileEntry } from '../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-unused-'));
}

async function writeFile(root: string, rel: string, content: string): Promise<FileEntry> {
  const abs = path.join(root, rel);
  await fs.mkdir(path.dirname(abs), { recursive: true });
  await fs.writeFile(abs, content);
  const stat = await fs.stat(abs);
  return {
    relativePath: rel.split(path.sep).join('/'),
    absolutePath: abs,
    extension: path.extname(rel).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.dirname(rel) || '.',
  };
}

describe('unusedDependencyCheck', () => {
  let tmp: string;

  beforeEach(async () => {
    tmp = await makeTempDir();
  });

  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('flags dependencies that are never imported', async () => {
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        dependencies: { 'used-pkg': '^1.0.0', 'never-imported': '^1.0.0' },
      }),
    );
    const files = [await writeFile(tmp, 'src/index.ts', "import used from 'used-pkg';")];

    const issues = await check(tmp, files);
    const ids = issues.map((i) => i.id);
    expect(ids).toContain('unused-dependency-never-imported');
    expect(ids).not.toContain('unused-dependency-used-pkg');
  });

  it('devDependencies report at info severity', async () => {
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        devDependencies: { 'custom-dev': '^1.0.0' },
      }),
    );
    const files = [await writeFile(tmp, 'src/index.ts', '// nothing')];

    const issues = await check(tmp, files);
    const issue = issues.find((i) => i.id === 'unused-dependency-custom-dev');
    expect(issue?.severity).toBe('info');
  });

  it('allowlist skips typical implicit-use packages', async () => {
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        devDependencies: {
          typescript: '^5.0.0',
          '@types/node': '^20.0.0',
          'eslint-plugin-import': '^2.0.0',
          prettier: '^3.0.0',
        },
      }),
    );
    const files = [await writeFile(tmp, 'src/index.ts', '// nothing')];

    const issues = await check(tmp, files);
    expect(issues).toEqual([]);
  });

  it('skips packages used in scripts', async () => {
    await fs.writeFile(
      path.join(tmp, 'package.json'),
      JSON.stringify({
        scripts: { build: 'tsup src/index.ts' },
        devDependencies: { tsup: '^8.0.0' },
      }),
    );
    const files = [await writeFile(tmp, 'src/index.ts', '// nothing')];

    const issues = await check(tmp, files);
    expect(issues).toEqual([]);
  });

  it('emits package.json location with line number', async () => {
    const pkg = [
      '{',
      '  "dependencies": {',
      '    "orphan": "^1.0.0"',
      '  }',
      '}',
      '',
    ].join('\n');
    await fs.writeFile(path.join(tmp, 'package.json'), pkg);
    const files = [await writeFile(tmp, 'src/index.ts', '// nothing')];

    const issues = await check(tmp, files);
    const orphan = issues.find((i) => i.id === 'unused-dependency-orphan');
    expect(orphan?.locations?.[0].file).toBe('package.json');
    expect(orphan?.locations?.[0].line).toBe(3);
  });
});
