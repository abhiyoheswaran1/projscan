import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../../types.js';
import { parsePythonLockfile, readPythonLockfile } from './pythonLockfiles.js';
import { splitPep508 } from './pythonPep508.js';
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

// ── pyproject.toml ───────────────────────────────────────────

export function parsePyproject(content: string): PythonDeclaredDep[] {
  const out: PythonDeclaredDep[] = [];

  // [project.dependencies] as a list of PEP 508 strings OR
  // [project] dependencies = [ ... ]
  const pep621Deps = extractListBlock(content, /(?:^|\n)\s*dependencies\s*=\s*\[/);
  for (const { name, versionSpec, line } of pep621Deps) {
    out.push({ name, versionSpec, source: 'pyproject.toml', line, scope: 'main' });
  }

  // [project.optional-dependencies] groups → all treated as 'dev'.
  // Entries may be inline (`test = ["a", "b"]`) OR multiline; iterate over all
  // string literals in the block rather than splitting by lines.
  const optBlockRe = /\[project\.optional-dependencies\]([\s\S]*?)(?=\n\[|$)/;
  const optMatch = optBlockRe.exec(content);
  if (optMatch) {
    const blockStart = optMatch.index + optMatch[0].indexOf(optMatch[1]);
    const block = optMatch[1];
    const stringRe = /["']([^"'\n]+)["']/g;
    let sm: RegExpExecArray | null;
    while ((sm = stringRe.exec(block))) {
      const { name, versionSpec } = splitPep508(sm[1]);
      if (!name) continue;
      const line = offsetToLine(content, blockStart + sm.index);
      out.push({ name, versionSpec, source: 'pyproject.toml', line, scope: 'dev' });
    }
  }
  appendDependencyGroups(out, content);

  // [tool.poetry.dependencies] / [tool.poetry.group.<name>.dependencies]
  const poetryMainRe = /\[tool\.poetry\.dependencies\]([\s\S]*?)(?=\n\[|$)/;
  const poetryMainMatch = poetryMainRe.exec(content);
  if (poetryMainMatch) {
    const offset = offsetToLine(content, poetryMainMatch.index);
    for (const { name, versionSpec, line } of parsePoetryKv(poetryMainMatch[1], offset)) {
      if (name === 'python') continue;
      out.push({ name, versionSpec, source: 'pyproject.toml', line, scope: 'main' });
    }
  }
  const poetryGroupRe = /\[tool\.poetry\.group\.[\w.-]+\.dependencies\]([\s\S]*?)(?=\n\[|$)/g;
  let gm: RegExpExecArray | null;
  while ((gm = poetryGroupRe.exec(content))) {
    const offset = offsetToLine(content, gm.index);
    for (const { name, versionSpec, line } of parsePoetryKv(gm[1], offset)) {
      out.push({ name, versionSpec, source: 'pyproject.toml', line, scope: 'dev' });
    }
  }
  appendLegacyPoetryDevDependencies(out, content);

  return out;
}

function appendDependencyGroups(out: PythonDeclaredDep[], content: string): void {
  const groupsRe = /\[dependency-groups\]([\s\S]*?)(?=\n\[|$)/;
  const groupsMatch = groupsRe.exec(content);
  if (!groupsMatch) return;
  const blockStart = groupsMatch.index + groupsMatch[0].indexOf(groupsMatch[1]);
  const block = groupsMatch[1];
  const groupRe = /(?:^|\n)\s*[A-Za-z0-9_.-]+\s*=\s*\[/g;
  let groupMatch: RegExpExecArray | null;
  while ((groupMatch = groupRe.exec(block))) {
    const open = block.indexOf('[', groupMatch.index);
    const close = matchingBracketOffset(block, open);
    if (open < 0 || close < 0) continue;
    appendDependencyGroupArray(out, content, block, blockStart, open, close);
    groupRe.lastIndex = close + 1;
  }
}

function appendDependencyGroupArray(
  out: PythonDeclaredDep[],
  content: string,
  block: string,
  blockStart: number,
  open: number,
  close: number,
): void {
  const inside = maskIncludeGroupObjects(block.slice(open + 1, close));
  const insideStart = blockStart + open + 1;
  const stringRe = /["']([^"'\n]+)["']/g;
  let sm: RegExpExecArray | null;
  while ((sm = stringRe.exec(inside))) {
    const { name, versionSpec } = splitPep508(sm[1]);
    if (!name) continue;
    out.push({
      name,
      versionSpec,
      source: 'pyproject.toml',
      line: offsetToLine(content, insideStart + sm.index),
      scope: 'dev',
    });
  }
}

function matchingBracketOffset(value: string, open: number): number {
  if (open < 0) return -1;
  let depth = 1;
  for (let index = open + 1; index < value.length; index++) {
    const char = value[index];
    if (char === '[') depth += 1;
    else if (char === ']') depth -= 1;
    if (depth === 0) return index;
  }
  return -1;
}

function maskIncludeGroupObjects(value: string): string {
  return value.replace(/\{[^{}\n]*include-group\s*=[^{}]*\}/g, (match) =>
    match.replace(/[^\n]/g, ' '),
  );
}

function appendLegacyPoetryDevDependencies(out: PythonDeclaredDep[], content: string): void {
  const legacyDevRe = /\[tool\.poetry\.dev-dependencies\]([\s\S]*?)(?=\n\[|$)/;
  const legacyDevMatch = legacyDevRe.exec(content);
  if (!legacyDevMatch) return;
  const offset = offsetToLine(content, legacyDevMatch.index);
  for (const { name, versionSpec, line } of parsePoetryKv(legacyDevMatch[1], offset)) {
    out.push({ name, versionSpec, source: 'pyproject.toml', line, scope: 'dev' });
  }
}

function parsePoetryKv(
  block: string,
  lineOffset: number,
): { name: string; versionSpec: string; line: number }[] {
  const out: { name: string; versionSpec: string; line: number }[] = [];
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].replace(/#.*$/, '').trim();
    if (!line) continue;
    // name = "^1.0.0" | name = { version = "...", ... }
    const m = /^([A-Za-z_][\w.-]*)\s*=\s*(.+)$/.exec(line);
    if (!m) continue;
    const name = m[1];
    let versionSpec = m[2].trim();
    if (versionSpec.startsWith('{')) {
      const vm = /version\s*=\s*["']([^"']+)["']/.exec(versionSpec);
      versionSpec = vm ? vm[1] : '';
    } else if (/^["']/.test(versionSpec)) {
      versionSpec = versionSpec.replace(/^["']|["']$/g, '');
    }
    out.push({ name, versionSpec, line: lineOffset + i + 1 });
  }
  return out;
}

function extractListBlock(
  content: string,
  opener: RegExp,
): { name: string; versionSpec: string; line: number }[] {
  const m = opener.exec(content);
  if (!m) return [];
  // Find the matching ']' by simple bracket-depth scan from the '['.
  const start = content.indexOf('[', m.index);
  if (start < 0) return [];
  let depth = 1;
  let end = start + 1;
  while (end < content.length && depth > 0) {
    const ch = content[end];
    if (ch === '[') depth++;
    else if (ch === ']') depth--;
    end++;
  }
  const inside = content.slice(start + 1, end - 1);
  const baseLine = offsetToLine(content, start + 1);
  return extractListValues(inside, baseLine);
}

function extractListValues(
  block: string,
  lineOffset: number,
): { name: string; versionSpec: string; line: number }[] {
  const out: { name: string; versionSpec: string; line: number }[] = [];
  const lines = block.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const stripped = lines[i].replace(/#.*$/, '').trim();
    // Entries look like  "requests>=2.25.0",
    const m = /^["']([^"']+)["']/.exec(stripped);
    if (!m) continue;
    const { name, versionSpec } = splitPep508(m[1]);
    if (!name) continue;
    out.push({ name, versionSpec, line: lineOffset + i });
  }
  return out;
}

function offsetToLine(content: string, offset: number): number {
  let line = 0;
  for (let i = 0; i < offset && i < content.length; i++) {
    if (content[i] === '\n') line++;
  }
  return line + 1;
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
