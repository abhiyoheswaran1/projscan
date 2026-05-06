import { describe, it, expect } from 'vitest';
import { mapWithConcurrency, DEFAULT_FILE_IO_CONCURRENCY } from '../../src/utils/concurrency.js';

describe('mapWithConcurrency', () => {
  it('returns results in input order', async () => {
    const result = await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => n * 10);
    expect(result).toEqual([10, 20, 30, 40, 50]);
  });

  it('passes the index to fn', async () => {
    const result = await mapWithConcurrency(['a', 'b', 'c'], 2, async (s, i) => `${s}${i}`);
    expect(result).toEqual(['a0', 'b1', 'c2']);
  });

  it('caps in-flight tasks at the concurrency limit', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    const items = Array.from({ length: 50 }, (_, i) => i);
    const concurrency = 5;
    await mapWithConcurrency(items, concurrency, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      // Yield so other tasks in the same batch can run in parallel.
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
    });
    // Across all batches, the peak in-flight count must never exceed the
    // limit. The chunked-batch impl can only have `concurrency` tasks
    // running at once.
    expect(maxInFlight).toBeLessThanOrEqual(concurrency);
  });

  it('handles empty input', async () => {
    const result = await mapWithConcurrency([], 4, async (x) => x);
    expect(result).toEqual([]);
  });

  it('treats concurrency <= 0 as 1 (sequential)', async () => {
    let maxInFlight = 0;
    let inFlight = 0;
    await mapWithConcurrency([1, 2, 3], 0, async () => {
      inFlight++;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 1));
      inFlight--;
    });
    expect(maxInFlight).toBe(1);
  });

  it('propagates errors from a task in a batch', async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error('boom on 2');
        return n;
      }),
    ).rejects.toThrow('boom on 2');
  });

  it('exposes a sensible DEFAULT_FILE_IO_CONCURRENCY value', () => {
    // Tunable, but should be conservative enough that the macOS default
    // ulimit (256) isn't immediately blown by ONE projscan call. 128 has
    // been the default since 1.6.2.
    expect(DEFAULT_FILE_IO_CONCURRENCY).toBeGreaterThan(0);
    expect(DEFAULT_FILE_IO_CONCURRENCY).toBeLessThanOrEqual(256);
  });
});
