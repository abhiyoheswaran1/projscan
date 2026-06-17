import fs from 'node:fs/promises';
import path from 'node:path';
import type { PythonLockedDep } from './pythonProjectTypes.js';

const LOCKFILES = [
  'poetry.lock',
  'Pipfile.lock',
  'pdm.lock',
  'uv.lock',
  'conda-lock.yml',
  'conda-lock.yaml',
];

const LOCKFILE_PARSERS: Record<string, (content: string, sourceFile: string) => PythonLockedDep[]> =
  {
    'poetry.lock': parsePoetryLock,
    'Pipfile.lock': parsePipfileLock,
    'pdm.lock': parsePdmLock,
    'uv.lock': parseUvLock,
    'conda-lock.yml': parseCondaLock,
    'conda-lock.yaml': parseCondaLock,
  };

export async function readPythonLockfile(
  rootPath: string,
): Promise<{ name: string; content: string } | null> {
  return (await readPythonLockfiles(rootPath))[0] ?? null;
}

export async function readPythonLockfiles(
  rootPath: string,
): Promise<Array<{ name: string; content: string }>> {
  const out: Array<{ name: string; content: string }> = [];
  for (const name of LOCKFILES) {
    const content = await tryRead(path.join(rootPath, name));
    if (content !== null) out.push({ name, content });
  }
  return out;
}

export function parsePythonLockfile(name: string, content: string): PythonLockedDep[] {
  const parser = LOCKFILE_PARSERS[name];
  return parser ? parser(content, name) : [];
}

export function parsePoetryLock(content: string, sourceFile: string): PythonLockedDep[] {
  return parseTomlPackageLock(content, sourceFile);
}

export function parseUvLock(content: string, sourceFile: string): PythonLockedDep[] {
  return parseTomlPackageLock(content, sourceFile);
}

export function parsePdmLock(content: string, sourceFile: string): PythonLockedDep[] {
  return parseTomlPackageLock(content, sourceFile);
}

export function parseCondaLock(content: string, sourceFile: string): PythonLockedDep[] {
  const lines = content.split('\n');
  const packageList = findCondaPackageList(lines);
  if (!packageList) return [];
  return parseCondaPackageEntries(lines, packageList.index + 1, packageList.indent, sourceFile);
}

export function parsePipfileLock(content: string, sourceFile: string): PythonLockedDep[] {
  const parsed = parseJsonObject(content);
  if (!parsed || typeof parsed !== 'object') return [];

  const out: PythonLockedDep[] = [];
  for (const sectionName of ['default', 'develop']) {
    const section = (parsed as Record<string, unknown>)[sectionName];
    out.push(...parsePipfileLockSection(section, sourceFile));
  }
  return out;
}

async function tryRead(absolutePath: string): Promise<string | null> {
  try {
    return await fs.readFile(absolutePath, 'utf-8');
  } catch {
    return null;
  }
}

function findCondaPackageList(lines: string[]): { index: number; indent: number } | null {
  for (let index = 0; index < lines.length; index++) {
    const raw = lines[index];
    const trimmed = raw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    if (/^package:\s*$/.test(trimmed)) return { index, indent: leadingWhitespace(raw) };
  }
  return null;
}

function parseCondaPackageEntries(
  lines: string[],
  startIndex: number,
  packageIndent: number,
  sourceFile: string,
): PythonLockedDep[] {
  const out: PythonLockedDep[] = [];
  let current: CondaLockEntry | null = null;
  for (let i = startIndex; i < lines.length; i++) {
    const parsed = condaPackageLine(lines[i], packageIndent);
    if (parsed.kind === 'skip') continue;
    if (parsed.kind === 'end') break;
    current = updateCondaLockEntry(out, current, parsed, i + 1, sourceFile);
  }
  pushCondaLockEntry(out, current, sourceFile);
  return out;
}

type CondaPackageLine =
  | { kind: 'skip' }
  | { kind: 'end' }
  | { kind: 'entryStart'; fragment: string }
  | { kind: 'entryField'; fragment: string };

function condaPackageLine(raw: string, packageIndent: number): CondaPackageLine {
  const trimmed = raw.trim();
  if (!trimmed || trimmed.startsWith('#')) return { kind: 'skip' };
  const indent = leadingWhitespace(raw);
  if (indent <= packageIndent && !trimmed.startsWith('-')) return { kind: 'end' };
  if (trimmed.startsWith('- ')) return { kind: 'entryStart', fragment: trimmed.slice(2) };
  return { kind: 'entryField', fragment: trimmed };
}

function updateCondaLockEntry(
  out: PythonLockedDep[],
  current: CondaLockEntry | null,
  parsed: Exclude<CondaPackageLine, { kind: 'skip' | 'end' }>,
  line: number,
  sourceFile: string,
): CondaLockEntry | null {
  if (parsed.kind === 'entryStart') {
    pushCondaLockEntry(out, current, sourceFile);
    const next: CondaLockEntry = {};
    readCondaLockPair(next, parsed.fragment, line);
    return next;
  }

  if (current) readCondaLockPair(current, parsed.fragment, line);
  return current;
}

interface CondaLockEntry {
  name?: string;
  version?: string;
  versionLine?: number;
}

function readCondaLockPair(entry: CondaLockEntry, fragment: string, line: number): void {
  const match = /^([A-Za-z_][\w.-]*)\s*:\s*(.*?)\s*$/.exec(fragment);
  if (!match) return;
  const value = yamlScalarValue(match[2]);
  if (!value) return;
  if (match[1] === 'name') entry.name = value;
  if (match[1] === 'version') {
    entry.version = value;
    entry.versionLine = line;
  }
}

function pushCondaLockEntry(
  out: PythonLockedDep[],
  entry: CondaLockEntry | null,
  sourceFile: string,
): void {
  if (!entry?.name || !entry.version) return;
  out.push({
    name: entry.name,
    version: entry.version,
    source: sourceFile,
    line: entry.versionLine ?? 0,
  });
}

function yamlScalarValue(value: string): string {
  const trimmed = value.trim();
  const quoted = /^(['"])(.*?)\1(?:\s+#.*)?$/.exec(trimmed);
  if (quoted) return quoted[2];
  return trimmed.replace(/\s+#.*$/, '').trim();
}

function leadingWhitespace(value: string): number {
  return value.length - value.trimStart().length;
}

function parseTomlPackageLock(content: string, sourceFile: string): PythonLockedDep[] {
  const out: PythonLockedDep[] = [];
  const blockRe = /\[\[package\]\]([\s\S]*?)(?=\n\[\[package\]\]|$)/g;
  let block: RegExpExecArray | null;
  while ((block = blockRe.exec(content))) {
    const body = block[1];
    const bodyStart = block.index + block[0].indexOf(body);
    const name = /(?:^|\n)\s*name\s*=\s*["']([^"']+)["']/.exec(body)?.[1];
    const versionMatch = /(?:^|\n)\s*version\s*=\s*["']([^"']+)["']/.exec(body);
    if (!name || !versionMatch) continue;
    out.push({
      name,
      version: versionMatch[1],
      source: sourceFile,
      line: offsetToLine(
        content,
        bodyStart + versionMatch.index + versionMatch[0].indexOf('version'),
      ),
    });
  }
  return out;
}

function parseJsonObject(content: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(content);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function parsePipfileLockSection(section: unknown, sourceFile: string): PythonLockedDep[] {
  if (!section || typeof section !== 'object') return [];
  const out: PythonLockedDep[] = [];
  for (const [name, value] of Object.entries(section as Record<string, unknown>)) {
    const version = exactPipfileLockVersion(value);
    if (version) out.push({ name, version, source: sourceFile, line: 0 });
  }
  return out;
}

function exactPipfileLockVersion(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const version = (value as Record<string, unknown>).version;
  if (typeof version !== 'string') return null;
  return exactVersionFromSpec(version);
}

function exactVersionFromSpec(version: string): string | null {
  return /^={2,3}\s*([^\s,;]+)/.exec(version)?.[1] ?? null;
}

function offsetToLine(content: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line + 1;
}
