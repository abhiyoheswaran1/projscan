/**
 * Bounded-concurrency map (1.6.2+). Like `Promise.all(items.map(fn))` but
 * caps the number of in-flight tasks. Used for I/O-heavy hot paths where
 * an unbounded `Promise.all` would open thousands of file descriptors at
 * once and trip the OS open-files ulimit (macOS default is 256).
 *
 * Implementation: a simple chunked-batch loop. Concurrency = batch size;
 * each batch awaits before the next starts. This is intentionally simpler
 * than a token-pool / p-limit-style queue — for our workloads (cold scan
 * of N files) the difference is negligible and the chunked form has zero
 * dependencies + obvious behavior.
 *
 * Returns results in the same order as the input. Errors propagate from
 * the first failing task within a batch (matches Promise.all semantics).
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const limit = Math.max(1, concurrency);
  if (items.length === 0) return [];
  const out = new Array<R>(items.length);
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    const results = await Promise.all(batch.map((item, j) => fn(item, i + j)));
    for (let j = 0; j < results.length; j++) {
      out[i + j] = results[j];
    }
  }
  return out;
}

/**
 * Sensible default for I/O-bound tasks. Well under macOS's 256 ulimit
 * with headroom for other open FDs (the parent process, the spawned git
 * subprocesses in PR review, etc.). Tunable per-call when a workload
 * has different needs.
 */
export const DEFAULT_FILE_IO_CONCURRENCY = 128;
