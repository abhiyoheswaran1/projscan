import { describe, it, expect } from 'vitest';
import { reportCoupling } from '../../src/reporters/consoleCouplingReporter.js';
import { reportCoupling as reportCouplingFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { CouplingReport } from '../../src/types.js';
import { captureStdout, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

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

describe('consoleCouplingReporter', () => {
  it('renders the no-files warning when no language adapter matched', async () => {
    const out = await capturePlain(() =>
      reportCoupling(
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

    expect(out).toContain('Coupling + Cycles');
    expect(out).toContain('No files in the code graph');
  });

  it('renders singular graph totals without cross-package wording when none exist', async () => {
    const out = await capturePlain(() =>
      reportCoupling(
        couplingReport({
          files: [{ relativePath: 'src/only.ts', fanIn: 0, fanOut: 0, instability: 0 }],
          cycles: [],
          crossPackageEdges: [],
          totalFiles: 1,
          totalCycles: 0,
          totalCrossPackageEdges: 0,
        }),
      ),
    );

    expect(out).toContain('1 file in graph · 0 cycles');
    expect(out).not.toContain('cross-package edge');
    expect(out).toContain('fan-in');
    expect(out).toContain('src/only.ts');
  });

  it('renders cycles and file coupling rows', async () => {
    const out = await capturePlain(() => reportCoupling(couplingReport()));

    expect(out).toContain('2 files in graph · 1 cycle · 1 cross-package edge');
    expect(out).toContain('Import cycles:');
    expect(out).toContain('cycle of 2 files: src/a.ts → src/b.ts → …');
    expect(out).toContain('Cross-package edges:');
    expect(out).toContain('packages/a/src/index.ts');
    expect(out).toContain('(a)');
    expect(out).toContain('packages/b/src/index.ts');
    expect(out).toContain('(b)');
    expect(out).toContain('Files (sorted by request):');
    expect(out).toContain('fan-in');
    expect(out).toContain('fan-out');
    expect(out).toContain('instab');
    expect(out).toContain('src/a.ts');
    expect(out).toContain('0.33');
    expect(out).toContain('src/b.ts');
    expect(out).toContain('1.00');
  });

  it('truncates cross-package edges after 25 entries', async () => {
    const crossPackageEdges = Array.from({ length: 27 }, (_, index) => ({
      from: { file: `packages/a/src/edge-${String(index + 1).padStart(2, '0')}.ts`, package: 'a' },
      to: { file: `packages/b/src/edge-${String(index + 1).padStart(2, '0')}.ts`, package: 'b' },
    }));
    const out = await capturePlain(() =>
      reportCoupling(
        couplingReport({ crossPackageEdges, totalCrossPackageEdges: crossPackageEdges.length }),
      ),
    );

    expect(out).toContain('27 cross-package edges');
    expect(out).toContain('edge-01.ts');
    expect(out).toContain('edge-25.ts');
    expect(out).not.toContain('edge-26.ts');
    expect(out).toContain('… and 2 more');
  });

  it('preserves the consoleReporter re-export for existing callers', async () => {
    const out = await capturePlain(() => reportCouplingFromConsoleReporter(couplingReport()));

    expect(out).toContain('Coupling + Cycles');
    expect(out).toContain('Import cycles:');
    expect(out).toContain('Cross-package edges:');
  });
});
