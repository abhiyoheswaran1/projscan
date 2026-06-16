import { splitPep508 } from './pythonPep508.js';
import type { PythonDeclaredDep } from './pythonProjectTypes.js';
import { extractListValues, offsetToLine } from './pythonManifestText.js';

export function parsePyproject(content: string): PythonDeclaredDep[] {
  const out: PythonDeclaredDep[] = [];

  const pep621Deps = extractListBlock(content, /(?:^|\n)\s*dependencies\s*=\s*\[/);
  for (const { name, versionSpec, line } of pep621Deps) {
    out.push({ name, versionSpec, source: 'pyproject.toml', line, scope: 'main' });
  }

  appendOptionalDependencies(out, content);
  appendDependencyGroups(out, content);
  appendPoetryDependencies(out, content);
  appendLegacyPoetryDevDependencies(out, content);

  return out;
}

function appendOptionalDependencies(out: PythonDeclaredDep[], content: string): void {
  const optBlockRe = /\[project\.optional-dependencies\]([\s\S]*?)(?=\n\[|$)/;
  const optMatch = optBlockRe.exec(content);
  if (!optMatch) return;
  const blockStart = optMatch.index + optMatch[0].indexOf(optMatch[1]);
  const block = optMatch[1];
  const stringRe = /["']([^"'\n]+)["']/g;
  let stringMatch: RegExpExecArray | null;
  while ((stringMatch = stringRe.exec(block))) {
    const { name, versionSpec } = splitPep508(stringMatch[1]);
    if (!name) continue;
    out.push({
      name,
      versionSpec,
      source: 'pyproject.toml',
      line: offsetToLine(content, blockStart + stringMatch.index),
      scope: 'dev',
    });
  }
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
  let stringMatch: RegExpExecArray | null;
  while ((stringMatch = stringRe.exec(inside))) {
    const { name, versionSpec } = splitPep508(stringMatch[1]);
    if (!name) continue;
    out.push({
      name,
      versionSpec,
      source: 'pyproject.toml',
      line: offsetToLine(content, insideStart + stringMatch.index),
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

function appendPoetryDependencies(out: PythonDeclaredDep[], content: string): void {
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
  let groupMatch: RegExpExecArray | null;
  while ((groupMatch = poetryGroupRe.exec(content))) {
    const offset = offsetToLine(content, groupMatch.index);
    for (const { name, versionSpec, line } of parsePoetryKv(groupMatch[1], offset)) {
      out.push({ name, versionSpec, source: 'pyproject.toml', line, scope: 'dev' });
    }
  }
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
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index].replace(/#.*$/, '').trim();
    if (!line) continue;
    const match = /^([A-Za-z_][\w.-]*)\s*=\s*(.+)$/.exec(line);
    if (!match) continue;
    const name = match[1];
    const versionSpec = poetryVersionSpec(match[2].trim());
    out.push({ name, versionSpec, line: lineOffset + index + 1 });
  }
  return out;
}

function poetryVersionSpec(raw: string): string {
  if (raw.startsWith('{')) {
    const versionMatch = /version\s*=\s*["']([^"']+)["']/.exec(raw);
    return versionMatch ? versionMatch[1] : '';
  }
  if (/^["']/.test(raw)) return raw.replace(/^["']|["']$/g, '');
  return raw;
}

function extractListBlock(
  content: string,
  opener: RegExp,
): { name: string; versionSpec: string; line: number }[] {
  const match = opener.exec(content);
  if (!match) return [];
  const start = content.indexOf('[', match.index);
  if (start < 0) return [];
  const end = matchingBracketOffset(content, start);
  if (end < 0) return [];
  const inside = content.slice(start + 1, end);
  const baseLine = offsetToLine(content, start + 1);
  return extractListValues(inside, baseLine);
}
