import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { check } from '../../src/analyzers/pythonDependencyRiskCheck.js';
import type { FileEntry } from '../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-pydeprisk-'));
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

describe('pythonDependencyRiskCheck', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns no issues when there is no Python project', async () => {
    const files = [await writeFile(tmp, 'src/index.ts', '')];
    const issues = await check(tmp, files);
    expect(issues).toEqual([]);
  });

  it('flags deprecated packages as errors', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'requirements.txt', 'nose==1.3.7\nsimplejson==3.19\n'),
      await writeFile(tmp, 'poetry.lock', ''),
    ];
    const issues = await check(tmp, files);
    const nose = issues.find((i) => i.id === 'dep-risk-nose');
    const sj = issues.find((i) => i.id === 'dep-risk-simplejson');
    expect(nose?.severity).toBe('error');
    expect(sj?.severity).toBe('error');
    expect(nose?.locations?.[0]?.file).toBe('requirements.txt');
  });

  it('flags python-dateutil as info (soft deprecation)', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'requirements.txt', 'python-dateutil==2.8.2\n'),
    ];
    const issues = await check(tmp, files);
    const dateutil = issues.find((i) => i.id === 'dep-risk-python-dateutil');
    expect(dateutil?.severity).toBe('info');
  });

  it('flags heavy packages as info', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'requirements.txt', 'pandas==2.0.0\nnumpy==1.26.0\n'),
      await writeFile(tmp, 'poetry.lock', ''),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'dep-risk-pandas')?.severity).toBe('info');
    expect(issues.find((i) => i.id === 'dep-risk-numpy')?.severity).toBe('info');
  });

  it('flags unpinned requirements.txt entries as errors', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'requirements.txt', 'requests\nflask\n'),
    ];
    const issues = await check(tmp, files);
    const requests = issues.find((i) => i.id === 'dep-risk-requests');
    const flask = issues.find((i) => i.id === 'dep-risk-flask');
    expect(requests?.severity).toBe('error');
    expect(flask?.severity).toBe('error');
    expect(requests?.title).toMatch(/Unpinned/);
  });

  it('does not flag pyproject-declared deps as unpinned', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'pyproject.toml', '[project]\ndependencies = ["requests"]\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'dep-risk-requests')).toBeUndefined();
  });

  it('emits no-lockfile warning when deps are declared without a lockfile', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'pyproject.toml', '[project]\ndependencies = ["requests>=2"]\n'),
    ];
    const issues = await check(tmp, files);
    const nolock = issues.find((i) => i.id === 'dep-risk-no-python-lockfile');
    expect(nolock?.severity).toBe('warning');
  });

  it('accepts pinned requirements.txt as a lockfile proxy', async () => {
    const files = [
      await writeFile(tmp, 'pkg/mod.py', 'x = 1'),
      await writeFile(tmp, 'requirements.txt', 'requests==2.31.0\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'dep-risk-no-python-lockfile')).toBeUndefined();
  });

  it('returns empty list when no declared deps and no .py files imports only', async () => {
    // Edge case: Python files present but no manifest. detectPythonProject
    // still returns info (with empty declared), so only the no-lockfile rule
    // could fire - and it shouldn't since declared.length === 0.
    const files = [await writeFile(tmp, 'pkg/mod.py', 'x = 1')];
    const issues = await check(tmp, files);
    expect(issues).toEqual([]);
  });
});
