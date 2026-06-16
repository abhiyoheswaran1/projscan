import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';
import { parsePythonLockfile, readPythonLockfile } from './pythonLockfiles.js';
import { extractListValues, offsetToLine } from './pythonManifestText.js';
import { splitPep508 } from './pythonPep508.js';
import { parsePyproject } from './pythonPyproject.js';
import { hasPythonProjectEvidence } from './pythonProjectEvidence.js';
import type { PythonDeclaredDep, PythonLockedDep, PythonProjectInfo } from './pythonProjectTypes.js';
import { readRootRequirementEvidence } from './pythonRequirements.js';
import { extractPyprojectRoots, inferRootsFromInitFiles } from './pythonRoots.js';

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

  const setupCfgContent = await tryRead(path.join(rootPath, 'setup.cfg'));
  if (setupCfgContent !== null) {
    manifestFiles.push('setup.cfg');
    declared.push(...parseSetupCfg(setupCfgContent));
  }

  const setupPyContent = await tryRead(path.join(rootPath, 'setup.py'));
  if (setupPyContent !== null) {
    manifestFiles.push('setup.py');
    declared.push(...parseSetupPyInstallRequires(setupPyContent));
  }

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

// ── setup.py / setup.cfg ──────────────────────────────────────

function parseSetupPyInstallRequires(content: string): PythonDeclaredDep[] {
  const out: PythonDeclaredDep[] = [];
  const m = /install_requires\s*=\s*\[([\s\S]*?)\]/.exec(content);
  if (!m) return out;
  const inside = m[1];
  const baseLine = offsetToLine(content, m.index + m[0].indexOf('['));
  for (const { name, versionSpec, line } of extractListValues(inside, baseLine)) {
    out.push({ name, versionSpec, source: 'setup.py', line, scope: 'main' });
  }
  return out;
}

function parseSetupCfg(content: string): PythonDeclaredDep[] {
  const out: PythonDeclaredDep[] = [];
  const m = /\[options\][\s\S]*?install_requires\s*=\s*([\s\S]*?)(?=\n\[|\n\n|$)/.exec(content);
  if (!m) return out;
  const baseLine = offsetToLine(content, m.index + m[0].indexOf('install_requires'));
  const lines = m[1].split('\n');
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].replace(/#.*$/, '').trim();
    if (!stripped) continue;
    const { name, versionSpec } = splitPep508(stripped);
    if (!name) continue;
    out.push({ name, versionSpec, source: 'setup.cfg', line: baseLine + i + 1, scope: 'main' });
  }
  return out;
}
