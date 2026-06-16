import { describe, it, expect } from 'vitest';
import { reportHotspotsMarkdown } from '../../src/reporters/markdownHotspotReporter.js';
import { reportHotspotsMarkdown as reportHotspotsMarkdownFromMarkdownReporter } from '../../src/reporters/markdownReporter.js';
import { captureStdout, makeHotspotReport } from './fixtures.js';

describe('markdownHotspotReporter', () => {
  it('preserves the markdownReporter re-export for existing callers', () => {
    expect(reportHotspotsMarkdownFromMarkdownReporter).toBe(reportHotspotsMarkdown);
  });

  it('shows the unavailable reason', async () => {
    const out = await captureStdout(() =>
      reportHotspotsMarkdown({
        available: false,
        reason: 'no git',
        window: { since: null, commitsScanned: 0 },
        hotspots: [],
        totalFilesRanked: 0,
      }),
    );

    expect(out).toContain('# Project Hotspots');
    expect(out).toContain('> no git');
  });

  it('shows the empty message when no hotspots are ranked', async () => {
    const out = await captureStdout(() =>
      reportHotspotsMarkdown({
        available: true,
        window: { since: '2026-01-01', commitsScanned: 5 },
        hotspots: [],
        totalFilesRanked: 0,
      }),
    );

    expect(out).toContain('_Scanned **5** commit(s) since **2026-01-01**');
    expect(out).toContain('No hotspots detected.');
  });

  it('renders ranked hotspot rows with fallback values', async () => {
    const report = makeHotspotReport();
    report.hotspots.push({
      ...report.hotspots[0],
      relativePath: 'src/no-cc.ts',
      cyclomaticComplexity: null,
      reasons: [],
      riskScore: 21,
    });
    report.totalFilesRanked = 2;

    const out = await captureStdout(() => reportHotspotsMarkdown(report));

    expect(out).toContain('| # | Score | File | Churn | CC | Lines | Issues | Reasons |');
    expect(out).toContain('| 1 | 85.0 | `src/big.ts` | 20 | 23 | 500 | 1 | high churn, many authors |');
    expect(out).toContain('| 2 | 21.0 | `src/no-cc.ts` | 20 | - | 500 | 1 | - |');
  });
});
