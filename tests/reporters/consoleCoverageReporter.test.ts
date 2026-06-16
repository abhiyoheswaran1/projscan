import { describe, expect, it } from 'vitest';
import { reportCoverage } from '../../src/reporters/consoleCoverageReporter.js';
import { reportCoverage as reportCoverageFromConsoleReporter } from '../../src/reporters/consoleReporter.js';
import type { CoverageJoinedReport } from '../../src/types.js';
import { captureStdout, stripAnsi } from './fixtures.js';

async function capturePlain(fn: () => void): Promise<string> {
  return stripAnsi(await captureStdout(fn));
}

describe('consoleCoverageReporter', () => {
  it('is re-exported from consoleReporter to preserve the public reporter API', () => {
    expect(reportCoverageFromConsoleReporter).toBe(reportCoverage);
  });

  it('renders unavailable coverage reports with the provided reason', async () => {
    const out = await capturePlain(() =>
      reportCoverage({
        available: false,
        reason: 'No coverage source found',
        coverageSource: null,
        coverageSourceFile: null,
        entries: [],
      }),
    );

    expect(out).toContain('No coverage source found');
    expect(out).not.toContain('Coverage × Hotspots');
  });

  it('renders an empty-intersection message when no entries exist', async () => {
    const out = await capturePlain(() =>
      reportCoverage({
        available: true,
        coverageSource: 'lcov',
        coverageSourceFile: 'coverage/lcov.info',
        entries: [],
      }),
    );

    expect(out).toContain('Coverage × Hotspots');
    expect(out).toContain('Source: lcov (coverage/lcov.info)');
    expect(out).toContain('No hotspots intersected with coverage data.');
  });

  it('renders ranked entries, null coverage, reasons, and overflow rows', async () => {
    const out = await capturePlain(() => reportCoverage(coverageReport()));

    expect(out).toContain('Coverage × Hotspots');
    expect(out).toContain('Source: coverage-summary');
    expect(out).toContain('src/file-1.ts');
    expect(out).toContain('cov  15%');
    expect(out).toContain('high churn, low coverage');
    expect(out).toContain('src/file-2.ts');
    expect(out).toContain('cov n/a');
    expect(out).toContain('src/file-20.ts');
    expect(out).not.toContain('src/file-21.ts');
    expect(out).toContain('… and 2 more.');
  });
});

function coverageReport(): CoverageJoinedReport {
  return {
    available: true,
    coverageSource: 'coverage-summary',
    coverageSourceFile: null,
    entries: Array.from({ length: 22 }, (_, index) => ({
      relativePath: `src/file-${index + 1}.ts`,
      riskScore: 95 - index,
      churn: 20 - (index % 5),
      lineCount: 100 + index,
      issueCount: index % 3,
      coverage: index === 1 ? null : 15 + index,
      priority: 75 - index,
      reasons: index === 0 ? ['high churn', 'low coverage'] : [],
    })),
  };
}
