import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { check } from '../../src/analyzers/pythonUnusedDependencyCheck.js';
import type { FileEntry } from '../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-pyunused-'));
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

describe('pythonUnusedDependencyCheck', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns no issues when no Python project exists', async () => {
    const files = [await writeFile(tmp, 'src/index.ts', '')];
    const issues = await check(tmp, files);
    expect(issues).toEqual([]);
  });

  it('returns no issues when there are no declared deps', async () => {
    const files = [await writeFile(tmp, 'pkg/mod.py', 'x = 1')];
    const issues = await check(tmp, files);
    expect(issues).toEqual([]);
  });

  it('flags declared but unimported package', async () => {
    const files = [
      await writeFile(tmp, 'pkg/__init__.py', ''),
      await writeFile(tmp, 'pkg/mod.py', 'import requests\n'),
      await writeFile(
        tmp,
        'requirements.txt',
        'requests==2.31\nunused-pkg==1.0\n',
      ),
    ];
    const issues = await check(tmp, files);
    const unused = issues.find((i) => i.id === 'unused-python-dependency-unused-pkg');
    expect(unused).toBeDefined();
    expect(unused?.severity).toBe('warning');
    expect(issues.find((i) => i.id === 'unused-python-dependency-requests')).toBeUndefined();
  });

  it('recognises `from x import y` as using x', async () => {
    const files = [
      await writeFile(tmp, 'pkg/__init__.py', ''),
      await writeFile(tmp, 'pkg/mod.py', 'from requests.auth import HTTPBasicAuth\n'),
      await writeFile(tmp, 'requirements.txt', 'requests==2.31\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id === 'unused-python-dependency-requests')).toBeUndefined();
  });

  it('allowlists pytest / ruff / black / other tooling', async () => {
    const files = [
      await writeFile(tmp, 'pkg/__init__.py', ''),
      await writeFile(tmp, 'pkg/mod.py', 'x = 1\n'),
      await writeFile(
        tmp,
        'requirements.txt',
        'pytest==7\nruff==0.1\nblack==23.12\nmypy==1.0\n',
      ),
    ];
    const issues = await check(tmp, files);
    expect(issues).toEqual([]);
  });

  it('normalises PEP 503 name differences (underscore vs hyphen)', async () => {
    const files = [
      await writeFile(tmp, 'pkg/__init__.py', ''),
      // Declared as `my_pkg`, used as `import my_pkg` - both should normalise to
      // the same name.
      await writeFile(tmp, 'pkg/mod.py', 'import my_pkg\n'),
      await writeFile(tmp, 'requirements.txt', 'my-pkg==1.0\n'),
    ];
    const issues = await check(tmp, files);
    expect(issues.find((i) => i.id?.includes('my-pkg'))).toBeUndefined();
  });

  it('uses info severity for dev-scope unused deps', async () => {
    const files = [
      await writeFile(tmp, 'pkg/__init__.py', ''),
      await writeFile(tmp, 'pkg/mod.py', 'import requests\n'),
      await writeFile(tmp, 'requirements.txt', 'requests==2.31\n'),
      await writeFile(tmp, 'requirements-dev.txt', 'stale-dev-tool==1.0\n'),
    ];
    const issues = await check(tmp, files);
    const unused = issues.find((i) => i.id === 'unused-python-dependency-stale-dev-tool');
    expect(unused?.severity).toBe('info');
  });
});
