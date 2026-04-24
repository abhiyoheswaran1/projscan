import fs from 'node:fs/promises';
import path from 'node:path';
import type { CodeGraph, GraphFile } from './codeGraph.js';

const CACHE_DIR = '.projscan-cache';
const CACHE_FILE = 'graph.json';
// v2: added `adapterId` to entries for multi-language routing. v1 caches are
// discarded on load so a file that switched adapters can't reuse a stale parse.
const CACHE_VERSION = 2;

interface SerializedGraph {
  version: number;
  rootPath: string;
  files: Array<{
    relativePath: string;
    imports: GraphFile['imports'];
    exports: GraphFile['exports'];
    callSites: string[];
    lineCount: number;
    mtimeMs: number;
    parseOk: boolean;
    parseReason?: string;
    adapterId?: string;
  }>;
  createdAt: string;
}

/**
 * Load a previously cached code graph, if present and valid. Returns undefined
 * when there's no cache or the cache is incompatible - caller should rebuild.
 */
export async function loadCachedGraph(rootPath: string): Promise<CodeGraph | undefined> {
  const cachePath = path.join(rootPath, CACHE_DIR, CACHE_FILE);
  let raw: string;
  try {
    raw = await fs.readFile(cachePath, 'utf-8');
  } catch {
    return undefined;
  }

  let parsed: SerializedGraph;
  try {
    parsed = JSON.parse(raw) as SerializedGraph;
  } catch {
    return undefined;
  }

  if (parsed.version !== CACHE_VERSION) return undefined;

  const files = new Map<string, GraphFile>();
  for (const entry of parsed.files) {
    files.set(entry.relativePath, {
      relativePath: entry.relativePath,
      imports: entry.imports,
      exports: entry.exports,
      callSites: entry.callSites,
      lineCount: entry.lineCount,
      mtimeMs: entry.mtimeMs,
      parseOk: entry.parseOk,
      parseReason: entry.parseReason,
      adapterId: entry.adapterId,
    });
  }

  // Derived indexes are rebuilt on load - cheap compared to re-parsing.
  // Return a partial graph the caller will rehydrate via buildCodeGraph.
  return {
    files,
    packageImporters: new Map(),
    localImporters: new Map(),
    symbolDefs: new Map(),
    scannedFiles: files.size,
  };
}

/**
 * Persist the graph. Creates .projscan-cache/ if needed. Swallows errors -
 * caching is best-effort, never blocks a run.
 */
export async function saveCachedGraph(rootPath: string, graph: CodeGraph): Promise<void> {
  const dir = path.join(rootPath, CACHE_DIR);
  try {
    await fs.mkdir(dir, { recursive: true });
  } catch {
    return;
  }

  const payload: SerializedGraph = {
    version: CACHE_VERSION,
    rootPath,
    files: [...graph.files.values()].map((entry) => ({
      relativePath: entry.relativePath,
      imports: entry.imports,
      exports: entry.exports,
      callSites: entry.callSites,
      lineCount: entry.lineCount,
      mtimeMs: entry.mtimeMs,
      parseOk: entry.parseOk,
      parseReason: entry.parseReason,
      adapterId: entry.adapterId,
    })),
    createdAt: new Date().toISOString(),
  };

  try {
    await fs.writeFile(
      path.join(dir, CACHE_FILE),
      JSON.stringify(payload),
      'utf-8',
    );
    // Ensure users don't accidentally commit the cache.
    const gitignorePath = path.join(dir, '.gitignore');
    await fs.writeFile(gitignorePath, '*\n', 'utf-8');
  } catch {
    // ignore - cache is best-effort
  }
}

export async function invalidateCache(rootPath: string): Promise<void> {
  const cachePath = path.join(rootPath, CACHE_DIR, CACHE_FILE);
  try {
    await fs.unlink(cachePath);
  } catch {
    // ignore
  }
}
