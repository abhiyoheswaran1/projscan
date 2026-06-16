import { describe, expect, it } from 'vitest';
import { reportImpact } from '../../src/reporters/consoleImpactReporter.js';
import { reportImpact as reportImpactFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { ImpactReport } from '../../src/types.js';
import { captureStdout, stripAnsi } from './fixtures.js';

describe('consoleImpactReporter', () => {
  it('is re-exported from consoleReporter to preserve the public reporter API', () => {
    expect(reportImpactFromConsoleReporter).toBe(reportImpact);
  });

  it('prints unavailable impact output', async () => {
    const out = stripAnsi(
      await captureStdout(() =>
        reportImpact(makeImpact({ available: false, reason: 'graph unavailable' })),
      ),
    );

    expect(out).toContain('Impact');
    expect(out).toContain('graph unavailable');
  });

  it('prints symbol impact details, distance groups, and truncation', async () => {
    const out = stripAnsi(await captureStdout(() => reportImpact(makeImpact())));

    expect(out).toContain('Impact');
    expect(out).toContain('symbol: buildCodeGraph');
    expect(out).toContain('definitions: 2 · direct callers: 2');
    expect(out).toContain('Defined in:');
    expect(out).toContain('src/core/graph.ts');
    expect(out).toContain(
      '52 file(s) reachable within distance 3 (truncated; more files exist beyond)',
    );
    expect(out).toContain('Distance 1:');
    expect(out).toContain('src/caller-0.ts');
    expect(out).toContain('Distance 2:');
    expect(out).toContain('src/caller-20.ts');
    expect(out).toContain('... and 2 more');
  });

  it('prints no-reachable output', async () => {
    const out = stripAnsi(
      await captureStdout(() =>
        reportImpact(
          makeImpact({
            target: { kind: 'file', value: 'src/isolated.ts' },
            definitionFiles: [],
            directCallers: [],
            reachable: [],
            totalReachable: 0,
            truncated: false,
          }),
        ),
      ),
    );

    expect(out).toContain('file: src/isolated.ts');
    expect(out).toContain('0 file(s) reachable within distance 3');
    expect(out).toContain('No reachable files.');
    expect(out).not.toContain('Defined in:');
  });
});

function makeImpact(overrides: Partial<ImpactReport> = {}): ImpactReport {
  return {
    available: true,
    target: { kind: 'symbol', value: 'buildCodeGraph' },
    definitionFiles: ['src/core/graph.ts', 'src/core/ast.ts'],
    directCallers: ['src/cli/analyze.ts', 'src/core/review.ts'],
    reachable: Array.from({ length: 52 }, (_, index) => ({
      file: `src/caller-${index}.ts`,
      distance: index < 20 ? 1 : index < 40 ? 2 : 3,
    })),
    totalReachable: 52,
    maxDistance: 3,
    truncated: true,
    ...overrides,
  };
}
