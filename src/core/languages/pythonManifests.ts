import type { FileEntry } from '../../types.js';
import { parsePythonLockfile, readPythonLockfiles } from './pythonLockfiles.js';
import { readPyprojectEvidence } from './pythonPyprojectEvidence.js';
import { hasPythonProjectEvidence } from './pythonProjectEvidence.js';
import type { PythonDeclaredDep, PythonLockedDep, PythonProjectInfo } from './pythonProjectTypes.js';
import { readRootRequirementEvidence } from './pythonRequirements.js';
import { inferRootsFromInitFiles } from './pythonRoots.js';
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

  const pyprojectEvidence = await readPyprojectEvidence(rootPath);
  manifestFiles.push(...pyprojectEvidence.manifestFiles);
  declared.push(...pyprojectEvidence.declared);
  roots.push(...pyprojectEvidence.roots);

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
  const lockfiles = await readPythonLockfiles(rootPath);
  const hasLockfile = lockfiles.length > 0 || locked.length > 0;
  const lockfileDeps = lockfiles.flatMap((lockfile) =>
    parsePythonLockfile(lockfile.name, lockfile.content),
  );
  locked.unshift(...lockfileDeps);

  return {
    packageRoots: dedupe(roots),
    manifestFiles,
    declared,
    locked,
    hasLockfile,
  };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr)];
}
