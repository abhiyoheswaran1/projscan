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
  /**
   * 1.10+ — await this to wait for any in-flight debounce flush to settle
   * after `close()`. `close()` itself is synchronous and stops new work,
   * but a flush already past its `closed` check would otherwise resolve
   * its onChange asynchronously after `close()` returned. Tests and
   * orderly-shutdown callers should `await handle.closed` after `close()`.
   */
  closed: Promise<void>;
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
  // 1.10+ — track the in-flight flush as a Promise instead of a bare bool
  // so close() can await it. Without this, a flush that was already past
  // its top-of-function `closed` check would still call options.onChange
  // *after* close() returned, leaving the downstream consumer seeing one
  // final stale event.
  let inFlightPromise: Promise<void> | null = null;

  const ready = (async () => {
    const scan = await scanRepository(rootPath);
    const cached = await loadCachedGraph(rootPath);
    graph = await buildCodeGraph(rootPath, scan.files, cached);
    await saveCachedGraph(rootPath, graph).catch(() => undefined);
    if (closed) return;
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
    if (closed || inFlightPromise || !graph) {
      // If a flush fires while one is already in flight, leave `pending`
      // intact - the next debounce will pick up the accumulated set plus
      // anything new.
      return;
    }
    if (pending.size === 0) return;
    const batch = [...pending];
    pending.clear();
    const currentGraph = graph;
    const promise = (async () => {
      try {
        // Tiny stat-retry: editors that delete-then-write can race the watcher.
        await sleep(STAT_RETRY_MS);
        await incrementallyUpdateGraph(currentGraph, rootPath, batch);
        await saveCachedGraph(rootPath, currentGraph).catch(() => undefined);
        // 1.10+ — guard against firing onChange after close(). close()
        // sets `closed` synchronously; we may have raced past the top-of-
        // function check while awaiting the graph update. The downstream
        // consumer has shut down; an event delivered now is a use-after-
        // free for them.
        if (!closed) {
          await options.onChange({ paths: batch, graph: currentGraph });
        }
      } finally {
        inFlightPromise = null;
        // If new events arrived while we were processing, schedule another flush.
        if (!closed && pending.size > 0) {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => void flush(), DEBOUNCE_MS);
        }
      }
    })();
    inFlightPromise = promise;
    return promise;
  }

  return {
    close: () => {
      closed = true;
      if (debounceTimer) clearTimeout(debounceTimer);
      if (watcher) watcher.close();
    },
    get closed(): Promise<void> {
      // Resolve once any in-flight flush has finished. The flush itself
      // checks `closed` before calling onChange so the downstream sees no
      // post-close event; this just lets shutdown callers await full quiet.
      return (async () => {
        // Wait for ready first so we don't miss the initial onChange in
        // tests that close() immediately after construction.
        await ready.catch(() => undefined);
        if (inFlightPromise) await inFlightPromise.catch(() => undefined);
      })();
    },
    ready,
  };
}

function shouldSkip(rel: string): boolean {
  if (rel.length === 0) return true;
  // 1.9+ — filter atomic-write tmp suffixes. atomicWriteFile creates
  // `<target>.projscan-tmp-<uuid>` siblings then renames; the watcher
  // would otherwise fire on the tmp file's creation, the rename, AND
  // the post-rename target, tripling debounce work. The actual target
  // file's rename event still fires (its name doesn't carry the
  // suffix), so we don't lose updates.
  if (rel.includes('.projscan-tmp-')) return true;
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
