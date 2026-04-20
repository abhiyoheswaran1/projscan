import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, Issue } from '../types.js';
import { buildImportGraph } from '../core/importGraph.js';
import { extractExports } from '../core/fileInspector.js';

const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']);

// Never flag these — they're public API by definition
const PUBLIC_PATH_PREFIXES = ['src/index', 'index.'];

// Or if they're explicitly named as exports in package.json
interface PackageExports {
  main?: string;
  types?: string;
  typings?: string;
  bin?: Record<string, string> | string;
  exports?: unknown;
}

/**
 * Flag exports that are never imported anywhere in the project. This catches:
 * - dead named exports left over from refactors
 * - utilities that are implemented but never hooked up
 *
 * Does NOT flag:
 * - files listed as the package's public entry points (main, exports, types, bin)
 * - default exports (too many false positives — framework conventions)
 * - test files (they're not supposed to export)
 * - index files (barrels re-export for public use)
 *
 * False-positive guard: if a file is the target of at least one import, we treat
 * all its exports as "possibly used" — the regex-based graph can't tell which
 * named export is imported via `import { ... } from './barrel'`. This keeps
 * noise low at the cost of missing some dead exports that live in used files.
 */
export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const sourceFiles = files.filter((f) => SOURCE_EXTENSIONS.has(f.extension));
  if (sourceFiles.length === 0) return [];

  const publicEntries = await loadPublicEntries(rootPath);
  const graph = await buildImportGraph(rootPath, sourceFiles);

  // Build a set of files that are the target of at least one relative import.
  // A relative import specifier is resolved against its importing file's dir,
  // so we convert each relative specifier into a candidate target path.
  const importedTargets = new Set<string>();
  for (const [importingFile, specifiers] of graph.byFile) {
    const importingDir = path.posix.dirname(importingFile);
    for (const spec of specifiers) {
      if (!spec.startsWith('.')) continue;
      const resolved = path.posix.normalize(path.posix.join(importingDir, spec));
      for (const candidate of resolutionCandidates(resolved)) {
        importedTargets.add(candidate);
      }
    }
  }

  const issues: Issue[] = [];
  for (const file of sourceFiles) {
    if (isTestFile(file.relativePath)) continue;
    if (isBarrelFile(file.relativePath)) continue;
    if (isPublicEntry(file.relativePath, publicEntries)) continue;
    if (importedTargets.has(file.relativePath)) continue;
    if (importedTargets.has(stripExtension(file.relativePath))) continue;

    let content: string;
    try {
      content = await fs.readFile(file.absolutePath, 'utf-8');
    } catch {
      continue;
    }

    const exports = extractExports(content).filter((e) => e.type !== 'default' && e.name !== 'default');
    if (exports.length === 0) continue;

    issues.push({
      id: `unused-exports-${file.relativePath}`,
      title: `Unused exports in ${file.relativePath}`,
      description: `${exports.length} named export${exports.length === 1 ? '' : 's'} (${exports
        .slice(0, 5)
        .map((e) => e.name)
        .join(', ')}${exports.length > 5 ? `, … +${exports.length - 5}` : ''}) but nothing in the project imports this file. Dead code or awaiting wiring?`,
      severity: 'info',
      category: 'architecture',
      fixAvailable: false,
      locations: [{ file: file.relativePath, line: 1 }],
    });
  }

  return issues;
}

function isTestFile(relativePath: string): boolean {
  return (
    relativePath.includes('.test.') ||
    relativePath.includes('.spec.') ||
    relativePath.includes('__tests__') ||
    relativePath.startsWith('tests/')
  );
}

function isBarrelFile(relativePath: string): boolean {
  const base = path.basename(relativePath, path.extname(relativePath));
  return base === 'index';
}

function isPublicEntry(relativePath: string, publicEntries: Set<string>): boolean {
  if (publicEntries.has(relativePath)) return true;
  if (publicEntries.has(stripExtension(relativePath))) return true;
  for (const prefix of PUBLIC_PATH_PREFIXES) {
    if (relativePath === prefix || relativePath.startsWith(prefix)) return true;
  }
  return false;
}

function stripExtension(p: string): string {
  const ext = path.extname(p);
  return ext ? p.slice(0, -ext.length) : p;
}

/**
 * Return the set of possible resolution targets for a relative import
 * specifier (already joined+normalized). For './foo' we yield:
 *   foo, foo.ts, foo.tsx, foo.js, foo.jsx, foo.mjs, foo.cjs,
 *   foo/index.ts, foo/index.tsx, foo/index.js, ...
 */
function resolutionCandidates(base: string): string[] {
  const exts = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];
  const out: string[] = [base];
  for (const ext of exts) {
    out.push(base + ext);
    out.push(base + '/index' + ext);
  }
  // Handle imports written with an explicit ".js" that actually resolve to a .ts file (ESM+NodeNext)
  if (base.endsWith('.js')) {
    const noJs = base.slice(0, -3);
    out.push(noJs + '.ts', noJs + '.tsx');
  }
  return out;
}

async function loadPublicEntries(rootPath: string): Promise<Set<string>> {
  const entries = new Set<string>();
  const pkgPath = path.join(rootPath, 'package.json');
  try {
    const raw = await fs.readFile(pkgPath, 'utf-8');
    const pkg = JSON.parse(raw) as PackageExports;
    for (const value of [pkg.main, pkg.types, pkg.typings]) {
      if (typeof value === 'string') addNormalized(entries, value);
    }
    if (typeof pkg.bin === 'string') addNormalized(entries, pkg.bin);
    else if (pkg.bin && typeof pkg.bin === 'object') {
      for (const value of Object.values(pkg.bin)) addNormalized(entries, value);
    }
    collectExports(pkg.exports, entries);
  } catch {
    // package.json missing/unreadable — don't guard, every file is a candidate
  }
  return entries;
}

function addNormalized(set: Set<string>, value: string): void {
  const cleaned = value.replace(/^\.\//, '').replace(/^\//, '');
  set.add(cleaned);
  set.add(stripExtension(cleaned));
}

function collectExports(exportsField: unknown, out: Set<string>): void {
  if (!exportsField) return;
  if (typeof exportsField === 'string') {
    addNormalized(out, exportsField);
    return;
  }
  if (typeof exportsField !== 'object') return;
  for (const value of Object.values(exportsField as Record<string, unknown>)) {
    collectExports(value, out);
  }
}
