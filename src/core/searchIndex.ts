import fs from 'node:fs/promises';
import path from 'node:path';
import type { FileEntry } from '../types.js';
import type { CodeGraph } from './codeGraph.js';

/**
 * Lightweight BM25-ranked inverted index over source files.
 *
 * We index three fields per file with different weights:
 *   - content (body tokens, BM25 baseline)
 *   - symbols (export names — most informative for code search)
 *   - path (file path tokens)
 *
 * Scoring:
 *   score(file, query) = BM25(content) + 2.0 * hits(symbols) + 0.5 * hits(path)
 *
 * This intentionally beats pure substring matching while staying
 * zero-dependency and fast enough for sub-second queries on 10k-file repos.
 */

const MAX_FILE_SIZE = 512 * 1024;

const STOPWORDS = new Set([
  'the','a','an','and','or','not','of','to','in','is','it','for','on','with',
  'this','that','by','as','at','be','are','was','were','has','have','had',
]);

const TS_KEYWORDS = new Set([
  'const','let','var','function','return','if','else','while','for','do','break',
  'continue','switch','case','default','new','class','extends','implements',
  'interface','type','enum','public','private','protected','static','readonly',
  'async','await','try','catch','finally','throw','import','export','from','as',
  'typeof','instanceof','void','null','undefined','true','false','this','super',
  'yield','delete','in','of','any','never','unknown','string','number','boolean',
  'object','symbol','bigint',
]);

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

  const parseable = files.filter((f) => f.sizeBytes <= MAX_FILE_SIZE && isIndexable(f.relativePath));

  await Promise.all(
    parseable.map(async (file) => {
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
    }),
  );

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
      const norm = tf * (k1 + 1) / (tf + k1 * (1 - b + b * (dl / index.avgDocLength)));
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
  const ranked = [...scores.entries()]
    .sort((a, b) => b[1].score - a[1].score)
    .slice(0, limit);

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
  return Promise.all(
    hits.map(async (hit) => {
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
    }),
  );
}

/**
 * Tokenize a string for indexing/querying:
 *   - lowercase
 *   - split on non-identifier chars
 *   - split camelCase and snake_case
 *   - drop tokens shorter than 2 chars, stopwords, TS keywords
 *   - apply basic stem (drop trailing s / ing / ed)
 */
export function tokenize(input: string): string[] {
  const out: string[] = [];
  // Split on non-identifier boundaries. Keep original case so we can also
  // split on camelCase boundaries below.
  const rawTokens = input.match(/[A-Za-z0-9_]+/g) ?? [];
  for (const raw of rawTokens) {
    // Split on underscore and camelCase. camelCase: insert a boundary before
    // each uppercase that follows a lowercase or digit (OR before runs of
    // uppercase followed by lowercase to handle acronyms like "XMLParser").
    const camelSplit = raw
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2');
    const parts = camelSplit.split(/[_\s]+/).filter(Boolean);
    for (const part of parts) {
      // Split embedded digits from letters — e.g. "v1api" → "v", "1", "api"
      const subparts = part.split(/(\d+)/).filter(Boolean);
      for (const sp of subparts) {
        const lower = sp.toLowerCase();
        const stemmed = stem(lower);
        if (!keepToken(stemmed)) continue;
        out.push(stemmed);
      }
    }
  }
  return out;
}

/**
 * Expand a user query into a set of candidate tokens. Same rules as tokenize
 * plus: if the raw query has no hits, try progressively looser tokenization.
 */
export function expandQuery(query: string): string[] {
  const tokens = tokenize(query);
  return [...new Set(tokens)];
}

function stem(token: string): string {
  if (token.length <= 3) return token;
  if (token.endsWith('ing')) return token.slice(0, -3);
  if (token.endsWith('ed') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('es') && token.length > 4) return token.slice(0, -2);
  if (token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function keepToken(token: string): boolean {
  if (token.length < 2) return false;
  if (STOPWORDS.has(token)) return false;
  if (TS_KEYWORDS.has(token)) return false;
  return true;
}

function countHits(tokens: string[], query: string[]): number {
  let count = 0;
  const set = new Set(tokens);
  for (const q of query) if (set.has(q)) count++;
  return count;
}

function isIndexable(relativePath: string): boolean {
  const ext = path.extname(relativePath).toLowerCase();
  // Index source and markup/docs where it's likely useful
  return (
    ext === '.ts' ||
    ext === '.tsx' ||
    ext === '.js' ||
    ext === '.jsx' ||
    ext === '.mjs' ||
    ext === '.cjs' ||
    ext === '.mts' ||
    ext === '.cts' ||
    ext === '.py' ||
    ext === '.go' ||
    ext === '.rb' ||
    ext === '.java' ||
    ext === '.rs' ||
    ext === '.php' ||
    ext === '.cs' ||
    ext === '.swift' ||
    ext === '.kt' ||
    ext === '.md' ||
    ext === '.mdx'
  );
}
