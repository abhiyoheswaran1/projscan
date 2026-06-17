import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { detectPythonProject } from '../../../src/core/languages/pythonManifests.js';
import type { FileEntry } from '../../../src/types.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-pymanifest-'));
}

function fileEntry(rel: string, dir = '.'): FileEntry {
  return {
    relativePath: rel,
    absolutePath: `/${rel}`,
    extension: path.extname(rel),
    sizeBytes: 100,
    directory: dir,
  };
}

describe('detectPythonProject', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns null when no Python files are present', async () => {
    const info = await detectPythonProject(tmp, [fileEntry('src/index.ts', 'src')]);
    expect(info).toBeNull();
  });

  it('falls back to repo root when no manifests and no __init__.py', async () => {
    const info = await detectPythonProject(tmp, [fileEntry('a.py')]);
    expect(info?.packageRoots).toEqual(['.']);
    expect(info?.manifestFiles).toEqual([]);
  });

  it('infers package roots from __init__.py files', async () => {
    const files: FileEntry[] = [
      fileEntry('src/mypkg/__init__.py', 'src/mypkg'),
      fileEntry('src/mypkg/core.py', 'src/mypkg'),
      fileEntry('src/mypkg/sub/__init__.py', 'src/mypkg/sub'),
    ];
    const info = await detectPythonProject(tmp, files);
    expect(info?.packageRoots).toEqual(['src']);
  });

  it('reads setuptools find.where', async () => {
    await fs.writeFile(
      path.join(tmp, 'pyproject.toml'),
      ['[tool.setuptools.packages.find]', 'where = ["src"]'].join('\n'),
    );
    const info = await detectPythonProject(tmp, [fileEntry('src/x.py', 'src')]);
    expect(info?.packageRoots).toContain('src');
    expect(info?.manifestFiles).toContain('pyproject.toml');
  });

  it('detects poetry.lock as lockfile', async () => {
    await fs.writeFile(
      path.join(tmp, 'poetry.lock'),
      ['[[package]]', 'name = "requests"', 'version = "2.31.0"'].join('\n'),
    );
    await fs.writeFile(
      path.join(tmp, 'pyproject.toml'),
      '[tool.poetry.dependencies]\nrequests = "^2"\n',
    );
    const info = await detectPythonProject(tmp, [fileEntry('a.py')]);
    expect(info?.hasLockfile).toBe(true);
    expect(info?.locked).toEqual([
      { name: 'requests', version: '2.31.0', source: 'poetry.lock', line: 3 },
    ]);
  });

  it('uses Pipfile.lock exact versions as lockfile evidence', async () => {
    await fs.writeFile(
      path.join(tmp, 'Pipfile.lock'),
      JSON.stringify({ default: { requests: { version: '==2.31.0' } } }),
    );
    await fs.writeFile(path.join(tmp, 'requirements.txt'), 'requests>=2\n');
    const info = await detectPythonProject(tmp, [
      fileEntry('a.py'),
      fileEntry('requirements.txt'),
      fileEntry('Pipfile.lock'),
    ]);
    expect(info?.hasLockfile).toBe(true);
    expect(info?.locked).toEqual([
      { name: 'requests', version: '2.31.0', source: 'Pipfile.lock', line: 0 },
    ]);
  });

  it('uses uv.lock package versions as lockfile evidence', async () => {
    await fs.writeFile(
      path.join(tmp, 'uv.lock'),
      ['[[package]]', 'name = "requests"', 'version = "2.31.0"'].join('\n'),
    );
    await fs.writeFile(path.join(tmp, 'requirements.txt'), 'requests>=2\n');
    const info = await detectPythonProject(tmp, [
      fileEntry('a.py'),
      fileEntry('requirements.txt'),
      fileEntry('uv.lock'),
    ]);
    expect(info?.hasLockfile).toBe(true);
    expect(info?.locked).toEqual([
      { name: 'requests', version: '2.31.0', source: 'uv.lock', line: 3 },
    ]);
  });

  it('uses pdm.lock package versions as lockfile evidence', async () => {
    await fs.writeFile(
      path.join(tmp, 'pdm.lock'),
      ['[[package]]', 'name = "requests"', 'version = "2.31.0"'].join('\n'),
    );
    await fs.writeFile(path.join(tmp, 'requirements.txt'), 'requests>=2\n');
    const info = await detectPythonProject(tmp, [
      fileEntry('a.py'),
      fileEntry('requirements.txt'),
      fileEntry('pdm.lock'),
    ]);
    expect(info?.hasLockfile).toBe(true);
    expect(info?.locked).toEqual([
      { name: 'requests', version: '2.31.0', source: 'pdm.lock', line: 3 },
    ]);
  });

  it('uses conda-lock package versions as lockfile evidence', async () => {
    await fs.writeFile(
      path.join(tmp, 'conda-lock.yaml'),
      ['package:', '  - name: requests', '    version: "2.31.0"'].join('\n'),
    );
    await fs.writeFile(path.join(tmp, 'requirements.txt'), 'requests>=2\n');
    const info = await detectPythonProject(tmp, [
      fileEntry('a.py'),
      fileEntry('requirements.txt'),
      fileEntry('conda-lock.yaml'),
    ]);
    expect(info?.hasLockfile).toBe(true);
    expect(info?.locked).toEqual([
      { name: 'requests', version: '2.31.0', source: 'conda-lock.yaml', line: 3 },
    ]);
  });

  it('treats requirements.txt with == pins as a lockfile', async () => {
    await fs.writeFile(path.join(tmp, 'requirements.txt'), 'requests==2.31.0\n');
    const info = await detectPythonProject(tmp, [fileEntry('a.py'), fileEntry('requirements.txt')]);
    expect(info?.hasLockfile).toBe(true);
    expect(info?.locked).toEqual([
      { name: 'requests', version: '2.31.0', source: 'requirements.txt', line: 1 },
    ]);
  });

  it('uses constraints.txt pins as lockfile evidence without declaring dependencies', async () => {
    await fs.writeFile(path.join(tmp, 'constraints.txt'), 'requests==2.31.0\nflask>=3\n');
    const info = await detectPythonProject(tmp, [fileEntry('a.py'), fileEntry('constraints.txt')]);

    expect(info?.hasLockfile).toBe(true);
    expect(info?.declared).toEqual([]);
    expect(info?.locked).toEqual([
      { name: 'requests', version: '2.31.0', source: 'constraints.txt', line: 1 },
    ]);
  });

  it('no lockfile when requirements are unpinned', async () => {
    await fs.writeFile(path.join(tmp, 'requirements.txt'), 'requests\nflask>=2\n');
    const info = await detectPythonProject(tmp, [fileEntry('a.py'), fileEntry('requirements.txt')]);
    expect(info?.hasLockfile).toBe(false);
  });

  it('reads dev-requirements as dev scope', async () => {
    await fs.writeFile(path.join(tmp, 'requirements.txt'), 'requests\n');
    await fs.writeFile(path.join(tmp, 'requirements-dev.txt'), 'pytest\nblack\n');
    const info = await detectPythonProject(tmp, [
      fileEntry('a.py'),
      fileEntry('requirements.txt'),
      fileEntry('requirements-dev.txt'),
    ]);
    const scopes = Object.fromEntries(info!.declared.map((d) => [d.name, d.scope]));
    expect(scopes['requests']).toBe('main');
    expect(scopes['pytest']).toBe('dev');
    expect(scopes['black']).toBe('dev');
  });
});
