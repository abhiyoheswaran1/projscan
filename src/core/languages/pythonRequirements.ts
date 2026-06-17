import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';
import type { PythonDeclaredDep, PythonLockedDep } from './pythonProjectTypes.js';
import { splitPep508 } from './pythonPep508.js';

const REQUIREMENTS_DECLARATION_FILE_RE =
  /^(?:requirements(?:-.*)?|(?:dev|test|lint)-requirements)\.(?:txt|in)$/i;
const REQUIREMENTS_LOCK_FILE_RE = /^(?:requirements(?:-.*)?|(?:dev|test|lint)-requirements)\.txt$/i;
const DEV_REQUIREMENTS_FILE_RE =
  /^(?:requirements-(?:test|dev|lint)|(?:dev|test|lint)-requirements)\.(?:txt|in)$/i;
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
  const context: RequirementReadContext = {
    rootPath,
    fileSet: new Set(files.map((file) => normalizeRel(file.relativePath))),
    seenRequirements: new Set(),
    seenConstraints: new Set(),
  };
  const evidence: PythonRequirementEvidence = {
    manifestFiles: [],
    declared: [],
    locked: [],
  };

  await appendRootRequirements(evidence, context, files);
  await appendRootConstraints(evidence, context, files);

  return evidence;
}

interface RequirementReadContext {
  rootPath: string;
  fileSet: Set<string>;
  seenRequirements: Set<string>;
  seenConstraints: Set<string>;
}

async function appendRootRequirements(
  evidence: PythonRequirementEvidence,
  context: RequirementReadContext,
  files: FileEntry[],
): Promise<void> {
  for (const rel of rootRequirementFiles(files)) {
    const isDev = DEV_REQUIREMENTS_FILE_RE.test(path.basename(rel));
    await appendRequirementFile(evidence, context, rel, isDev ? 'dev' : 'main');
  }
}

async function appendRootConstraints(
  evidence: PythonRequirementEvidence,
  context: RequirementReadContext,
  files: FileEntry[],
): Promise<void> {
  for (const rel of rootConstraintFiles(files)) {
    await appendConstraintFile(evidence, context, rel);
  }
}

async function appendRequirementFile(
  evidence: PythonRequirementEvidence,
  context: RequirementReadContext,
  rel: string,
  scope: 'main' | 'dev',
): Promise<void> {
  const normalized = normalizeRel(rel);
  if (context.seenRequirements.has(normalized)) return;
  context.seenRequirements.add(normalized);

  const content = await readScannedFile(context, normalized);
  if (content === null) return;

  pushUnique(evidence.manifestFiles, normalized);
  const deps = parseRequirements(content, normalized, scope);
  evidence.declared.push(...deps);
  if (isRequirementsLockFile(normalized)) {
    evidence.locked.push(...deps.flatMap(requirementPinToLockedDep));
  }

  for (const include of parseRequirementIncludes(content, normalized)) {
    if (include.kind === 'requirement') {
      await appendRequirementFile(evidence, context, include.relativePath, scope);
    } else {
      await appendConstraintFile(evidence, context, include.relativePath);
    }
  }
}

async function appendConstraintFile(
  evidence: PythonRequirementEvidence,
  context: RequirementReadContext,
  rel: string,
): Promise<void> {
  const normalized = normalizeRel(rel);
  if (context.seenConstraints.has(normalized)) return;
  context.seenConstraints.add(normalized);

  const content = await readScannedFile(context, normalized);
  if (content === null) return;

  const deps = parseRequirements(content, normalized, 'main');
  evidence.locked.push(...deps.flatMap(requirementPinToLockedDep));

  for (const include of parseRequirementIncludes(content, normalized)) {
    if (include.kind === 'constraint') {
      await appendConstraintFile(evidence, context, include.relativePath);
    }
  }
}

function rootRequirementFiles(files: FileEntry[]): string[] {
  return files.filter(isRootRequirementsFile).map((file) => file.relativePath);
}

function rootConstraintFiles(files: FileEntry[]): string[] {
  return files.filter(isRootConstraintsFile).map((file) => file.relativePath);
}

function isRootRequirementsFile(file: FileEntry): boolean {
  return isRootFile(file) && REQUIREMENTS_DECLARATION_FILE_RE.test(path.basename(file.relativePath));
}

function isRootConstraintsFile(file: FileEntry): boolean {
  return isRootFile(file) && CONSTRAINTS_FILE_RE.test(path.basename(file.relativePath));
}

function isRootFile(file: FileEntry): boolean {
  return !file.directory || file.directory === '.';
}

function isRequirementsLockFile(rel: string): boolean {
  return REQUIREMENTS_LOCK_FILE_RE.test(path.basename(rel));
}

async function readScannedFile(
  context: RequirementReadContext,
  relativePath: string,
): Promise<string | null> {
  if (!context.fileSet.has(relativePath)) return null;
  return tryRead(path.join(context.rootPath, relativePath.split('/').join(path.sep)));
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

interface RequirementInclude {
  kind: 'requirement' | 'constraint';
  relativePath: string;
}

function parseRequirementIncludes(content: string, sourceFile: string): RequirementInclude[] {
  const out: RequirementInclude[] = [];
  for (const raw of content.split('\n')) {
    const stripped = cleanRequirementLine(raw);
    if (!stripped) continue;
    const parsed = requirementIncludeTarget(stripped, sourceFile);
    if (parsed) out.push(parsed);
  }
  return out;
}

function requirementIncludeTarget(line: string, sourceFile: string): RequirementInclude | null {
  const requirement = directiveTarget(line, '-r', '--requirement');
  if (requirement) {
    return safeRequirementInclude('requirement', sourceFile, requirement);
  }

  const constraint = directiveTarget(line, '-c', '--constraint');
  if (constraint) {
    return safeRequirementInclude('constraint', sourceFile, constraint);
  }

  return null;
}

function directiveTarget(line: string, shortFlag: string, longFlag: string): string | null {
  return (
    spacedDirectiveTarget(line, shortFlag) ??
    compactShortDirectiveTarget(line, shortFlag) ??
    spacedDirectiveTarget(line, longFlag) ??
    equalsDirectiveTarget(line, longFlag)
  );
}

function spacedDirectiveTarget(line: string, flag: string): string | null {
  return line.startsWith(`${flag} `) ? firstDirectiveToken(line.slice(flag.length).trim()) : null;
}

function compactShortDirectiveTarget(line: string, flag: string): string | null {
  const target = line.slice(flag.length).trim();
  return line.startsWith(flag) && target && !target.startsWith('-')
    ? firstDirectiveToken(target)
    : null;
}

function equalsDirectiveTarget(line: string, flag: string): string | null {
  return line.startsWith(`${flag}=`) ? firstDirectiveToken(line.slice(flag.length + 1).trim()) : null;
}

function firstDirectiveToken(value: string): string | null {
  const match = /^(['"])(.*?)\1(?:\s|$)/.exec(value);
  if (match) return match[2];
  return value.split(/\s+/)[0] || null;
}

function safeRequirementInclude(
  kind: RequirementInclude['kind'],
  sourceFile: string,
  target: string,
): RequirementInclude | null {
  if (!isLocalRequirementTarget(target)) return null;
  const relativePath = resolveRequirementInclude(sourceFile, target);
  return relativePath ? { kind, relativePath } : null;
}

function isLocalRequirementTarget(target: string): boolean {
  return Boolean(target) && !target.includes('\0') && !path.isAbsolute(target) && !isUrlLike(target);
}

function isUrlLike(target: string): boolean {
  return /^[a-z][a-z+.-]*:/i.test(target);
}

function resolveRequirementInclude(sourceFile: string, target: string): string | null {
  const sourceDir = path.posix.dirname(normalizeRel(sourceFile));
  const baseDir = sourceDir === '.' ? '' : sourceDir;
  const normalized = normalizeRel(path.posix.normalize(path.posix.join(baseDir, target)));
  return isRepoRelativePath(normalized) ? normalized : null;
}

function isRepoRelativePath(relativePath: string): boolean {
  return (
    Boolean(relativePath) &&
    relativePath !== '.' &&
    relativePath !== '..' &&
    !relativePath.startsWith('../')
  );
}

function cleanRequirementLine(raw: string): string {
  return raw.replace(/\s+#.*$/, '').trim();
}

function normalizeRel(rel: string): string {
  return rel.split(path.sep).join('/');
}

function pushUnique(arr: string[], value: string): void {
  if (!arr.includes(value)) arr.push(value);
}

function exactVersionFromSpec(version: string): string | null {
  return /^={2,3}\s*([^\s,;]+)/.exec(version)?.[1] ?? null;
}

function requirementPinToLockedDep(dep: PythonDeclaredDep): PythonLockedDep[] {
  const version = exactVersionFromSpec(dep.versionSpec);
  if (!version) return [];
  return [{ name: dep.name, version, source: dep.source, line: dep.line }];
}
