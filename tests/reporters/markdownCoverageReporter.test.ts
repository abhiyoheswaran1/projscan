import { describe, expect, it } from 'vitest';
import { reportCoverageMarkdown } from '../../src/reporters/markdownCoverageReporter.js';
import { reportCoverageMarkdown as reportCoverageMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import type { CoverageJoinedReport } from '../../src/types.js';
import { captureStdout } from './fixtures.js';

describe('markdownCoverageReporter', () => {
  it('is re-exported from markdownReporter to preserve the public reporter API', () => {
    expect(reportCoverageMarkdownFromMarkdownReporter).toBe(reportCoverageMarkdown);
  });

  it('renders unavailable coverage reports with the provided reason', async () => {
    const out = await captureStdout(() =>
      reportCoverageMarkdown({
        available: false,
        reason: 'No coverage source found',
        coverageSource: null,
        coverageSourceFile: null,
        entries: [],
      }),
    );

    expect(out).toContain('# Coverage × Hotspots');
    expect(out).toContain('_No coverage source found_');
  });

  it('renders an empty-intersection message when no entries exist', async () => {
    const out = await captureStdout(() =>
      reportCoverageMarkdown({
        available: true,
        coverageSource: 'lcov',
        coverageSourceFile: 'coverage/lcov.info',
        entries: [],
      }),
    );

    expect(out).toContain('_Source: `coverage/lcov.info` (lcov)_');
    expect(out).toContain('_No hotspots intersected with coverage data._');
  });

  it('renders ranked entries, null coverage, and reasons', async () => {
    const out = await captureStdout(() => reportCoverageMarkdown(coverageReport()));

    expect(out).toContain('| Priority | Coverage | Risk | Churn | File | Reasons |');
    expect(out).toContain('| 75.0 | 15% | 95.0 | 20 | `src/file-1.ts` | high churn, low coverage |');
    expect(out).toContain('| 74.0 | - | 94.0 | 19 | `src/file-2.ts` | - |');
  });
});

function coverageReport(): CoverageJoinedReport {
  return {
    available: true,
    coverageSource: 'coverage-summary',
    coverageSourceFile: null,
    entries: [
      {
        relativePath: 'src/file-1.ts',
        riskScore: 95,
        churn: 20,
        lineCount: 100,
        issueCount: 1,
        coverage: 15,
        priority: 75,
        reasons: ['high churn', 'low coverage'],
      },
      {
        relativePath: 'src/file-2.ts',
        riskScore: 94,
        churn: 19,
        lineCount: 101,
        issueCount: 0,
        coverage: null,
        priority: 74,
        reasons: [],
      },
    ],
  };
}
