import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../types.js';
import type { CodeGraph } from './codeGraph.js';
import { isSearchIndexableFile } from './searchIndexFiles.js';
import { countHits, expandQuery, tokenize } from './searchIndexText.js';
import { mapWithConcurrency, DEFAULT_FILE_IO_CONCURRENCY } from '../utils/concurrency.js';

export { expandQuery, tokenize };

/**
 * Lightweight BM25-ranked inverted index over source files.
 *
 * We index three fields per file with different weights:
 *   - content (body tokens, BM25 baseline)
 *   - symbols (export names - most informative for code search)
 *   - path (file path tokens)
 *
 * Scoring:
 *   score(file, query) = BM25(content) + 2.0 * hits(symbols) + 0.5 * hits(path)
 *
 * This intentionally beats pure substring matching while staying
 * zero-dependency and fast enough for sub-second queries on 10k-file repos.
 */

const MAX_FILE_SIZE = 512 * 1024;

export interface IndexedFile {
  relativePath: string;
  content: string[];
  symbols: string[];
  pathTokens: string[];
  length: number;
}

export interface SearchIndex {
  files: Map<string, IndexedFile>;
  /** token → map<file, count> */
  postings: Map<string, Map<string, number>>;
  /** average document length across indexed files */
  avgDocLength: number;
  /** total number of indexed documents */
  docCount: number;
}

export interface SearchHit {
  file: string;
  score: number;
  matched: string[];
  symbolMatch: boolean;
  pathMatch: boolean;
  excerpt: string;
  line: number;
  /**
   * Function context, set when the hit came from a sub-file semantic chunk
   * (0.15.0+). Absent for file-level / lexical hits.
   */
  function?: { name: string; startLine: number; endLine: number };
}

export interface SearchOptions {
  limit?: number;
  symbolWeight?: number;
  pathWeight?: number;
}

export async function buildSearchIndex(
  rootPath: string,
  files: FileEntry[],
  graph?: CodeGraph,
): Promise<SearchIndex> {
  const indexed = new Map<string, IndexedFile>();
  const postings = new Map<string, Map<string, number>>();

  const parseable = files.filter(
    (f) => f.sizeBytes <= MAX_FILE_SIZE && isSearchIndexableFile(f.relativePath),
  );

  // Bounded concurrency on file reads — avoids tripping the OS open-files
  // ulimit on large repos. See utils/concurrency.ts for the rationale.
  await mapWithConcurrency(parseable, DEFAULT_FILE_IO_CONCURRENCY, async (file) => {
    const abs = path.isAbsolute(file.absolutePath)
      ? file.absolutePath
      : path.resolve(rootPath, file.relativePath);
    let content: string;
    try {
      content = await fs.readFile(abs, 'utf-8');
    } catch {
      return;
    }

    const contentTokens = tokenize(content);
    const pathTokens = tokenize(file.relativePath);
    const symbols = (graph?.files.get(file.relativePath)?.exports ?? []).map((e) =>
      e.name.toLowerCase(),
    );

    const entry: IndexedFile = {
      relativePath: file.relativePath,
      content: contentTokens,
      symbols: symbols.flatMap((s) => tokenize(s)),
      pathTokens,
      length: contentTokens.length,
    };
    indexed.set(file.relativePath, entry);

    // Build postings from content tokens
    const termCounts = new Map<string, number>();
    for (const tok of contentTokens) {
      termCounts.set(tok, (termCounts.get(tok) ?? 0) + 1);
    }
    for (const [tok, count] of termCounts) {
      if (!postings.has(tok)) postings.set(tok, new Map());
      postings.get(tok)!.set(file.relativePath, count);
    }
  });

  const totalLength = [...indexed.values()].reduce((sum, f) => sum + f.length, 0);
  const avgDocLength = indexed.size > 0 ? totalLength / indexed.size : 1;

  return {
    files: indexed,
    postings,
    avgDocLength,
    docCount: indexed.size,
  };
}

export function search(
  index: SearchIndex,
  query: string,
  options: SearchOptions = {},
): SearchHit[] {
  const limit = Math.max(1, Math.min(500, options.limit ?? 30));
  const symbolWeight = options.symbolWeight ?? 2.0;
  const pathWeight = options.pathWeight ?? 0.5;

  const queryTokens = expandQuery(query);
  if (queryTokens.length === 0) return [];

  // BM25 parameters
  const k1 = 1.5;
  const b = 0.75;

  const scores = new Map<string, { score: number; matched: Set<string> }>();

  for (const qTok of queryTokens) {
    const postings = index.postings.get(qTok);
    if (!postings) continue;
    const df = postings.size;
    const idf = Math.log(1 + (index.docCount - df + 0.5) / (df + 0.5));

    for (const [file, tf] of postings) {
      const doc = index.files.get(file);
      if (!doc) continue;
      const dl = doc.length;
      const norm = (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * (dl / index.avgDocLength)));
      const bm25 = idf * norm;

      const existing = scores.get(file);
      if (existing) {
        existing.score += bm25;
        existing.matched.add(qTok);
      } else {
        scores.set(file, { score: bm25, matched: new Set([qTok]) });
      }
    }
  }

  // Apply symbol + path boosts
  for (const [file, entry] of index.files) {
    const symbolHits = countHits(entry.symbols, queryTokens);
    const pathHits = countHits(entry.pathTokens, queryTokens);
    if (symbolHits > 0 || pathHits > 0) {
      const current = scores.get(file) ?? { score: 0, matched: new Set<string>() };
      current.score += symbolHits * symbolWeight + pathHits * pathWeight;
      for (const qt of queryTokens) {
        if (entry.symbols.includes(qt) || entry.pathTokens.includes(qt)) {
          current.matched.add(qt);
        }
      }
      scores.set(file, current);
    }
  }

  if (scores.size === 0) return [];

  // Sort by score, take top limit
  const ranked = [...scores.entries()].sort((a, b) => b[1].score - a[1].score).slice(0, limit);

  return ranked.map(([file, info]) => {
    const entry = index.files.get(file)!;
    const symbolMatch = queryTokens.some((t) => entry.symbols.includes(t));
    const pathMatch = queryTokens.some((t) => entry.pathTokens.includes(t));
    return {
      file,
      score: Math.round(info.score * 100) / 100,
      matched: [...info.matched],
      symbolMatch,
      pathMatch,
      excerpt: '',
      line: 0,
    };
  });
}

/**
 * Attach a one-line excerpt to each hit, reading the file to find the first
 * matching line. This is a separate pass to avoid paying the I/O cost when
 * the caller only wants paths (e.g., an agent filtering before fetching).
 */
export async function attachExcerpts(
  rootPath: string,
  hits: SearchHit[],
  queryTokens: string[],
): Promise<SearchHit[]> {
  const qLower = queryTokens.map((t) => t.toLowerCase());
  // Bounded concurrency on file reads — see utils/concurrency.ts.
  return mapWithConcurrency(hits, DEFAULT_FILE_IO_CONCURRENCY, async (hit) => {
    const abs = path.resolve(rootPath, hit.file);
    try {
      const content = await fs.readFile(abs, 'utf-8');
      const lines = content.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const lower = lines[i].toLowerCase();
        if (qLower.some((t) => lower.includes(t))) {
          return { ...hit, line: i + 1, excerpt: lines[i].trim().slice(0, 200) };
        }
      }
    } catch {
      // ignore
    }
    return hit;
  });
}
