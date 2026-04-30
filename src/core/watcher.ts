import { watch as fsWatch, type FSWatcher } from 'node:fs';
import path from 'node:path';
import { scanRepository } from './repositoryScanner.js';
import { buildCodeGraph, incrementallyUpdateGraph, type CodeGraph } from './codeGraph.js';
import { loadCachedGraph, saveCachedGraph } from './indexCache.js';

const DEBOUNCE_MS = 200;
const STAT_RETRY_MS = 50;

const SKIP_DIRS = new Set([
  'node_modules', '.git', '.projscan-cache', '.bench-cache', 'dist', 'build',
  'coverage', '.cache', '.next', '.nuxt', '.svelte-kit', 'venv', '.venv',
  '__pycache__', '.tox', '.pytest_cache', '.mypy_cache', '.ruff_cache',
  '.eggs',
]);

export interface WatchEvent {
  /** Repo-relative paths reported as changed in this debounced batch. */
  paths: string[];
  /** The current graph (in-place updated). */
  graph: CodeGraph;
}

export interface WatchOptions {
  /** Called once for the initial graph build, then for each debounced batch. */
  onChange: (event: WatchEvent) => void | Promise<void>;
  /** Called once if `fs.watch` cannot be initialised. */
  onError?: (err: Error) => void;
}

export interface WatchHandle {
  close: () => void;
  /** Resolves once the initial scan + first onChange call have completed. */
  ready: Promise<void>;
}

/**
 * Start watching `rootPath` for source file changes. On change, debounce by
 * 200ms then run the incremental graph update and invoke `onChange`. The
 * caller decides what to do with each tick (re-run doctor, re-run hotspots,
 * emit MCP notifications, etc.).
 *
 * Uses node:fs.watch (built-in, no chokidar dep). Caveats:
 *   - On Linux, fs.watch in recursive mode requires Node 20+. We use
 *     recursive: true and rely on that minimum.
 *   - Some editors (vim, IntelliJ) atomically replace files; fs.watch
 *     reports those as 'rename' events. We treat both 'change' and
 *     'rename' as candidates and re-stat to decide if the file still exists.
 *   - Dotfiles and the gitignore noise list (node_modules, dist, etc.) are
 *     filtered out so editing one doesn't trigger a re-scan.
 *
 * Returns a `{close, ready}` handle. `ready` resolves when the initial
 * graph + first `onChange` call complete; close stops the watcher.
 */
export function startWatcher(rootPath: string, options: WatchOptions): WatchHandle {
  let watcher: FSWatcher | null = null;
  let debounceTimer: NodeJS.Timeout | null = null;
  const pending = new Set<string>();
  let graph: CodeGraph | null = null;
  let closed = false;
  let inFlight = false;

  const ready = (async () => {
    const scan = await scanRepository(rootPath);
    const cached = await loadCachedGraph(rootPath);
    graph = await buildCodeGraph(rootPath, scan.files, cached);
    await saveCachedGraph(rootPath, graph).catch(() => undefined);
    await options.onChange({ paths: [], graph });
  })();

  ready.then(() => {
    if (closed) return;
    try {
      watcher = fsWatch(rootPath, { recursive: true }, (_eventType, filename) => {
        if (!filename) return;
        const rel = filename.split(path.sep).join('/');
        if (shouldSkip(rel)) return;
        pending.add(rel);
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void flush(), DEBOUNCE_MS);
      });
      watcher.on('error', (err) => {
        options.onError?.(err);
      });
    } catch (err) {
      options.onError?.(err as Error);
    }
  });

  async function flush(): Promise<void> {
    if (closed || inFlight || !graph) {
      // If a flush fires while one is already in flight, leave `pending`
      // intact - the next debounce will pick up the accumulated set plus
      // anything new.
      return;
    }
    if (pending.size === 0) return;
    const batch = [...pending];
    pending.clear();
    inFlight = true;
    try {
      // Tiny stat-retry: editors that delete-then-write can race the watcher.
      await sleep(STAT_RETRY_MS);
      await incrementallyUpdateGraph(graph, rootPath, batch);
      await saveCachedGraph(rootPath, graph).catch(() => undefined);
      await options.onChange({ paths: batch, graph });
    } finally {
      inFlight = false;
      // If new events arrived while we were processing, schedule another flush.
      if (pending.size > 0) {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => void flush(), DEBOUNCE_MS);
      }
    }
  }

  return {
    close: () => {
      closed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (watcher) watcher.close();
    },
    ready,
  };
}

function shouldSkip(rel: string): boolean {
  if (rel.length === 0) return true;
  // Filter out hidden files and known noise directories anywhere in the path.
  const parts = rel.split('/');
  for (const part of parts) {
    if (SKIP_DIRS.has(part)) return true;
    // Dotfiles in any segment (e.g. .git, .projscan-cache, .DS_Store).
    if (part.startsWith('.') && part !== '.' && part !== '..') return true;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
