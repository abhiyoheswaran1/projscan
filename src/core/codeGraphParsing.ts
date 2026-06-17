import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../types.js';
import type { AstResult } from './ast.js';
import type { LanguageAdapter } from './languages/LanguageAdapter.js';
import { getAdapterFor } from './languages/registry.js';
import type { CodeGraph, GraphFile } from './codeGraphTypes.js';

/**
 * Parse one file into a graph entry, honoring the previous graph's
 * mtime cache. Returns null when the file cannot be stat'd or read
 * (treat as missing). Adapter parse errors do NOT skip — we record an
 * `ok: false` entry so callers can see what failed.
 */
export async function parseFileToGraphEntry(
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

/**
 * Re-parse one changed path, OR drop it from the graph if it's been
 * deleted / become unreadable / is no longer parseable. Mutates graph
 * in place.
 */
export async function processChangedPath(
  graph: CodeGraph,
  rootPath: string,
  rel: string,
): Promise<void> {
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

/** Run the adapter's parse and convert any throw into an `ok: false` AstResult. */
export async function safeAdapterParse(
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

export function graphFileFromResult(
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
    adapterId,
  };
}
