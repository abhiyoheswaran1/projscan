import { describe, it, expect } from 'vitest';
import { withProgress, emitProgress } from '../../src/mcp/progress.js';

describe('progress context isolation under concurrency', () => {
  it('routes each concurrent withProgress call to its own emitter', async () => {
    const emittedA: Array<{ progress: number; message?: string }> = [];
    const emittedB: Array<{ progress: number; message?: string }> = [];

    const taskA = withProgress(
      (progress, _total, message) => emittedA.push({ progress, message }),
      async () => {
        emitProgress(1, 3, 'A: start');
        // Yield to allow B to run mid-A
        await new Promise((r) => setTimeout(r, 20));
        emitProgress(2, 3, 'A: middle');
        await new Promise((r) => setTimeout(r, 20));
        emitProgress(3, 3, 'A: end');
      },
    );

    const taskB = withProgress(
      (progress, _total, message) => emittedB.push({ progress, message }),
      async () => {
        // Run interleaved with A
        await new Promise((r) => setTimeout(r, 10));
        emitProgress(1, 2, 'B: start');
        await new Promise((r) => setTimeout(r, 20));
        emitProgress(2, 2, 'B: end');
      },
    );

    await Promise.all([taskA, taskB]);

    // Each emitter must have received ONLY its own task's events.
    expect(emittedA.map((e) => e.message)).toEqual(['A: start', 'A: middle', 'A: end']);
    expect(emittedB.map((e) => e.message)).toEqual(['B: start', 'B: end']);
  });

  it('emitProgress is a no-op outside any withProgress context', () => {
    // Should not throw.
    emitProgress(1, 2, 'outside');
    expect(true).toBe(true);
  });
});
