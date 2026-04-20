import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import type { FileEntry } from '../types.js';
import {
  embedBatch,
  embedText,
  cosineSimilarity,
  isSemanticAvailable,
  DEFAULT_MODEL,
  EMBEDDING_DIM,
} from './embeddings.js';

/**
 * File-level semantic search over source files.
 *
 * v1 design decisions:
 *   - One embedding per file. Sub-file (per-export, per-function) chunking
 *     is a bigger project; file-level is sufficient to answer "which file
 *     implements X?"
 *   - Input text is the first 4KB of the file (captures most semantic
 *     signal without blowing the context window of small embedding models).
 *   - Path is prepended as a weak signal: `<file>\n\n<content>`.
 *   - Cache persisted to .projscan-cache/embeddings.bin, keyed by
 *     (model, file mtime, content hash). Invalidates on any of those changing.
 */

const CACHE_DIR = '.projscan-cache';
const CACHE_FILE = 'embeddings.bin';
const CACHE_VERSION = 1;

const MAX_FILE_BYTES_FOR_EMBED = 4 * 1024;
const MAX_FILE_SIZE = 512 * 1024;

const INDEXABLE_EXTS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts',
  '.py', '.go', '.rb', '.java', '.rs', '.php',
  '.md', '.mdx',
]);

export interface SemanticEntry {
  relativePath: string;
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
}

export interface SemanticHit {
  file: string;
  score: number;
}

/**
 * Build (or refresh) a semantic index. Reuses cached embeddings for files
 * whose mtime AND content hash match — both guards are necessary because
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

  const indexable = files.filter(
    (f) => INDEXABLE_EXTS.has(f.extension) && f.sizeBytes <= MAX_FILE_SIZE,
  );

  // Determine which files still need embedding
  const toEmbed: Array<{ file: FileEntry; hash: string; text: string }> = [];
  const keep = new Set<string>();

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
    const text = `${file.relativePath}\n\n${content.slice(0, MAX_FILE_BYTES_FOR_EMBED)}`;
    const hash = sha256(text);
    const existing = entries.get(file.relativePath);

    let mtimeMs = 0;
    try {
      const stat = await fs.stat(abs);
      mtimeMs = stat.mtimeMs;
    } catch {
      // ignore
    }

    if (existing && existing.contentHash === hash && existing.mtimeMs === mtimeMs) {
      keep.add(file.relativePath);
      continue;
    }

    toEmbed.push({ file, hash, text });
    keep.add(file.relativePath);
  }

  // Drop cached entries for files that no longer exist
  for (const key of [...entries.keys()]) {
    if (!keep.has(key)) entries.delete(key);
  }

  if (toEmbed.length === 0) {
    return { model, dim: cached?.dim ?? EMBEDDING_DIM, entries };
  }

  options.onProgress?.(0, toEmbed.length, 'embedding files');

  // Batch embeddings in chunks of 32 to cap peak memory
  const BATCH = 32;
  for (let i = 0; i < toEmbed.length; i += BATCH) {
    const slice = toEmbed.slice(i, i + BATCH);
    const vectors = await embedBatch(
      slice.map((s) => s.text),
      { model, onFirstLoad: options.onFirstLoad },
    );
    if (!vectors) {
      // Peer loaded at start of the build but embedBatch now returns null.
      // This is rare (module unloaded, OOM, etc.); log to stderr so operators
      // can diagnose instead of silently losing the semantic capability.
      process.stderr.write(
        `[projscan] semantic index build aborted at batch ${Math.floor(i / BATCH) + 1}/${Math.ceil(toEmbed.length / BATCH)} (peer dep became unavailable)\n`,
      );
      return null;
    }

    for (let j = 0; j < slice.length; j++) {
      const s = slice[j];
      const abs = path.isAbsolute(s.file.absolutePath)
        ? s.file.absolutePath
        : path.resolve(rootPath, s.file.relativePath);
      let mtimeMs = 0;
      try {
        mtimeMs = (await fs.stat(abs)).mtimeMs;
      } catch {
        // ignore
      }
      entries.set(s.file.relativePath, {
        relativePath: s.file.relativePath,
        contentHash: s.hash,
        mtimeMs,
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
    // best-effort — don't fail the search if cache write fails
  });

  return index;
}

/**
 * Query a semantic index. Returns top-K files by cosine similarity.
 * Returns an empty array if no files are indexed.
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
    scored.push({ file: entry.relativePath, score: Math.round(score * 1000) / 1000 });
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
    relativePath: string;
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
    entries.set(e.relativePath, {
      relativePath: e.relativePath,
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
      relativePath: e.relativePath,
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
