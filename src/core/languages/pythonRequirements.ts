import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';
import type { PythonDeclaredDep, PythonLockedDep } from './pythonProjectTypes.js';
import { splitPep508 } from './pythonPep508.js';

const REQUIREMENTS_FILE_RE = /^requirements(-.*)?\.txt$/i;
const CONSTRAINTS_FILE_RE = /^constraints(-.*)?\.txt$/i;

export interface PythonRequirementEvidence {
  manifestFiles: string[];
  declared: PythonDeclaredDep[];
  locked: PythonLockedDep[];
}

export async function readRootRequirementEvidence(
  rootPath: string,
  files: FileEntry[],
): Promise<PythonRequirementEvidence> {
  const evidence: PythonRequirementEvidence = {
    manifestFiles: [],
    declared: [],
    locked: [],
  };

  await appendRootRequirements(evidence, rootPath, files);
  await appendRootConstraints(evidence, rootPath, files);

  return evidence;
}

async function appendRootRequirements(
  evidence: PythonRequirementEvidence,
  rootPath: string,
  files: FileEntry[],
): Promise<void> {
  for (const rel of rootRequirementFiles(files)) {
    const content = await tryRead(path.join(rootPath, rel));
    if (content === null) continue;
    evidence.manifestFiles.push(rel);
    const isDev = /requirements(-test|-dev|-lint)\.txt$/i.test(rel);
    const deps = parseRequirements(content, rel, isDev ? 'dev' : 'main');
    evidence.declared.push(...deps);
    evidence.locked.push(...deps.flatMap(requirementPinToLockedDep));
  }
}

async function appendRootConstraints(
  evidence: PythonRequirementEvidence,
  rootPath: string,
  files: FileEntry[],
): Promise<void> {
  for (const rel of rootConstraintFiles(files)) {
    const content = await tryRead(path.join(rootPath, rel));
    if (content === null) continue;
    const deps = parseRequirements(content, rel, 'main');
    evidence.locked.push(...deps.flatMap(requirementPinToLockedDep));
  }
}

function rootRequirementFiles(files: FileEntry[]): string[] {
  return files.filter(isRootRequirementsFile).map((file) => file.relativePath);
}

function rootConstraintFiles(files: FileEntry[]): string[] {
  return files.filter(isRootConstraintsFile).map((file) => file.relativePath);
}

function isRootRequirementsFile(file: FileEntry): boolean {
  return isRootFile(file) && REQUIREMENTS_FILE_RE.test(path.basename(file.relativePath));
}

function isRootConstraintsFile(file: FileEntry): boolean {
  return isRootFile(file) && CONSTRAINTS_FILE_RE.test(path.basename(file.relativePath));
}

function isRootFile(file: FileEntry): boolean {
  return !file.directory || file.directory === '.';
}

async function tryRead(absolutePath: string): Promise<string | null> {
  try {
    return await fs.readFile(absolutePath, 'utf-8');
  } catch {
    return null;
  }
}

export function parseRequirements(
  content: string,
  sourceFile: string,
  scope: 'main' | 'dev',
): PythonDeclaredDep[] {
  const out: PythonDeclaredDep[] = [];
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const stripped = raw.replace(/\s+#.*$/, '').trim();
    if (!stripped || stripped.startsWith('#')) continue;
    if (stripped.startsWith('-')) continue; // -r, -e, -c, etc.
    const { name, versionSpec } = splitPep508(stripped);
    if (!name) continue;
    out.push({ name, versionSpec, source: sourceFile, line: i + 1, scope });
  }
  return out;
}

function exactVersionFromSpec(version: string): string | null {
  return /^={2,3}\s*([^\s,;]+)/.exec(version)?.[1] ?? null;
}

function requirementPinToLockedDep(dep: PythonDeclaredDep): PythonLockedDep[] {
  const version = exactVersionFromSpec(dep.versionSpec);
  if (!version) return [];
  return [{ name: dep.name, version, source: dep.source, line: dep.line }];
}
