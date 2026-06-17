import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';
import { parsePythonLockfile, readPythonLockfile } from './pythonLockfiles.js';
import { parsePyproject } from './pythonPyproject.js';
import { hasPythonProjectEvidence } from './pythonProjectEvidence.js';
import type { PythonDeclaredDep, PythonLockedDep, PythonProjectInfo } from './pythonProjectTypes.js';
import { readRootRequirementEvidence } from './pythonRequirements.js';
import { extractPyprojectRoots, inferRootsFromInitFiles } from './pythonRoots.js';
import { readSetuptoolsEvidence } from './pythonSetuptools.js';

export {
  parseCondaLock,
  parsePdmLock,
  parsePipfileLock,
  parsePoetryLock,
  parseUvLock,
} from './pythonLockfiles.js';
export { splitPep508 } from './pythonPep508.js';
export { parsePyproject } from './pythonPyproject.js';
export { parseRequirements } from './pythonRequirements.js';
export type { PythonDeclaredDep, PythonLockedDep, PythonProjectInfo } from './pythonProjectTypes.js';

/**
 * Lightweight parsing of Python project manifests. We do NOT pull a TOML
 * parser - regex-based extraction is good enough for the 80% case where
 * projects use standard layouts. More sophisticated parsing is deferred.
 */

export async function detectPythonProject(
  rootPath: string,
  files: FileEntry[],
): Promise<PythonProjectInfo | null> {
  if (!hasPythonProjectEvidence(files)) return null;

  const roots: string[] = [];
  const manifestFiles: string[] = [];
  const declared: PythonDeclaredDep[] = [];
  const locked: PythonLockedDep[] = [];

  const pyprojectPath = path.join(rootPath, 'pyproject.toml');
  const pyprojectContent = await tryRead(pyprojectPath);
  if (pyprojectContent !== null) {
    manifestFiles.push('pyproject.toml');
    declared.push(...parsePyproject(pyprojectContent));
    roots.push(...extractPyprojectRoots(pyprojectContent));
  }

  const setuptoolsEvidence = await readSetuptoolsEvidence(rootPath);
  manifestFiles.push(...setuptoolsEvidence.manifestFiles);
  declared.push(...setuptoolsEvidence.declared);

  const requirementEvidence = await readRootRequirementEvidence(rootPath, files);
  manifestFiles.push(...requirementEvidence.manifestFiles);
  declared.push(...requirementEvidence.declared);
  locked.push(...requirementEvidence.locked);

  // Infer package roots from __init__.py placement if none declared.
  if (roots.length === 0) {
    roots.push(...inferRootsFromInitFiles(files));
  }

  // Always fall back to repo root.
  if (roots.length === 0) roots.push('.');

  // Lockfile detection.
  const lockfile = await readPythonLockfile(rootPath);
  const hasLockfile = lockfile !== null || locked.length > 0;
  if (lockfile) locked.unshift(...parsePythonLockfile(lockfile.name, lockfile.content));

  return {
    packageRoots: dedupe(roots),
    manifestFiles,
    declared,
    locked,
    hasLockfile,
  };
}

async function tryRead(absolutePath: string): Promise<string | null> {
  try {
    return await fs.readFile(absolutePath, 'utf-8');
  } catch {
    return null;
  }
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}
