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

  // 0.15.0: per-function fan-in. For each function name across the graph,
  // count how many OTHER files include the name in their callSites. The
  // result is attached to the function entry in-place. Approximate: shared
  // names across files attribute to every definition.
  const callerFilesByName = new Map<string, Set<string>>();
  for (const gf of graphFiles.values()) {
    for (const name of gf.callSites ?? []) {
      let set = callerFilesByName.get(name);
      if (!set) {
        set = new Set();
        callerFilesByName.set(name, set);
      }
      set.add(gf.relativePath);
    }
  }
  for (const gf of graphFiles.values()) {
    if (!gf.functions || gf.functions.length === 0) continue;
    for (const fn of gf.functions) {
      const bare = bareName(fn.name);
      const callers = callerFilesByName.get(bare);
      if (!callers) {
        fn.fanIn = 0;
        continue;
      }
      // Subtract self if the function's own file appears in the caller set
      // (self-call from within the same file).
      fn.fanIn = callers.size - (callers.has(gf.relativePath) ? 1 : 0);
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
 * Function names in the graph are sometimes qualified (`Class.method` for
 * methods, `Class.<init>` for Java constructors). callSites only carries
 * the bare name (the called identifier), so we strip the class/receiver
 * prefix to do the lookup. Falls back to the original on names without a
 * dot.
 */
function bareName(qualified: string): string {
  const dot = qualified.lastIndexOf('.');
  if (dot < 0) return qualified;
  return qualified.slice(dot + 1);
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

/**
 * 0.16.0: targeted incremental update for watch mode. Given a graph and a
 * list of repo-relative paths that may have changed (added, modified, or
 * deleted), update the graph in place: re-stat each path, re-parse changed
 * ones, drop deleted ones, and fix up the cross-file derived indexes
 * (`localImporters`, `packageImporters`, `symbolDefs`, per-function
 * `fanIn`).
 *
 * Returns the same `graph` reference. Cheap: O(changedPaths) for the parse
 * pass; the fan-in recomputation is O(graph.files) but it's a single
 * walk over already-parsed entries (no IO).
 *
 * `changedPaths` should be repo-relative (forward-slash). Files that don't
 * exist are treated as deletions; files that do exist are re-parsed.
 */
export async function incrementallyUpdateGraph(
  graph: CodeGraph,
  rootPath: string,
  changedPaths: string[],
): Promise<CodeGraph> {
  if (changedPaths.length === 0) return graph;

  // Per-adapter context. We re-prepare since changedPaths may include
  // manifest edits (pyproject.toml, go.mod) that would shift package roots.
  // Run once for the whole batch; cheap relative to parsing.
  const contextByAdapter = new Map<LanguageAdapter, LanguageResolveContext>();
  // We need a FileEntry-shaped argument for preparePackageRoots; build one
  // from the current graph plus the changed-path stat info as a stand-in.
  const fakeFiles: FileEntry[] = [...graph.files.values()].map((gf) => ({
    relativePath: gf.relativePath,
    absolutePath: path.resolve(rootPath, gf.relativePath),
    directory: path.dirname(gf.relativePath),
    extension: path.extname(gf.relativePath),
    sizeBytes: 0,
  }));
  for (const adapter of listAdapters()) {
    contextByAdapter.set(adapter, await adapter.preparePackageRoots(rootPath, fakeFiles));
  }

  // Step 1: re-parse or delete each changed path.
  await Promise.all(
    changedPaths.map(async (rel) => {
      const adapter = getAdapterFor(rel);
      if (!adapter) {
        // Not a parseable file (e.g. README). If we previously had it in the
        // graph drop the entry; otherwise nothing to do.
        if (graph.files.has(rel)) graph.files.delete(rel);
        return;
      }

      const abs = path.resolve(rootPath, rel);
      let mtimeMs: number;
      try {
        const stat = await fs.stat(abs);
        mtimeMs = stat.mtimeMs;
      } catch {
        // File doesn't exist anymore - treat as deletion.
        graph.files.delete(rel);
        // Strip its old contributions when we rebuild the indexes below.
        return;
      }

      let content: string;
      try {
        content = await fs.readFile(abs, 'utf-8');
      } catch {
        graph.files.delete(rel);
        return;
      }

      let result: AstResult;
      try {
        result = await adapter.parse(rel, content);
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

      graph.files.set(rel, {
        relativePath: rel,
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

  // Step 2: rebuild the cross-file derived indexes from scratch. The graph
  // is small relative to parse cost; rebuilding edges in O(N) keeps the
  // logic simple and correct (no orphan-edge bugs from in-place patching).
  graph.localImporters.clear();
  graph.packageImporters.clear();
  graph.symbolDefs.clear();

  for (const [importingFile, entry] of graph.files) {
    const adapter = getAdapterFor(importingFile);
    if (!adapter) continue;
    const context = contextByAdapter.get(adapter) ?? {};

    for (const imp of entry.imports) {
      const resolved = adapter.resolveImport(importingFile, imp.source, graph.files, context);
      if (resolved) {
        if (!graph.localImporters.has(resolved)) graph.localImporters.set(resolved, new Set());
        graph.localImporters.get(resolved)!.add(importingFile);
        continue;
      }
      const pkg = adapter.toPackageName(imp.source);
      if (pkg) {
        if (!graph.packageImporters.has(pkg)) graph.packageImporters.set(pkg, new Set());
        graph.packageImporters.get(pkg)!.add(importingFile);
      }
    }
    for (const exp of entry.exports) {
      if (!exp.name) continue;
      if (!graph.symbolDefs.has(exp.name)) graph.symbolDefs.set(exp.name, new Set());
      graph.symbolDefs.get(exp.name)!.add(importingFile);
    }
  }

  // Step 3: recompute per-function fan-in. Cheap: iterates files twice.
  const callerFilesByName = new Map<string, Set<string>>();
  for (const gf of graph.files.values()) {
    for (const name of gf.callSites ?? []) {
      let set = callerFilesByName.get(name);
      if (!set) {
        set = new Set();
        callerFilesByName.set(name, set);
      }
      set.add(gf.relativePath);
    }
  }
  for (const gf of graph.files.values()) {
    if (!gf.functions || gf.functions.length === 0) continue;
    for (const fn of gf.functions) {
      const bare = bareName(fn.name);
      const callers = callerFilesByName.get(bare);
      fn.fanIn = !callers ? 0 : callers.size - (callers.has(gf.relativePath) ? 1 : 0);
    }
  }

  graph.scannedFiles = graph.files.size;
  return graph;
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
