import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { check } from '../../src/analyzers/pythonTestCheck.js';
import type { FileEntry } from '../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-pytest-'));
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

describe('pythonTestCheck', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns no issues when there are no Python files', async () => {
    const files = [await writeFile(tmp, 'src/index.ts', 'export {}')];
    const issues = await check(tmp, files);
    expect(issues).toEqual([]);
  });

  it('flags missing framework when Python exists but no pytest/unittest is declared', async () => {
    const files = [await writeFile(tmp, 'pkg/mod.py', 'x = 1')];
    const issues = await check(tmp, files);
    const issue = issues.find((i) => i.id === 'missing-python-test-framework');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('warning');
    expect(issue!.category).toBe('testing');
  });

  it('recognises pytest in pyproject.toml dependencies', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'pyproject.toml', '[project]\ndependencies = ["pytest>=7"]\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'missing-python-test-framework')).toBeUndefined();
  });

  it('recognises pytest in requirements.txt', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'requirements.txt', 'pytest==7.4.0\nrequests\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'missing-python-test-framework')).toBeUndefined();
  });

  it('recognises [tool.pytest.ini_options] in pyproject.toml', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'pyproject.toml', '[tool.pytest.ini_options]\ntestpaths = ["tests"]\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'missing-python-test-framework')).toBeUndefined();
  });

  it('recognises a pytest.ini file', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'pytest.ini', '[pytest]\ntestpaths = tests\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'missing-python-test-framework')).toBeUndefined();
  });

  it('recognises pytest configuration in tox.ini', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'tox.ini', '[testenv]\ncommands = pytest\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'missing-python-test-framework')).toBeUndefined();
  });

  it('detects stdlib unittest via import in a pytest-named test file', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'tests/test_foo.py', 'import unittest\n\nclass T(unittest.TestCase): pass\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'missing-python-test-framework')).toBeUndefined();
  });

  it('emits no-python-test-files when framework is present but no test files exist', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'pyproject.toml', '[project]\ndependencies = ["pytest"]\n'),
    ];
    const issues = await check(tmp, files);
    const issue = issues.find((i) => i.id === 'no-python-test-files');
    expect(issue).toBeDefined();
    expect(issue!.severity).toBe('info');
  });
});
