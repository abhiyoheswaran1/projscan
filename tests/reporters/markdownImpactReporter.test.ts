import { describe, expect, it } from 'vitest';
import { reportImpactMarkdown } from '../../src/reporters/markdownImpactReporter.js';
import { reportImpactMarkdown as reportImpactMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import type { ImpactReport } from '../../src/types.js';
import { captureStdout } from './fixtures.js';

describe('markdownImpactReporter', () => {
  it('is re-exported from markdownReporter to preserve the public reporter API', () => {
    expect(reportImpactMarkdownFromMarkdownReporter).toBe(reportImpactMarkdown);
  });

  it('prints unavailable impact output', async () => {
    const out = await captureStdout(() =>
      reportImpactMarkdown(makeImpact({ available: false, reason: 'graph unavailable' })),
    );

    expect(out).toContain('# Impact: symbol `buildCodeGraph`');
    expect(out).toContain('> graph unavailable');
  });

  it('prints symbol impact details, reachable files, and overflow rows', async () => {
    const out = await captureStdout(() => reportImpactMarkdown(makeImpact()));

    expect(out).toContain('# Impact: symbol `buildCodeGraph`');
    expect(out).toContain('_definitions: 2 · direct callers: 2_');
    expect(out).toContain('## Defined in');
    expect(out).toContain('- `src/core/graph.ts`');
    expect(out).toContain(
      '**203** file(s) reachable within distance 3 (truncated; more files exist beyond).',
    );
    expect(out).toContain('| Distance | File |');
    expect(out).toContain('| 1 | `src/caller-0.ts` |');
    expect(out).toContain('| 3 | `src/caller-199.ts` |');
    expect(out).toContain('_... and 3 more_');
  });

  it('prints no-reachable output for isolated files', async () => {
    const out = await captureStdout(() =>
      reportImpactMarkdown(
        makeImpact({
          target: { kind: 'file', value: 'src/isolated.ts' },
          definitionFiles: [],
          directCallers: [],
          reachable: [],
          totalReachable: 0,
          truncated: false,
        }),
      ),
    );

    expect(out).toContain('# Impact: file `src/isolated.ts`');
    expect(out).toContain('**0** file(s) reachable within distance 3.');
    expect(out).toContain('_No reachable files._');
    expect(out).not.toContain('## Defined in');
  });
});

function makeImpact(overrides: Partial<ImpactReport> = {}): ImpactReport {
  return {
    available: true,
    target: { kind: 'symbol', value: 'buildCodeGraph' },
    definitionFiles: ['src/core/graph.ts', 'src/core/ast.ts'],
    directCallers: ['src/cli/analyze.ts', 'src/core/review.ts'],
    reachable: Array.from({ length: 203 }, (_, index) => ({
      file: `src/caller-${index}.ts`,
      distance: index < 60 ? 1 : index < 140 ? 2 : 3,
    })),
    totalReachable: 203,
    maxDistance: 3,
    truncated: true,
    ...overrides,
  };
}
