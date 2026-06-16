import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  detectPythonProject,
  parseCondaLock,
  parsePdmLock,
  parsePipfileLock,
  parsePoetryLock,
  parsePyproject,
  parseRequirements,
  parseUvLock,
  splitPep508,
} from '../../../src/core/languages/pythonManifests.js';
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

describe('splitPep508', () => {
  it('splits plain name', () => {
    expect(splitPep508('requests')).toEqual({ name: 'requests', versionSpec: '' });
  });

  it('splits name + version', () => {
    expect(splitPep508('requests>=2.25.0')).toEqual({ name: 'requests', versionSpec: '>=2.25.0' });
    expect(splitPep508('django==4.2.1')).toEqual({ name: 'django', versionSpec: '==4.2.1' });
  });

  it('strips extras', () => {
    expect(splitPep508('requests[security,socks]>=2')).toEqual({
      name: 'requests',
      versionSpec: '>=2',
    });
  });

  it('strips environment markers', () => {
    expect(splitPep508('foo; python_version < "3.10"')).toEqual({ name: 'foo', versionSpec: '' });
  });

  it('normalizes case', () => {
    expect(splitPep508('Requests')).toEqual({ name: 'requests', versionSpec: '' });
  });
});

describe('parseRequirements', () => {
  it('reads one package per line', () => {
    const txt = 'requests\nflask==2.0\ndjango>=4\n';
    const out = parseRequirements(txt, 'requirements.txt', 'main');
    expect(out.map((d) => d.name)).toEqual(['requests', 'flask', 'django']);
  });

  it('ignores comments and blank lines', () => {
    const txt = '# comment\n\nrequests\n  # indented comment\nflask==2.0\n';
    const out = parseRequirements(txt, 'requirements.txt', 'main');
    expect(out.map((d) => d.name)).toEqual(['requests', 'flask']);
  });

  it('skips -r / -e / -c directives', () => {
    const txt = '-r other.txt\nrequests\n-e git+https://example.com/x.git#egg=x\n';
    const out = parseRequirements(txt, 'requirements.txt', 'main');
    expect(out.map((d) => d.name)).toEqual(['requests']);
  });

  it('records line numbers', () => {
    const txt = '# c1\nrequests\nflask==2\n';
    const out = parseRequirements(txt, 'r.txt', 'main');
    expect(out.find((d) => d.name === 'requests')?.line).toBe(2);
    expect(out.find((d) => d.name === 'flask')?.line).toBe(3);
  });
});

describe('parsePoetryLock', () => {
  it('reads package versions from poetry.lock package blocks', () => {
    const lock = [
      '[[package]]',
      'name = "requests"',
      'version = "2.31.0"',
      'description = "Python HTTP for Humans."',
      '',
      '[[package]]',
      'name = "Django"',
      'version = "4.2.1"',
    ].join('\n');

    expect(parsePoetryLock(lock, 'poetry.lock')).toEqual([
      { name: 'requests', version: '2.31.0', source: 'poetry.lock', line: 3 },
      { name: 'Django', version: '4.2.1', source: 'poetry.lock', line: 8 },
    ]);
  });
});

describe('parsePipfileLock', () => {
  it('reads exact package versions from default and develop sections', () => {
    const lock = JSON.stringify({
      default: {
        requests: { version: '==2.31.0' },
        flask: { version: '==3.0.0' },
      },
      develop: {
        pytest: { version: '==8.2.0' },
        loose: { version: '>=1.0' },
      },
    });

    expect(parsePipfileLock(lock, 'Pipfile.lock')).toEqual([
      { name: 'requests', version: '2.31.0', source: 'Pipfile.lock', line: 0 },
      { name: 'flask', version: '3.0.0', source: 'Pipfile.lock', line: 0 },
      { name: 'pytest', version: '8.2.0', source: 'Pipfile.lock', line: 0 },
    ]);
  });

  it('returns no locked dependencies for malformed Pipfile.lock JSON', () => {
    expect(parsePipfileLock('{not json', 'Pipfile.lock')).toEqual([]);
  });
});

describe('parseUvLock', () => {
  it('reads package versions from uv.lock package blocks', () => {
    const lock = [
      'version = 1',
      '[[package]]',
      'name = "requests"',
      'version = "2.31.0"',
      'source = { registry = "https://pypi.org/simple" }',
      '[[package]]',
      'name = "Django"',
      'version = "4.2.1"',
    ].join('\n');

    expect(parseUvLock(lock, 'uv.lock')).toEqual([
      { name: 'requests', version: '2.31.0', source: 'uv.lock', line: 4 },
      { name: 'Django', version: '4.2.1', source: 'uv.lock', line: 8 },
    ]);
  });
});

describe('parsePdmLock', () => {
  it('reads package versions from pdm.lock package blocks', () => {
    const lock = [
      '[metadata]',
      'lock_version = "4.5.0"',
      '[[package]]',
      'name = "requests"',
      'version = "2.31.0"',
      '[[package]]',
      'name = "Django"',
      'version = "4.2.1"',
    ].join('\n');

    expect(parsePdmLock(lock, 'pdm.lock')).toEqual([
      { name: 'requests', version: '2.31.0', source: 'pdm.lock', line: 5 },
      { name: 'Django', version: '4.2.1', source: 'pdm.lock', line: 8 },
    ]);
  });
});

describe('parseCondaLock', () => {
  it('reads package versions from conda-lock package entries', () => {
    const lock = [
      'version: 1',
      'metadata:',
      '  platforms:',
      '    - linux-64',
      'package:',
      '  - name: requests',
      '    version: "2.31.0"',
      '    manager: conda',
      '  - manager: pip',
      '    name: charset-normalizer',
      '    version: 3.3.2',
    ].join('\n');

    expect(parseCondaLock(lock, 'conda-lock.yml')).toEqual([
      { name: 'requests', version: '2.31.0', source: 'conda-lock.yml', line: 7 },
      {
        name: 'charset-normalizer',
        version: '3.3.2',
        source: 'conda-lock.yml',
        line: 11,
      },
    ]);
  });
});

describe('parsePyproject (PEP 621)', () => {
  it('reads project.dependencies list', () => {
    const toml = [
      '[project]',
      'name = "myapp"',
      'dependencies = [',
      '  "requests>=2",',
      '  "flask==2.0",',
      ']',
    ].join('\n');
    const deps = parsePyproject(toml);
    expect(deps.map((d) => d.name).sort()).toEqual(['flask', 'requests']);
    expect(deps.every((d) => d.scope === 'main')).toBe(true);
  });

  it('reads project.optional-dependencies as dev scope', () => {
    const toml = [
      '[project]',
      'name = "myapp"',
      '[project.optional-dependencies]',
      'test = ["pytest>=7", "coverage==6.0"]',
    ].join('\n');
    const deps = parsePyproject(toml);
    expect(deps.map((d) => d.name).sort()).toEqual(['coverage', 'pytest']);
    expect(deps.every((d) => d.scope === 'dev')).toBe(true);
  });

  it('reads tool.poetry.dependencies with version strings', () => {
    const toml = [
      '[tool.poetry.dependencies]',
      'python = "^3.10"',
      'requests = "^2.25"',
      'sqlalchemy = { version = "^2.0", optional = true }',
    ].join('\n');
    const deps = parsePyproject(toml);
    expect(deps.map((d) => d.name).sort()).toEqual(['requests', 'sqlalchemy']);
    expect(deps.find((d) => d.name === 'requests')?.versionSpec).toBe('^2.25');
    expect(deps.find((d) => d.name === 'sqlalchemy')?.versionSpec).toBe('^2.0');
  });

  it('reads poetry group deps as dev scope', () => {
    const toml = [
      '[tool.poetry.group.test.dependencies]',
      'pytest = "^7"',
      '[tool.poetry.group.dev.dependencies]',
      'black = "^23"',
    ].join('\n');
    const deps = parsePyproject(toml);
    expect(deps.every((d) => d.scope === 'dev')).toBe(true);
    expect(deps.map((d) => d.name).sort()).toEqual(['black', 'pytest']);
  });
});

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
