import { describe, it, expect } from 'vitest';
import { reportCouplingMarkdown } from '../../src/reporters/markdownCouplingReporter.js';
import { reportCouplingMarkdown as reportCouplingMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import type { CouplingReport } from '../../src/types.js';
import { captureStdout } from './fixtures.js';

function couplingReport(overrides: Partial<CouplingReport> = {}): CouplingReport {
  return {
    files: [
      { relativePath: 'src/a.ts', fanIn: 2, fanOut: 1, instability: 0.333 },
      { relativePath: 'src/b.ts', fanIn: 0, fanOut: 3, instability: 1 },
    ],
    cycles: [{ files: ['src/a.ts', 'src/b.ts'], size: 2 }],
    crossPackageEdges: [
      {
        from: { file: 'packages/a/src/index.ts', package: 'a' },
        to: { file: 'packages/b/src/index.ts', package: 'b' },
      },
    ],
    totalFiles: 2,
    totalCycles: 1,
    totalCrossPackageEdges: 1,
    ...overrides,
  };
}

describe('markdownCouplingReporter', () => {
  it('preserves the markdownReporter re-export for existing callers', () => {
    expect(reportCouplingMarkdownFromMarkdownReporter).toBe(reportCouplingMarkdown);
  });

  it('renders graph totals, cycles, cross-package edges, and file coupling rows', async () => {
    const out = await captureStdout(() => reportCouplingMarkdown(couplingReport()));

    expect(out).toContain('# Coupling + Cycles');
    expect(out).toContain('_2 file(s) in graph · 1 cycle(s) · 1 cross-package edge(s)_');
    expect(out).toContain('## Import cycles');
    expect(out).toContain('- **2-file cycle:** `src/a.ts` → `src/b.ts` → …');
    expect(out).toContain('## Cross-package edges');
    expect(out).toContain('| `a` | `packages/a/src/index.ts` | `b` | `packages/b/src/index.ts` |');
    expect(out).toContain('## Files');
    expect(out).toContain('| `src/a.ts` | 2 | 1 | 0.33 |');
    expect(out).toContain('| `src/b.ts` | 0 | 3 | 1.00 |');
  });

  it('omits optional sections when no cycles, edges, or files are present', async () => {
    const out = await captureStdout(() =>
      reportCouplingMarkdown(
        couplingReport({
          files: [],
          cycles: [],
          crossPackageEdges: [],
          totalFiles: 0,
          totalCycles: 0,
          totalCrossPackageEdges: 0,
        }),
      ),
    );

    expect(out).toContain('_0 file(s) in graph · 0 cycle(s)_');
    expect(out).not.toContain('## Import cycles');
    expect(out).not.toContain('## Cross-package edges');
    expect(out).not.toContain('## Files');
  });
});
