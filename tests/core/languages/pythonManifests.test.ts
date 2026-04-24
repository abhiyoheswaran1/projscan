import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  detectPythonProject,
  parsePyproject,
  parseRequirements,
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
    expect(splitPep508('requests[security,socks]>=2')).toEqual({ name: 'requests', versionSpec: '>=2' });
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
    await fs.writeFile(path.join(tmp, 'poetry.lock'), '');
    await fs.writeFile(path.join(tmp, 'pyproject.toml'), '[tool.poetry.dependencies]\nrequests = "^2"\n');
    const info = await detectPythonProject(tmp, [fileEntry('a.py')]);
    expect(info?.hasLockfile).toBe(true);
  });

  it('treats requirements.txt with == pins as a lockfile', async () => {
    await fs.writeFile(path.join(tmp, 'requirements.txt'), 'requests==2.31.0\n');
    const info = await detectPythonProject(tmp, [
      fileEntry('a.py'),
      fileEntry('requirements.txt'),
    ]);
    expect(info?.hasLockfile).toBe(true);
  });

  it('no lockfile when requirements are unpinned', async () => {
    await fs.writeFile(path.join(tmp, 'requirements.txt'), 'requests\nflask>=2\n');
    const info = await detectPythonProject(tmp, [
      fileEntry('a.py'),
      fileEntry('requirements.txt'),
    ]);
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
