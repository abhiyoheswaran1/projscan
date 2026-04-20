import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../types.js';
import { parseSource, isParseable, type AstImport, type AstExport, type AstResult } from './ast.js';

export interface GraphFile {
  relativePath: string;
  imports: AstImport[];
  exports: AstExport[];
  callSites: string[];
  lineCount: number;
  mtimeMs: number;
  parseOk: boolean;
  parseReason?: string;
}

export interface CodeGraph {
  /** per-file parse results, keyed by relativePath */
  files: Map<string, GraphFile>;
  /** package name → relativePaths that import it */
  packageImporters: Map<string, Set<string>>;
  /** relativePath → relativePaths that import it (local resolution) */
  localImporters: Map<string, Set<string>>;
  /** symbol name → relativePaths that export it */
  symbolDefs: Map<string, Set<string>>;
  /** scanned file count */
  scannedFiles: number;
}

const NODE_BUILTINS = new Set([
  'assert','async_hooks','buffer','child_process','cluster','console','constants','crypto',
  'dgram','dns','domain','events','fs','fs/promises','http','http2','https','inspector',
  'module','net','os','path','perf_hooks','process','punycode','querystring','readline',
  'repl','stream','string_decoder','sys','timers','tls','trace_events','tty','url','util',
  'v8','vm','wasi','worker_threads','zlib',
]);

const RESOLUTION_EXTS = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts'];

const MAX_FILE_SIZE = 1024 * 1024;

export async function buildCodeGraph(
  rootPath: string,
  files: FileEntry[],
  previousGraph?: CodeGraph,
): Promise<CodeGraph> {
  const parseable = files.filter((f) => isParseable(f.relativePath) && f.sizeBytes <= MAX_FILE_SIZE);

  const graphFiles = new Map<string, GraphFile>();
  const packageImporters = new Map<string, Set<string>>();
  const localImporters = new Map<string, Set<string>>();
  const symbolDefs = new Map<string, Set<string>>();

  // Parse each file (with mtime-based reuse if we have a previous graph)
  await Promise.all(
    parseable.map(async (file) => {
      const absolutePath = path.isAbsolute(file.absolutePath)
        ? file.absolutePath
        : path.resolve(rootPath, file.relativePath);

      let mtimeMs: number;
      try {
        const stat = await fs.stat(absolutePath);
        mtimeMs = stat.mtimeMs;
      } catch {
        return;
      }

      const cached = previousGraph?.files.get(file.relativePath);
      if (cached && cached.mtimeMs === mtimeMs) {
        graphFiles.set(file.relativePath, cached);
        return;
      }

      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch {
        return;
      }

      const result: AstResult = parseSource(file.relativePath, content);
      graphFiles.set(file.relativePath, {
        relativePath: file.relativePath,
        imports: result.imports,
        exports: result.exports,
        callSites: result.callSites,
        lineCount: result.lineCount,
        mtimeMs,
        parseOk: result.ok,
        parseReason: result.reason,
      });
    }),
  );

  // Build derived indexes after all parsing is done
  for (const [importingFile, entry] of graphFiles) {
    const importingDir = path.posix.dirname(importingFile);
    for (const imp of entry.imports) {
      const pkg = toPackageName(imp.source);
      if (pkg) {
        if (!packageImporters.has(pkg)) packageImporters.set(pkg, new Set());
        packageImporters.get(pkg)!.add(importingFile);
      } else if (imp.source.startsWith('.') || imp.source.startsWith('/')) {
        const resolved = resolveRelative(importingDir, imp.source, graphFiles);
        if (resolved) {
          if (!localImporters.has(resolved)) localImporters.set(resolved, new Set());
          localImporters.get(resolved)!.add(importingFile);
        }
      }
    }

    for (const exp of entry.exports) {
      if (!exp.name) continue;
      if (!symbolDefs.has(exp.name)) symbolDefs.set(exp.name, new Set());
      symbolDefs.get(exp.name)!.add(importingFile);
    }
  }

  return {
    files: graphFiles,
    packageImporters,
    localImporters,
    symbolDefs,
    scannedFiles: graphFiles.size,
  };
}

/**
 * Convert an import specifier to a bare package name.
 */
export function toPackageName(specifier: string): string | null {
  if (!specifier) return null;
  if (specifier.startsWith('.') || specifier.startsWith('/')) return null;
  if (specifier.startsWith('node:')) return null;
  if (NODE_BUILTINS.has(specifier)) return null;

  if (specifier.startsWith('@')) {
    const segments = specifier.split('/');
    if (segments.length < 2) return null;
    return `${segments[0]}/${segments[1]}`;
  }

  return specifier.split('/')[0];
}

/**
 * Resolve a relative import to a file in the graph, or null if no match.
 * Supports:
 *   - direct hit  (./foo.ts → foo.ts)
 *   - extension inference (./foo → foo.ts)
 *   - barrel index (./foo → foo/index.ts)
 *   - .js that resolves to .ts under NodeNext
 */
function resolveRelative(
  importingDir: string,
  specifier: string,
  graphFiles: Map<string, GraphFile>,
): string | null {
  const base = path.posix.normalize(path.posix.join(importingDir, specifier));

  if (graphFiles.has(base)) return base;

  for (const ext of RESOLUTION_EXTS) {
    if (graphFiles.has(base + ext)) return base + ext;
  }
  for (const ext of RESOLUTION_EXTS) {
    const barrel = `${base}/index${ext}`;
    if (graphFiles.has(barrel)) return barrel;
  }

  // .js → .ts fallback (NodeNext)
  if (base.endsWith('.js')) {
    const trimmed = base.slice(0, -3);
    if (graphFiles.has(`${trimmed}.ts`)) return `${trimmed}.ts`;
    if (graphFiles.has(`${trimmed}.tsx`)) return `${trimmed}.tsx`;
  }

  return null;
}

// ── Query API ──────────────────────────────────────────────

export function packagesUsed(graph: CodeGraph): Set<string> {
  return new Set(graph.packageImporters.keys());
}

export function filesImportingPackage(graph: CodeGraph, pkg: string): string[] {
  const set = graph.packageImporters.get(pkg);
  return set ? [...set].sort() : [];
}

export function filesImportingFile(graph: CodeGraph, relativePath: string): string[] {
  const set = graph.localImporters.get(relativePath);
  return set ? [...set].sort() : [];
}

export function filesDefiningSymbol(graph: CodeGraph, name: string): string[] {
  const set = graph.symbolDefs.get(name);
  return set ? [...set].sort() : [];
}

export function importersOf(graph: CodeGraph, relativePath: string): string[] {
  return filesImportingFile(graph, relativePath);
}

export function exportsOf(graph: CodeGraph, relativePath: string): AstExport[] {
  return graph.files.get(relativePath)?.exports ?? [];
}

export function importsOf(graph: CodeGraph, relativePath: string): AstImport[] {
  return graph.files.get(relativePath)?.imports ?? [];
}
