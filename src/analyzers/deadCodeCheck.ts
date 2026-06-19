import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry, Issue } from '../types.js';
import { buildCodeGraph } from '../core/codeGraph.js';
import { getAdapterFor } from '../core/languages/registry.js';

const SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.py',
  '.pyw',
]);

const JAVASCRIPT_SOURCE_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
]);

// Never flag these - they're public API by definition (JS convention).
const PUBLIC_PATH_PREFIXES = ['src/index', 'index.'];

// Names (sans extension) that are barrel-equivalents and should never be
// flagged as dead. `index` for JS/TS, `__init__` for Python packages.
const BARREL_BASENAMES = new Set(['index', '__init__']);

interface PackageExports {
  main?: string;
  types?: string;
  typings?: string;
  bin?: Record<string, string> | string;
  exports?: unknown;
}

/**
 * Flag source files whose exports nothing imports. Language-agnostic: uses the
 * code graph directly, so JS/TS/Python all get the same correctness guarantees.
 *
 * Skipped:
 *   - public package entries (main/exports/bin/types in package.json)
 *   - test files (JS conventions + pytest `test_*.py` / `*_test.py` / `tests/`)
 *   - barrel files (`index.*` for JS, `__init__.py` for Python)
 *   - default-only exports (too many framework false positives)
 *
 * False-positive guard: if any import resolves to this file, we treat ALL its
 * exports as possibly used - the graph can't always tell which named export
 * got picked up from a barrel.
 */
export async function check(rootPath: string, files: FileEntry[]): Promise<Issue[]> {
  const sourceFiles = files.filter((f) => SOURCE_EXTENSIONS.has(f.extension));
  if (sourceFiles.length === 0) return [];

  const publicEntries = await loadPublicEntries(rootPath);
  const graph = await buildCodeGraph(rootPath, sourceFiles);

  const issues: Issue[] = [];
  for (const file of sourceFiles) {
    if (isTestFile(file.relativePath)) continue;
    if (isBarrelFile(file.relativePath)) continue;
    if (isPublicEntry(file.relativePath, publicEntries)) continue;
    if (isFrameworkEntrypoint(file.relativePath)) continue;

    // Any importer → file is used.
    if ((graph.localImporters.get(file.relativePath)?.size ?? 0) > 0) continue;

    const graphFile = graph.files.get(file.relativePath);
    if (!graphFile || !graphFile.parseOk) continue;

    const namedExports = graphFile.exports.filter(
      (e) => e.name !== 'default' && e.kind !== 'default',
    );
    if (namedExports.length === 0) continue;

    const adapter = getAdapterFor(file.relativePath);
    const languageLabel = adapter?.id ?? 'file';
    const kindLabel = languageLabel === 'python' ? 'name' : 'export';

    issues.push({
      id: `unused-exports-${file.relativePath}`,
      title: `Unused ${kindLabel}s in ${file.relativePath}`,
      description: `${namedExports.length} named ${kindLabel}${namedExports.length === 1 ? '' : 's'} (${namedExports
        .slice(0, 5)
        .map((e) => e.name)
        .join(
          ', ',
        )}${namedExports.length > 5 ? `, … +${namedExports.length - 5}` : ''}) but nothing in the project imports this file. Dead code or awaiting wiring?`,
      severity: 'info',
      category: 'architecture',
      fixAvailable: false,
      locations: [{ file: file.relativePath, line: 1 }],
    });
  }

  return issues;
}

function isTestFile(relativePath: string): boolean {
  const base = path.basename(relativePath);
  return (
    relativePath.includes('.test.') ||
    relativePath.includes('.spec.') ||
    relativePath.includes('__tests__') ||
    relativePath.startsWith('tests/') ||
    relativePath.includes('/tests/') ||
    // pytest conventions
    /^test_.+\.py$/.test(base) ||
    /^.+_test\.py$/.test(base)
  );
}

function isBarrelFile(relativePath: string): boolean {
  const base = path.basename(relativePath, path.extname(relativePath));
  return BARREL_BASENAMES.has(base);
}

function isPublicEntry(relativePath: string, publicEntries: Set<string>): boolean {
  if (publicEntries.has(relativePath)) return true;
  if (publicEntries.has(stripExtension(relativePath))) return true;
  for (const prefix of PUBLIC_PATH_PREFIXES) {
    if (relativePath === prefix || relativePath.startsWith(prefix)) return true;
  }
  return false;
}

function isFrameworkEntrypoint(relativePath: string): boolean {
  if (!isJavaScriptSourcePath(relativePath)) return false;

  const normalized = relativePath.replace(/\\/g, '/');
  const basename = path.posix.basename(normalized, path.posix.extname(normalized));
  const dirname = path.posix.dirname(normalized);
  if (
    (dirname === '.' || dirname === 'src') &&
    NEXT_ROOT_ENTRYPOINT_BASENAMES.has(basename)
  ) {
    return true;
  }

  if (isRemixFrameworkEntrypoint(normalized)) return true;
  if (isSvelteKitFrameworkEntrypoint(normalized)) return true;
  if (isAstroFrameworkEntrypoint(normalized)) return true;

  const appRelativePath = normalized.startsWith('src/')
    ? normalized.slice('src/'.length)
    : normalized;
  if (!appRelativePath.startsWith('app/')) return false;

  const appBasename = path.posix.basename(appRelativePath, path.posix.extname(appRelativePath));
  return NEXT_APP_ROUTER_ENTRYPOINT_BASENAMES.has(appBasename);
}

function isRemixFrameworkEntrypoint(relativePath: string): boolean {
  if (
    relativePath === 'app/root.tsx' ||
    relativePath === 'app/root.jsx' ||
    relativePath === 'app/entry.client.tsx' ||
    relativePath === 'app/entry.client.jsx' ||
    relativePath === 'app/entry.server.tsx' ||
    relativePath === 'app/entry.server.jsx' ||
    relativePath === 'app/routes.ts'
  ) {
    return true;
  }
  return relativePath.startsWith('app/routes/');
}

function isSvelteKitFrameworkEntrypoint(relativePath: string): boolean {
  const routePath = relativePath.startsWith('src/')
    ? relativePath.slice('src/'.length)
    : relativePath;
  if (!routePath.startsWith('routes/')) return false;
  return path.posix.basename(routePath).startsWith('+');
}

function isAstroFrameworkEntrypoint(relativePath: string): boolean {
  const astroPath = relativePath.startsWith('src/')
    ? relativePath.slice('src/'.length)
    : relativePath;
  return astroPath.startsWith('pages/');
}

const NEXT_ROOT_ENTRYPOINT_BASENAMES = new Set([
  'middleware',
  'proxy',
  'instrumentation',
  'instrumentation-client',
  'mdx-components',
]);

const NEXT_APP_ROUTER_ENTRYPOINT_BASENAMES = new Set([
  'route',
  'page',
  'layout',
  'template',
  'default',
  'loading',
  'error',
  'not-found',
  'global-error',
  'global-not-found',
  'forbidden',
  'unauthorized',
  'sitemap',
  'robots',
  'manifest',
  'icon',
  'apple-icon',
  'opengraph-image',
  'twitter-image',
]);

function isJavaScriptSourcePath(relativePath: string): boolean {
  return JAVASCRIPT_SOURCE_EXTENSIONS.has(path.posix.extname(relativePath).toLowerCase());
}

function stripExtension(p: string): string {
  const ext = path.extname(p);
  return ext ? p.slice(0, -ext.length) : p;
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
    // package.json missing - nothing to guard
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
