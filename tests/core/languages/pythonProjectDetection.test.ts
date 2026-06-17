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

  it('aggregates supported root lockfiles in deterministic order', async () => {
    await fs.writeFile(
      path.join(tmp, 'poetry.lock'),
      ['[[package]]', 'name = "requests"', 'version = "2.31.0"'].join('\n'),
    );
    await fs.writeFile(
      path.join(tmp, 'uv.lock'),
      ['[[package]]', 'name = "httpx"', 'version = "0.27.2"'].join('\n'),
    );
    await fs.writeFile(
      path.join(tmp, 'pyproject.toml'),
      ['[project]', 'dependencies = ["requests>=2", "httpx>=0.27"]'].join('\n'),
    );

    const info = await detectPythonProject(tmp, [
      fileEntry('pyproject.toml'),
      fileEntry('poetry.lock'),
      fileEntry('uv.lock'),
    ]);

    expect(info?.hasLockfile).toBe(true);
    expect(info?.locked).toEqual([
      { name: 'requests', version: '2.31.0', source: 'poetry.lock', line: 3 },
      { name: 'httpx', version: '0.27.2', source: 'uv.lock', line: 3 },
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

  it('reads common nested constraints manifests without a root include', async () => {
    await fs.mkdir(path.join(tmp, 'constraints'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'constraints/base.txt'), 'httpx==0.27.2\n');
    await fs.writeFile(path.join(tmp, 'constraints/dev.txt'), 'pytest==8.2.0\nruff>=0.5\n');

    const info = await detectPythonProject(tmp, [
      fileEntry('constraints/base.txt', 'constraints'),
      fileEntry('constraints/dev.txt', 'constraints'),
    ]);

    expect(info).not.toBeNull();
    expect(info?.declared).toEqual([]);
    expect(info?.locked).toEqual([
      { name: 'httpx', version: '0.27.2', source: 'constraints/base.txt', line: 1 },
      { name: 'pytest', version: '8.2.0', source: 'constraints/dev.txt', line: 1 },
    ]);
    expect(info?.hasLockfile).toBe(true);
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

  it('reads pip-tools requirements inputs as declarations without lockfile evidence', async () => {
    await fs.writeFile(path.join(tmp, 'requirements.in'), 'django==4.2.0\n');
    await fs.writeFile(path.join(tmp, 'dev-requirements.in'), 'pytest\n');
    await fs.writeFile(path.join(tmp, 'test-requirements.in'), 'tox\n');
    await fs.writeFile(path.join(tmp, 'lint-requirements.in'), 'ruff\n');

    const info = await detectPythonProject(tmp, [
      fileEntry('requirements.in'),
      fileEntry('dev-requirements.in'),
      fileEntry('test-requirements.in'),
      fileEntry('lint-requirements.in'),
    ]);

    expect(info).not.toBeNull();
    expect(info?.manifestFiles).toEqual([
      'requirements.in',
      'dev-requirements.in',
      'test-requirements.in',
      'lint-requirements.in',
    ]);
    expect(info?.hasLockfile).toBe(false);
    expect(info?.locked).toEqual([]);
    expect(Object.fromEntries(info!.declared.map((dep) => [dep.name, dep.scope]))).toEqual({
      django: 'main',
      pytest: 'dev',
      tox: 'dev',
      ruff: 'dev',
    });
    expect(info?.declared.find((dep) => dep.name === 'django')?.versionSpec).toBe('==4.2.0');
  });

  it('reads included requirements and included constraints from root requirements files', async () => {
    await fs.mkdir(path.join(tmp, 'requirements'), { recursive: true });
    await fs.mkdir(path.join(tmp, 'constraints'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'requirements.txt'),
      ['-r requirements/base.txt', '-c constraints/prod.txt'].join('\n'),
    );
    await fs.writeFile(path.join(tmp, 'requirements/base.txt'), 'httpx>=0.27\n');
    await fs.writeFile(path.join(tmp, 'constraints/prod.txt'), 'httpx==0.27.2\n');

    const info = await detectPythonProject(tmp, [
      fileEntry('requirements.txt'),
      fileEntry('requirements/base.txt', 'requirements'),
      fileEntry('constraints/prod.txt', 'constraints'),
    ]);

    expect(info).not.toBeNull();
    expect(info?.manifestFiles).toEqual(['requirements.txt', 'requirements/base.txt']);
    expect(info?.declared).toEqual([
      {
        name: 'httpx',
        versionSpec: '>=0.27',
        source: 'requirements/base.txt',
        line: 1,
        scope: 'main',
      },
    ]);
    expect(info?.locked).toEqual([
      { name: 'httpx', version: '0.27.2', source: 'constraints/prod.txt', line: 1 },
    ]);
    expect(info?.hasLockfile).toBe(true);
  });

  it('reads common nested requirements manifests without a root include', async () => {
    await fs.mkdir(path.join(tmp, 'requirements'), { recursive: true });
    await fs.writeFile(path.join(tmp, 'requirements/base.txt'), 'httpx>=0.27\n');
    await fs.writeFile(path.join(tmp, 'requirements/dev.in'), 'pytest>=8\n');

    const info = await detectPythonProject(tmp, [
      fileEntry('requirements/base.txt', 'requirements'),
      fileEntry('requirements/dev.in', 'requirements'),
    ]);

    expect(info).not.toBeNull();
    expect(info?.manifestFiles).toEqual(['requirements/base.txt', 'requirements/dev.in']);
    expect(Object.fromEntries(info!.declared.map((dep) => [dep.name, dep.scope]))).toEqual({
      httpx: 'main',
      pytest: 'dev',
    });
    expect(info?.declared.find((dep) => dep.name === 'httpx')?.versionSpec).toBe('>=0.27');
    expect(info?.declared.find((dep) => dep.name === 'pytest')?.versionSpec).toBe('>=8');
  });

  it('ignores unsafe requirement include paths outside the repo root', async () => {
    await fs.mkdir(path.join(tmp, 'requirements'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'requirements.txt'),
      ['-r requirements/base.txt', '-r ../outside.txt'].join('\n'),
    );
    await fs.writeFile(path.join(tmp, 'requirements/base.txt'), 'requests>=2\n');
    await fs.writeFile(path.join(tmp, '..', 'outside.txt'), 'leaked-package==1.0.0\n');

    const info = await detectPythonProject(tmp, [
      fileEntry('requirements.txt'),
      fileEntry('requirements/base.txt', 'requirements'),
    ]);

    expect(info).not.toBeNull();
    expect(info?.declared.map((dep) => dep.name)).toEqual(['requests']);
    expect(info?.manifestFiles).toEqual(['requirements.txt', 'requirements/base.txt']);
  });

  it('reads prefixed dev requirements as root Python project evidence', async () => {
    await fs.writeFile(path.join(tmp, 'dev-requirements.txt'), 'pytest\n');
    await fs.writeFile(path.join(tmp, 'test-requirements.txt'), 'tox\n');
    await fs.writeFile(path.join(tmp, 'lint-requirements.txt'), 'ruff\n');

    const info = await detectPythonProject(tmp, [
      fileEntry('dev-requirements.txt'),
      fileEntry('test-requirements.txt'),
      fileEntry('lint-requirements.txt'),
    ]);

    expect(info).not.toBeNull();
    expect(info?.packageRoots).toEqual(['.']);
    expect(info?.manifestFiles).toEqual([
      'dev-requirements.txt',
      'test-requirements.txt',
      'lint-requirements.txt',
    ]);
    expect(Object.fromEntries(info!.declared.map((dep) => [dep.name, dep.scope]))).toEqual({
      pytest: 'dev',
      tox: 'dev',
      ruff: 'dev',
    });
  });
});
