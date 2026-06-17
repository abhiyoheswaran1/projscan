import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildCodeGraph } from '../../../src/core/codeGraph.js';
import { inspectFile } from '../../../src/core/fileInspector.js';
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

async function inspectRepoSourceFile(rel: string) {
  const root = process.cwd();
  const absolutePath = path.join(root, rel);
  const stat = await fs.stat(absolutePath);
  const file: FileEntry = {
    relativePath: rel,
    absolutePath,
    extension: path.extname(rel).toLowerCase(),
    sizeBytes: stat.size,
    directory: path.posix.dirname(rel),
  };
  const graph = await buildCodeGraph(root, [file]);
  return inspectFile(root, rel, { scan: { files: [file] }, issues: [], graph });
}

describe('python manifest maintainability', () => {
  it('keeps lockfile parsers out of the manifest detector module', async () => {
    const manifestSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonManifests.ts'),
      'utf8',
    );
    expect(manifestSource).not.toContain('function parseTomlPackageLock');
    expect(manifestSource).not.toContain('function parsePipfileLock');

    const lockfileSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonLockfiles.ts'),
      'utf8',
    );
    expect(lockfileSource).not.toContain("from './pythonManifests.js'");

    const lockfileInspection = await inspectRepoSourceFile('src/core/languages/pythonLockfiles.ts');
    const parsePythonLockfile = lockfileInspection.functions?.find(
      (fn) => fn.name === 'parsePythonLockfile',
    );

    expect(parsePythonLockfile).toBeDefined();
    expect(parsePythonLockfile!.cyclomaticComplexity).toBeLessThanOrEqual(6);
  });

  it('keeps Python project evidence gating out of the manifest parser', async () => {
    const manifestSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonManifests.ts'),
      'utf8',
    );
    expect(manifestSource).not.toContain('ROOT_PYTHON_MANIFEST_NAMES');
    expect(manifestSource).not.toContain('function isRootPythonManifestFile');
    expect(manifestSource).not.toContain('function hasPythonProjectEvidence');

    const evidenceSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonProjectEvidence.ts'),
      'utf8',
    );
    expect(evidenceSource).not.toContain("from './pythonManifests.js'");

    const evidenceInspection = await inspectRepoSourceFile(
      'src/core/languages/pythonProjectEvidence.ts',
    );
    const hasPythonProjectEvidence = evidenceInspection.functions?.find(
      (fn) => fn.name === 'hasPythonProjectEvidence',
    );

    expect(hasPythonProjectEvidence).toBeDefined();
    expect(hasPythonProjectEvidence!.cyclomaticComplexity).toBeLessThanOrEqual(4);
  });

  it('keeps root requirements evidence reading out of the manifest detector', async () => {
    const manifestSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonManifests.ts'),
      'utf8',
    );
    expect(manifestSource).not.toContain('REQUIREMENTS_FILE_RE');
    expect(manifestSource).not.toContain('CONSTRAINTS_FILE_RE');
    expect(manifestSource).not.toContain('function parseRequirements');
    expect(manifestSource).not.toContain('function requirementPinToLockedDep');

    const requirementSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonRequirements.ts'),
      'utf8',
    );
    expect(requirementSource).not.toContain("from './pythonManifests.js'");

    const manifestInspection = await inspectRepoSourceFile('src/core/languages/pythonManifests.ts');
    const detectPythonProject = manifestInspection.functions?.find(
      (fn) => fn.name === 'detectPythonProject',
    );
    expect(detectPythonProject).toBeDefined();
    expect(detectPythonProject!.cyclomaticComplexity).toBeLessThanOrEqual(10);
  });

  it('keeps Python package root inference out of the manifest parser', async () => {
    const manifestSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonManifests.ts'),
      'utf8',
    );
    expect(manifestSource).not.toContain('function extractPyprojectRoots');
    expect(manifestSource).not.toContain('function inferRootsFromInitFiles');
    expect(manifestSource).not.toContain('function extractStringList');

    const rootsSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonRoots.ts'),
      'utf8',
    );
    expect(rootsSource).not.toContain("from './pythonManifests.js'");

    const manifestInspection = await inspectRepoSourceFile('src/core/languages/pythonManifests.ts');
    expect(manifestInspection.cyclomaticComplexity).toBeLessThanOrEqual(60);

    const rootsInspection = await inspectRepoSourceFile('src/core/languages/pythonRoots.ts');
    const inferRootsFromInitFiles = rootsInspection.functions?.find(
      (fn) => fn.name === 'inferRootsFromInitFiles',
    );
    expect(inferRootsFromInitFiles).toBeDefined();
    expect(inferRootsFromInitFiles!.cyclomaticComplexity).toBeLessThanOrEqual(6);
  });

  it('keeps pyproject dependency parsing out of the manifest detector', async () => {
    const manifestSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonManifests.ts'),
      'utf8',
    );
    expect(manifestSource).not.toContain('export function parsePyproject');
    expect(manifestSource).not.toContain('function appendDependencyGroups');
    expect(manifestSource).not.toContain('function parsePoetryKv');

    const pyprojectSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonPyproject.ts'),
      'utf8',
    );
    expect(pyprojectSource).not.toContain("from './pythonManifests.js'");

    const manifestInspection = await inspectRepoSourceFile('src/core/languages/pythonManifests.ts');
    expect(manifestInspection.cyclomaticComplexity).toBeLessThanOrEqual(40);

    const pyprojectInspection = await inspectRepoSourceFile(
      'src/core/languages/pythonPyproject.ts',
    );
    const parsePyproject = pyprojectInspection.functions?.find(
      (fn) => fn.name === 'parsePyproject',
    );
    expect(parsePyproject).toBeDefined();
    expect(parsePyproject!.cyclomaticComplexity).toBeLessThanOrEqual(10);
  });

  it('keeps setuptools manifest parsing out of the manifest detector', async () => {
    const manifestSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonManifests.ts'),
      'utf8',
    );
    expect(manifestSource).not.toContain('function parseSetupCfg');
    expect(manifestSource).not.toContain('function parseSetupPyInstallRequires');
    expect(manifestSource).not.toContain('install_requires');

    const setuptoolsSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonSetuptools.ts'),
      'utf8',
    );
    expect(setuptoolsSource).not.toContain("from './pythonManifests.js'");

    const setuptoolsInspection = await inspectRepoSourceFile(
      'src/core/languages/pythonSetuptools.ts',
    );
    const readSetuptoolsEvidence = setuptoolsInspection.functions?.find(
      (fn) => fn.name === 'readSetuptoolsEvidence',
    );
    const parseSetupCfg = setuptoolsInspection.functions?.find((fn) => fn.name === 'parseSetupCfg');
    const parseSetupPy = setuptoolsInspection.functions?.find(
      (fn) => fn.name === 'parseSetupPyInstallRequires',
    );

    expect(readSetuptoolsEvidence).toBeDefined();
    expect(readSetuptoolsEvidence!.cyclomaticComplexity).toBeLessThanOrEqual(5);
    expect(parseSetupCfg).toBeDefined();
    expect(parseSetupCfg!.cyclomaticComplexity).toBeLessThanOrEqual(5);
    expect(parseSetupPy).toBeDefined();
    expect(parseSetupPy!.cyclomaticComplexity).toBeLessThanOrEqual(3);
  });
});

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

  it('reads legacy poetry dev-dependencies as dev scope', () => {
    const toml = [
      '[tool.poetry.dependencies]',
      'requests = "^2"',
      '[tool.poetry.dev-dependencies]',
      'pytest = "^7"',
      'ruff = "^0.4"',
    ].join('\n');

    const deps = parsePyproject(toml);
    const scopes = Object.fromEntries(deps.map((d) => [d.name, d.scope]));

    expect(scopes).toMatchObject({
      requests: 'main',
      pytest: 'dev',
      ruff: 'dev',
    });
  });

  it('reads PEP 735 dependency groups as dev scope without include-group entries', () => {
    const toml = [
      '[dependency-groups]',
      'dev = ["pytest>=8", "ruff"]',
      'docs = [',
      '  "sphinx>=8",',
      '  { include-group = "dev" },',
      ']',
    ].join('\n');

    const deps = parsePyproject(toml);

    expect(deps.map((d) => d.name).sort()).toEqual(['pytest', 'ruff', 'sphinx']);
    expect(deps.every((d) => d.scope === 'dev')).toBe(true);
    expect(deps.find((d) => d.name === 'pytest')?.versionSpec).toBe('>=8');
    expect(deps.find((d) => d.name === 'sphinx')?.versionSpec).toBe('>=8');
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
