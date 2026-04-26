import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../types.js';
import type { AstImport, AstExport, AstResult, FunctionInfo } from './ast.js';
import { getAdapterFor, listAdapters } from './languages/registry.js';
import type { LanguageAdapter, LanguageResolveContext } from './languages/LanguageAdapter.js';

export interface GraphFile {
  relativePath: string;
  imports: AstImport[];
  exports: AstExport[];
  callSites: string[];
  lineCount: number;
  /** File-level McCabe cyclomatic complexity from the adapter. 0 when unparsed. */
  cyclomaticComplexity: number;
  /**
   * Per-function McCabe CC from the adapter (0.13.0+). Optional for
   * backward compatibility with code paths that build GraphFile records
   * without function metadata. Treat absence as "no per-function data".
   */
  functions?: FunctionInfo[];
  mtimeMs: number;
  parseOk: boolean;
  parseReason?: string;
  /** Adapter id that parsed this file. */
  adapterId?: string;
}

export interface CodeGraph {
  files: Map<string, GraphFile>;
  packageImporters: Map<string, Set<string>>;
  localImporters: Map<string, Set<string>>;
  symbolDefs: Map<string, Set<string>>;
  scannedFiles: number;
}

const MAX_FILE_SIZE = 1024 * 1024;

export async function buildCodeGraph(
  rootPath: string,
  files: FileEntry[],
  previousGraph?: CodeGraph,
): Promise<CodeGraph> {
  // Per-adapter setup (e.g. Python package-root detection).
  const contextByAdapter = new Map<LanguageAdapter, LanguageResolveContext>();
  for (const adapter of listAdapters()) {
    contextByAdapter.set(adapter, await adapter.preparePackageRoots(rootPath, files));
  }

  const parseable = files
    .map((f) => ({ file: f, adapter: getAdapterFor(f.relativePath) }))
    .filter(
      (x): x is { file: FileEntry; adapter: LanguageAdapter } =>
        !!x.adapter && x.file.sizeBytes <= (x.adapter.maxFileSize ?? MAX_FILE_SIZE),
    );

  const graphFiles = new Map<string, GraphFile>();
  const packageImporters = new Map<string, Set<string>>();
  const localImporters = new Map<string, Set<string>>();
  const symbolDefs = new Map<string, Set<string>>();

  await Promise.all(
    parseable.map(async ({ file, adapter }) => {
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
      if (cached && cached.mtimeMs === mtimeMs && cached.adapterId === adapter.id) {
        graphFiles.set(file.relativePath, cached);
        return;
      }

      let content: string;
      try {
        content = await fs.readFile(absolutePath, 'utf-8');
      } catch {
        return;
      }

      let result: AstResult;
      try {
        result = await adapter.parse(file.relativePath, content);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        result = {
          ok: false,
          reason: `adapter ${adapter.id} threw: ${msg.slice(0, 120)}`,
          imports: [],
          exports: [],
          callSites: [],
          lineCount: 0,
          cyclomaticComplexity: 0,
          functions: [],
        };
      }

      graphFiles.set(file.relativePath, {
        relativePath: file.relativePath,
        imports: result.imports,
        exports: result.exports,
        callSites: result.callSites,
        lineCount: result.lineCount,
        cyclomaticComplexity: result.cyclomaticComplexity,
        functions: result.functions ?? [],
        mtimeMs,
        parseOk: result.ok,
        parseReason: result.reason,
        adapterId: adapter.id,
      });
    }),
  );

  for (const [importingFile, entry] of graphFiles) {
    const adapter = getAdapterFor(importingFile);
    if (!adapter) continue;
    const context = contextByAdapter.get(adapter) ?? {};

    for (const imp of entry.imports) {
      // Try local resolution first. For JS/TS this is a no-op on bare specifiers
      // (resolveImport short-circuits on non-relative paths). For Python it
      // matters: `pkg.core` could be either a local module or third-party.
      // Local takes precedence when it resolves; otherwise fall back to pkg.
      const resolved = adapter.resolveImport(importingFile, imp.source, graphFiles, context);
      if (resolved) {
        if (!localImporters.has(resolved)) localImporters.set(resolved, new Set());
        localImporters.get(resolved)!.add(importingFile);
        continue;
      }
      const pkg = adapter.toPackageName(imp.source);
      if (pkg) {
        if (!packageImporters.has(pkg)) packageImporters.set(pkg, new Set());
        packageImporters.get(pkg)!.add(importingFile);
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
 * Back-compat: convert a JS/TS import specifier to a bare package name.
 * Delegates to the JavaScript adapter. For multi-language use cases, prefer
 * `getAdapterFor(filePath).toPackageName(specifier)`.
 */
export function toPackageName(specifier: string): string | null {
  const jsAdapter = listAdapters().find((a) => a.id === 'javascript');
  return jsAdapter ? jsAdapter.toPackageName(specifier) : null;
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
