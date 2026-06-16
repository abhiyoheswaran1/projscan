import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FileEntry } from '../types.js';
import type { CodeGraph } from './codeGraph.js';
import {
  embedBatch,
  embedText,
  cosineSimilarity,
  isSemanticAvailable,
  DEFAULT_MODEL,
  EMBEDDING_DIM,
} from './embeddings.js';

/**
 * Semantic search over source files.
 *
 * Two modes:
 *   - File-level (v1, default): one embedding per file. Input is the path
 *     plus the first 4KB of content. Good enough for "which file
 *     implements X?".
 *   - Sub-file / per-function (v2, opt-in via `subFile: true` + a graph
 *     that has `functions` populated): one embedding per function. Input is
 *     the function's source range (capped at 4KB). Cache key is
 *     `<file>#<fn-name>`, so editing one function does not re-embed
 *     siblings. Files without function-level info still get a file-level
 *     embedding, so coverage is uniform.
 *
 * Cache persisted to .projscan-cache/embeddings.bin, keyed by composite key
 * + model + content hash + mtime. Invalidates on any of those changing.
 *
 * v1 → v2: cache schema change to support composite keys and optional
 * function-context. v1 caches are discarded silently and rebuilt on first
 * 0.15 run.
 */

const CACHE_DIR = '.projscan-cache';
const CACHE_FILE = 'embeddings.bin';
const CACHE_VERSION = 2;

const MAX_FILE_BYTES_FOR_EMBED = 4 * 1024;
const MAX_FILE_SIZE = 512 * 1024;

const INDEXABLE_EXTS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.cts',
  '.py',
  '.go',
  '.rb',
  '.java',
  '.rs',
  '.php',
  '.md',
  '.mdx',
]);

export interface SemanticEntry {
  /**
   * Composite key. Equals `relativePath` for file-level entries; equals
   * `<relativePath>#<function-name>` for sub-file entries. Used as the
   * `entries` Map key.
   */
  key: string;
  relativePath: string;
  /**
   * Function context, present only on sub-file entries. Lets search hits
   * point at the matched function's line range without a second lookup.
   */
  function?: { name: string; startLine: number; endLine: number };
  contentHash: string;
  mtimeMs: number;
  vector: Float32Array;
}

export interface SemanticIndex {
  model: string;
  dim: number;
  entries: Map<string, SemanticEntry>;
}

export interface BuildOptions {
  model?: string;
  rebuild?: boolean;
  onProgress?: (done: number, total: number, message?: string) => void;
  onFirstLoad?: (message: string) => void;
  /**
   * 0.15.0+: when true and `graph` is provided, chunk source files by
   * function boundary and emit one embedding per function (plus one
   * file-level embedding for files with no extracted functions). Default
   * false (file-level only - backward compatible).
   */
  subFile?: boolean;
  /**
   * 0.15.0+: optional code graph. Required for `subFile: true`; ignored
   * otherwise. Provides the per-function line ranges used for chunk
   * extraction.
   */
  graph?: CodeGraph;
}

export interface SemanticHit {
  file: string;
  score: number;
  /** Function context when the hit came from a sub-file chunk. */
  function?: { name: string; startLine: number; endLine: number };
}

/**
 * One chunk descriptor produced by `buildChunks`. Chunks are the unit of
 * embedding: one embedding per chunk. Exported for testing - allows
 * verifying chunk extraction without needing the embedding model.
 */
export interface SemanticChunk {
  key: string;
  relativePath: string;
  function?: { name: string; startLine: number; endLine: number };
  text: string;
  hash: string;
  mtimeMs: number;
}

/**
 * Produce embedding chunk descriptors for the indexable files. Pure-ish:
 * does file IO but no embedding work. Exported so tests can verify chunk
 * extraction without invoking the embedding model.
 *
 * Behavior:
 *   - File-level (default, or `subFile: false`, or no graph): one chunk
 *     per file. Key = relativePath. Text = `<file>\n\n<first 4KB>`.
 *   - Sub-file (`subFile: true` + graph): one chunk per function, plus
 *     one file-level chunk for files where the graph reports no
 *     functions. Per-function chunk key = `<file>#<fn-name>`. Text =
 *     `<file>#<fn-name> (lines a-b)\n\n<extracted lines>` (capped at 4KB).
 */
export async function buildChunks(
  rootPath: string,
  files: FileEntry[],
  options: BuildOptions = {},
): Promise<SemanticChunk[]> {
  const indexable = files.filter(
    (f) => INDEXABLE_EXTS.has(f.extension) && f.sizeBytes <= MAX_FILE_SIZE,
  );
  const useSubFile = options.subFile === true && options.graph !== undefined;
  const chunks: SemanticChunk[] = [];

  for (const file of indexable) {
    const abs = path.isAbsolute(file.absolutePath)
      ? file.absolutePath
      : path.resolve(rootPath, file.relativePath);
    let content: string;
    try {
      content = await fs.readFile(abs, 'utf-8');
    } catch {
      continue;
    }
    let mtimeMs = 0;
    try {
      const stat = await fs.stat(abs);
      mtimeMs = stat.mtimeMs;
    } catch {
      // ignore
    }

    if (useSubFile) {
      const gf = options.graph!.files.get(file.relativePath);
      const fns = gf?.functions ?? [];
      if (fns.length > 0) {
        const lines = content.split('\n');
        for (const fn of fns) {
          const start = Math.max(1, fn.line);
          const end = Math.max(start, fn.endLine);
          const slice = lines
            .slice(start - 1, end)
            .join('\n')
            .slice(0, MAX_FILE_BYTES_FOR_EMBED);
          const text = `${file.relativePath}#${fn.name} (lines ${start}-${end})\n\n${slice}`;
          const hash = sha256(text);
          chunks.push({
            key: `${file.relativePath}#${fn.name}`,
            relativePath: file.relativePath,
            function: { name: fn.name, startLine: start, endLine: end },
            text,
            hash,
            mtimeMs,
          });
        }
        continue;
      }
      // Fall through to file-level when the file has no extracted functions
      // (e.g. config files, README, type-only modules).
    }

    const text = `${file.relativePath}\n\n${content.slice(0, MAX_FILE_BYTES_FOR_EMBED)}`;
    const hash = sha256(text);
    chunks.push({
      key: file.relativePath,
      relativePath: file.relativePath,
      text,
      hash,
      mtimeMs,
    });
  }

  return chunks;
}

/**
 * Build (or refresh) a semantic index. Reuses cached embeddings for files
 * whose mtime AND content hash match - both guards are necessary because
 * git checkouts can preserve mtime while swapping content.
 *
 * Returns null if the peer dep isn't available.
 */
export async function buildSemanticIndex(
  rootPath: string,
  files: FileEntry[],
  options: BuildOptions = {},
): Promise<SemanticIndex | null> {
  const available = await isSemanticAvailable();
  if (!available) return null;

  const model = options.model ?? DEFAULT_MODEL;
  const cached = options.rebuild ? null : await loadCache(rootPath, model);
  const entries = cached?.entries ?? new Map<string, SemanticEntry>();

  const chunks = await buildChunks(rootPath, files, options);

  // Determine which chunks still need embedding (cache hit when key + hash + mtime match).
  const toEmbed: SemanticChunk[] = [];
  const keep = new Set<string>();
  for (const chunk of chunks) {
    keep.add(chunk.key);
    const existing = entries.get(chunk.key);
    if (existing && existing.contentHash === chunk.hash && existing.mtimeMs === chunk.mtimeMs) {
      continue;
    }
    toEmbed.push(chunk);
  }
  for (const key of [...entries.keys()]) {
    if (!keep.has(key)) entries.delete(key);
  }

  if (toEmbed.length === 0) {
    return { model, dim: cached?.dim ?? EMBEDDING_DIM, entries };
  }

  options.onProgress?.(0, toEmbed.length, 'embedding chunks');

  const BATCH = 32;
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const slice = toEmbed.slice(i, i + BATCH);
    const vectors = await embedBatch(
      slice.map((s) => s.text),
      { model, onFirstLoad: options.onFirstLoad },
    );
    if (!vectors) {
      process.stderr.write(
        `[projscan] semantic index build aborted at batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(toEmbed.length / BATCH)} (peer dep became unavailable)\n`,
      );
      return null;
    }

    for (let j = 0; j < slice.length; j++) {
      const s = slice[j];
      entries.set(s.key, {
        key: s.key,
        relativePath: s.relativePath,
        function: s.function,
        contentHash: s.hash,
        mtimeMs: s.mtimeMs,
        vector: vectors[j],
      });
    }
    options.onProgress?.(Math.min(i + BATCH, toEmbed.length), toEmbed.length);
  }

  const index: SemanticIndex = {
    model,
    dim: EMBEDDING_DIM,
    entries,
  };

  await saveCache(rootPath, index).catch(() => {
    // best-effort - don't fail the search if cache write fails
  });

  return index;
}

/**
 * Query a semantic index. Returns top-K hits by cosine similarity. Hits
 * carry `function` context when matched against a sub-file chunk.
 * Returns an empty array if the index is empty.
 */
export async function semanticSearch(
  index: SemanticIndex,
  query: string,
  options: { limit?: number; onFirstLoad?: (m: string) => void } = {},
): Promise<SemanticHit[]> {
  if (index.entries.size === 0) return [];
  const vector = await embedText(query, { model: index.model, onFirstLoad: options.onFirstLoad });
  if (!vector) return [];

  const limit = Math.max(1, Math.min(500, options.limit ?? 20));
  const scored: SemanticHit[] = [];
  for (const entry of index.entries.values()) {
    const score = cosineSimilarity(vector, entry.vector);
    const hit: SemanticHit = {
      file: entry.relativePath,
      score: Math.round(score * 1000) / 1000,
    };
    if (entry.function) hit.function = entry.function;
    scored.push(hit);
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

// ── Cache ─────────────────────────────────────────────────

interface CachePayload {
  version: number;
  model: string;
  dim: number;
  entries: Array<{
    key: string;
    relativePath: string;
    function?: { name: string; startLine: number; endLine: number };
    contentHash: string;
    mtimeMs: number;
    vector: number[];
  }>;
}

async function loadCache(rootPath: string, expectedModel: string): Promise<SemanticIndex | null> {
  const cachePath = path.join(rootPath, CACHE_DIR, CACHE_FILE);
  let raw: string;
  try {
    raw = await fs.readFile(cachePath, 'utf-8');
  } catch {
    return null;
  }

  let parsed: CachePayload;
  try {
    parsed = JSON.parse(raw) as CachePayload;
  } catch {
    return null;
  }

  if (parsed.version !== CACHE_VERSION || parsed.model !== expectedModel) return null;

  const entries = new Map<string, SemanticEntry>();
  for (const e of parsed.entries) {
    entries.set(e.key, {
      key: e.key,
      relativePath: e.relativePath,
      function: e.function,
      contentHash: e.contentHash,
      mtimeMs: e.mtimeMs,
      vector: new Float32Array(e.vector),
    });
  }
  return { model: parsed.model, dim: parsed.dim, entries };
}

async function saveCache(rootPath: string, index: SemanticIndex): Promise<void> {
  const dir = path.join(rootPath, CACHE_DIR);
  await fs.mkdir(dir, { recursive: true });
  const payload: CachePayload = {
    version: CACHE_VERSION,
    model: index.model,
    dim: index.dim,
    entries: [...index.entries.values()].map((e) => ({
      key: e.key,
      relativePath: e.relativePath,
      function: e.function,
      contentHash: e.contentHash,
      mtimeMs: e.mtimeMs,
      vector: [...e.vector],
    })),
  };
  await fs.writeFile(path.join(dir, CACHE_FILE), JSON.stringify(payload), 'utf-8');
}

function sha256(s: string): string {
  return crypto.createHash('sha256').update(s).digest('hex').slice(0, 16);
}

// ── Hybrid ranking ────────────────────────────────────────

/**
 * Reciprocal Rank Fusion (RRF) combines two ranked lists into one. Well-
 * established way to merge lexical (BM25) and semantic results without
 * needing to calibrate scale between the two scoring systems.
 *
 *   score(doc) = sum over lists L of 1 / (k + rank_L(doc))
 *
 * k = 60 is the standard constant.
 */
export function reciprocalRankFusion(
  lists: Array<Array<{ file: string }>>,
  k = 60,
): Array<{ file: string; score: number }> {
  const scores = new Map<string, number>();
  for (const list of lists) {
    for (let rank = 0; rank < list.length; rank++) {
      const file = list[rank].file;
      const contribution = 1 / (k + rank + 1);
      scores.set(file, (scores.get(file) ?? 0) + contribution);
    }
  }
  return [...scores.entries()]
    .map(([file, score]) => ({ file, score: Math.round(score * 10000) / 10000 }))
    .sort((a, b) => b.score - a.score);
}
