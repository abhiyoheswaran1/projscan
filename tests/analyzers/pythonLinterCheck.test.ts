import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { check } from '../../src/analyzers/pythonLinterCheck.js';
import type { FileEntry } from '../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-pylint-'));
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

describe('pythonLinterCheck', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns no issues when no .py files exist', async () => {
    const files = [await writeFile(tmp, 'src/index.ts', '')];
    const issues = await check(tmp, files);
    expect(issues).toEqual([]);
  });

  it('flags both missing linter and missing formatter on a plain Python repo', async () => {
    const files = [await writeFile(tmp, 'pkg/mod.py', 'x = 1')];
    const issues = await check(tmp, files);
    expect(issues.map((i) => i.id).sort()).toEqual([
      'missing-python-formatter',
      'missing-python-linter',
    ]);
  });

  it.each(['ruff.toml', '.ruff.toml', '.flake8', '.pylintrc'])(
    'accepts %s as a linter config',
    async (configFile) => {
      const files = [
        await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
        await writeFile(tmp, configFile, ''),
      ];
      const issues = await check(tmp, files);
      expect(issues.find((i) => i.id === 'missing-python-linter')).toBeUndefined();
    },
  );

  it('accepts [tool.ruff] in pyproject.toml', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'pyproject.toml', '[tool.ruff]\nline-length = 100\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'missing-python-linter')).toBeUndefined();
    // ruff also satisfies formatter
    expect(issues.find((i) => i.id === 'missing-python-formatter')).toBeUndefined();
  });

  it('accepts [tool.black] for the formatter', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'pyproject.toml', '[tool.ruff]\n\n[tool.black]\nline-length = 100\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'missing-python-formatter')).toBeUndefined();
  });

  it('accepts black in requirements.txt as formatter', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'pyproject.toml', '[tool.ruff]\n'), // satisfies linter
      await writeFile(tmp, 'requirements.txt', 'black==23.12.0\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'missing-python-formatter')).toBeUndefined();
  });

  it('accepts flake8 in setup.cfg as linter', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'setup.cfg', '[flake8]\nmax-line-length = 120\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'missing-python-linter')).toBeUndefined();
  });

  it('accepts pylint in pyproject.toml', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'pyproject.toml', '[tool.pylint.messages_control]\nmax-line-length = 120\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'missing-python-linter')).toBeUndefined();
  });

  it('both linter and formatter recognised via pyproject.toml means no issues', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'pyproject.toml', '[tool.ruff]\n\n[tool.black]\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues).toEqual([]);
  });

  it('flags formatter alone when only linter is configured', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, '.flake8', '[flake8]\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.map((i) => i.id)).toEqual(['missing-python-formatter']);
  });

  it('missing-python-linter has severity warning, category linting', async () => {
    const files = [await writeFile(tmp, 'pkg/mod.py', 'x = 1')];
    const issues = await check(tmp, files);
    const linter = issues.find((i) => i.id === 'missing-python-linter')!;
    const formatter = issues.find((i) => i.id === 'missing-python-formatter')!;
    expect(linter.severity).toBe('warning');
    expect(linter.category).toBe('linting');
    expect(formatter.severity).toBe('warning');
    expect(formatter.category).toBe('formatting');
  });
});
