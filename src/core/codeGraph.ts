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
  const contextByAdapter = await prepareAdapterContexts(rootPath, files);
  const parseable = files
    .map((f) => ({ file: f, adapter: getAdapterFor(f.relativePath) }))
    .filter(
      (x): x is { file: FileEntry; adapter: LanguageAdapter } =>
        !!x.adapter && x.file.sizeBytes <= (x.adapter.maxFileSize ?? MAX_FILE_SIZE),
    );

  const graphFiles = new Map<string, GraphFile>();
  await Promise.all(
    parseable.map(async ({ file, adapter }) => {
      const entry = await parseFileToGraphEntry(rootPath, file, adapter, previousGraph);
      if (entry) graphFiles.set(file.relativePath, entry);
    }),
  );

  const { localImporters, packageImporters, symbolDefs } = rebuildCrossFileIndexes(
    graphFiles,
    contextByAdapter,
  );
  computeFanIn(graphFiles);
  computeFanOut(graphFiles);

  return {
    files: graphFiles,
    packageImporters,
    localImporters,
    symbolDefs,
    scannedFiles: graphFiles.size,
  };
}

/**
 * Per-adapter setup (e.g. Python package-root detection from
 * pyproject.toml, Rust workspace detection from Cargo.toml). Run once
 * per graph build; cheap relative to parsing.
 */
async function prepareAdapterContexts(
  rootPath: string,
  files: FileEntry[],
): Promise<Map<LanguageAdapter, LanguageResolveContext>> {
  const contextByAdapter = new Map<LanguageAdapter, LanguageResolveContext>();
  for (const adapter of listAdapters()) {
    contextByAdapter.set(adapter, await adapter.preparePackageRoots(rootPath, files));
  }
  return contextByAdapter;
}

/**
 * Parse one file into a graph entry, honoring the previous graph's
 * mtime cache. Returns null when the file cannot be stat'd or read
 * (treat as missing). Adapter parse errors do NOT skip — we record an
 * `ok: false` entry so callers can see what failed.
 */
async function parseFileToGraphEntry(
  rootPath: string,
  file: FileEntry,
  adapter: LanguageAdapter,
  previousGraph: CodeGraph | undefined,
): Promise<GraphFile | null> {
  const absolutePath = path.isAbsolute(file.absolutePath)
    ? file.absolutePath
    : path.resolve(rootPath, file.relativePath);

  let mtimeMs: number;
  try {
    const stat = await fs.stat(absolutePath);
    mtimeMs = stat.mtimeMs;
  } catch {
    return null;
  }

  const cached = previousGraph?.files.get(file.relativePath);
  if (cached && cached.mtimeMs === mtimeMs && cached.adapterId === adapter.id) {
    return cached;
  }

  let content: string;
  try {
    content = await fs.readFile(absolutePath, 'utf-8');
  } catch {
    return null;
  }

  const result = await safeAdapterParse(adapter, file.relativePath, content);
  return graphFileFromResult(file.relativePath, adapter.id, result, mtimeMs);
}

/** Run the adapter's parse and convert any throw into an `ok: false` AstResult. */
async function safeAdapterParse(
  adapter: LanguageAdapter,
  relativePath: string,
  content: string,
): Promise<AstResult> {
  try {
    return await adapter.parse(relativePath, content);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
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
}

function graphFileFromResult(
  relativePath: string,
  adapterId: string,
  result: AstResult,
  mtimeMs: number,
): GraphFile {
  return {
    relativePath,
    imports: result.imports,
    exports: result.exports,
    callSites: result.callSites,
    lineCount: result.lineCount,
    cyclomaticComplexity: result.cyclomaticComplexity,
    functions: result.functions ?? [],
    mtimeMs,
    parseOk: result.ok,
    parseReason: result.reason,
    adapterId: adapterId as GraphFile['adapterId'],
  };
}

/**
 * Rebuild the three cross-file derived indexes from scratch:
 *   - localImporters: target file → set of files importing it
 *   - packageImporters: package name → set of files importing it
 *   - symbolDefs: exported name → set of files defining it
 *
 * Each adapter gets a shot at local resolution first (matters for
 * Python's `pkg.core` which may be local OR third-party); falls back
 * to package-name classification.
 */
function rebuildCrossFileIndexes(
  graphFiles: Map<string, GraphFile>,
  contextByAdapter: Map<LanguageAdapter, LanguageResolveContext>,
): {
  localImporters: Map<string, Set<string>>;
  packageImporters: Map<string, Set<string>>;
  symbolDefs: Map<string, Set<string>>;
} {
  const localImporters = new Map<string, Set<string>>();
  const packageImporters = new Map<string, Set<string>>();
  const symbolDefs = new Map<string, Set<string>>();

  for (const [importingFile, entry] of graphFiles) {
    const adapter = getAdapterFor(importingFile);
    if (!adapter) continue;
    const context = contextByAdapter.get(adapter) ?? {};

    for (const imp of entry.imports) {
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

  return { localImporters, packageImporters, symbolDefs };
}

/**
 * 0.15.0+ — per-function fan-in. For each function name across the
 * graph, count how many OTHER files include the name in their
 * `callSites`. Mutates `functions[*].fanIn` in place. Approximate:
 * shared names across files attribute to every definition.
 */
function computeFanIn(graphFiles: Map<string, GraphFile>): void {
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
      // Subtract self if the function's own file appears in the caller
      // set (self-call from within the same file).
      fn.fanIn = !callers ? 0 : callers.size - (callers.has(gf.relativePath) ? 1 : 0);
    }
  }
}

/**
 * 1.2.0+ — per-function fan-out. For each function with per-function
 * callSites, count how many distinct callee names match a function
 * defined SOMEWHERE in the graph. Library / constructor / unknown
 * method calls drop — fan-out is "internal" coupling, not raw call
 * count. Mutates `functions[*].fanOut` in place.
 */
function computeFanOut(graphFiles: Map<string, GraphFile>): void {
  const definedNames = new Set<string>();
  for (const gf of graphFiles.values()) {
    if (!gf.functions) continue;
    for (const fn of gf.functions) definedNames.add(bareName(fn.name));
  }
  for (const gf of graphFiles.values()) {
    if (!gf.functions || gf.functions.length === 0) continue;
    for (const fn of gf.functions) {
      if (!fn.callSites) {
        fn.fanOut = 0;
        continue;
      }
      let count = 0;
      const seen = new Set<string>();
      for (const callee of fn.callSites) {
        if (seen.has(callee)) continue;
        seen.add(callee);
        if (callee === bareName(fn.name)) continue; // self-recursion
        if (definedNames.has(callee)) count++;
      }
      fn.fanOut = count;
    }
  }
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

  const contextByAdapter = await prepareAdapterContexts(rootPath, fakeFilesFromGraph(graph, rootPath));
  await Promise.all(changedPaths.map((rel) => processChangedPath(graph, rootPath, rel)));
  rebuildIndexesIntoGraph(graph, contextByAdapter);
  computeFanIn(graph.files);
  computeFanOut(graph.files);
  graph.scannedFiles = graph.files.size;
  return graph;
}

/**
 * Build a FileEntry[]-shaped stand-in from the current graph, used as
 * the input to `preparePackageRoots` during incremental update — the
 * adapters need a complete view of repo layout to detect manifest
 * edits (pyproject.toml, go.mod) that would shift package roots.
 */
function fakeFilesFromGraph(graph: CodeGraph, rootPath: string): FileEntry[] {
  return [...graph.files.values()].map((gf) => ({
    relativePath: gf.relativePath,
    absolutePath: path.resolve(rootPath, gf.relativePath),
    directory: path.dirname(gf.relativePath),
    extension: path.extname(gf.relativePath),
    sizeBytes: 0,
  }));
}

/**
 * Re-parse one changed path, OR drop it from the graph if it's been
 * deleted / become unreadable / is no longer parseable. Mutates graph
 * in place.
 */
async function processChangedPath(graph: CodeGraph, rootPath: string, rel: string): Promise<void> {
  const adapter = getAdapterFor(rel);
  if (!adapter) {
    // Not a parseable file (e.g. README). Drop any prior entry; otherwise no-op.
    if (graph.files.has(rel)) graph.files.delete(rel);
    return;
  }

  const abs = path.resolve(rootPath, rel);
  let mtimeMs: number;
  try {
    const stat = await fs.stat(abs);
    mtimeMs = stat.mtimeMs;
  } catch {
    graph.files.delete(rel);
    return;
  }

  let content: string;
  try {
    content = await fs.readFile(abs, 'utf-8');
  } catch {
    graph.files.delete(rel);
    return;
  }

  const result = await safeAdapterParse(adapter, rel, content);
  graph.files.set(rel, graphFileFromResult(rel, adapter.id, result, mtimeMs));
}

/**
 * Rebuild the graph's cross-file indexes in place — clear, then refill
 * from scratch. The graph is small relative to parse cost so rebuilding
 * edges in O(N) keeps the logic simple and avoids orphan-edge bugs from
 * in-place patching.
 */
function rebuildIndexesIntoGraph(
  graph: CodeGraph,
  contextByAdapter: Map<LanguageAdapter, LanguageResolveContext>,
): void {
  const { localImporters, packageImporters, symbolDefs } = rebuildCrossFileIndexes(
    graph.files,
    contextByAdapter,
  );
  graph.localImporters.clear();
  for (const [k, v] of localImporters) graph.localImporters.set(k, v);
  graph.packageImporters.clear();
  for (const [k, v] of packageImporters) graph.packageImporters.set(k, v);
  graph.symbolDefs.clear();
  for (const [k, v] of symbolDefs) graph.symbolDefs.set(k, v);
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
