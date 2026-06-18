import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { buildCodeGraph } from '../../../src/core/codeGraph.js';
import { inspectFile } from '../../../src/core/fileInspector.js';
import type { FileEntry } from '../../../src/types.js';

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

    const requirementsInspection = await inspectRepoSourceFile(
      'src/core/languages/pythonRequirements.ts',
    );
    for (const name of ['safeRequirementInclude', 'directiveTarget']) {
      const fn = requirementsInspection.functions?.find((candidate) => candidate.name === name);
      expect(fn).toBeDefined();
      expect(fn!.cyclomaticComplexity).toBeLessThanOrEqual(6);
    }
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

  it('keeps pyproject filesystem evidence reading out of the manifest detector', async () => {
    const manifestSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonManifests.ts'),
      'utf8',
    );
    expect(manifestSource).toContain("from './pythonPyprojectEvidence.js'");
    expect(manifestSource).not.toContain("from 'node:fs/promises'");
    expect(manifestSource).not.toContain("from 'node:path'");
    expect(manifestSource).not.toContain('function tryRead');
    expect(manifestSource).not.toContain("path.join(rootPath, 'pyproject.toml')");
    expect(manifestSource).not.toContain('parsePyproject(pyprojectContent)');
    expect(manifestSource).not.toContain('extractPyprojectRoots(pyprojectContent)');

    const pyprojectEvidenceSource = readFileSync(
      path.join(process.cwd(), 'src/core/languages/pythonPyprojectEvidence.ts'),
      'utf8',
    );
    expect(pyprojectEvidenceSource).not.toContain("from './pythonManifests.js'");

    const evidenceInspection = await inspectRepoSourceFile(
      'src/core/languages/pythonPyprojectEvidence.ts',
    );
    const readPyprojectEvidence = evidenceInspection.functions?.find(
      (fn) => fn.name === 'readPyprojectEvidence',
    );
    const tryRead = evidenceInspection.functions?.find((fn) => fn.name === 'tryRead');

    expect(readPyprojectEvidence).toBeDefined();
    expect(readPyprojectEvidence!.cyclomaticComplexity).toBeLessThanOrEqual(3);
    expect(tryRead).toBeDefined();
    expect(tryRead!.cyclomaticComplexity).toBeLessThanOrEqual(2);
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
