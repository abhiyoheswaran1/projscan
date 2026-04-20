import { describe, it, expect } from 'vitest';
import { baselineFromIssues, computeDiff } from '../../src/utils/baseline.js';
import type { HotspotReport, Issue } from '../../src/types.js';

function makeIssue(severity: 'error' | 'warning' | 'info', title: string): Issue {
  return {
    id: title,
    title,
    description: title,
    severity,
    category: 'test',
    fixAvailable: false,
  };
}

function makeHotspotReport(
  entries: { relativePath: string; riskScore: number; churn: number }[],
): HotspotReport {
  return {
    available: true,
    window: { since: '12 months ago', commitsScanned: 50 },
    hotspots: entries.map((e) => ({
      relativePath: e.relativePath,
      churn: e.churn,
      distinctAuthors: 1,
      daysSinceLastChange: 10,
      lineCount: 100,
      sizeBytes: 1000,
      issueCount: 0,
      issueIds: [],
      riskScore: e.riskScore,
      reasons: [],
      primaryAuthor: null,
      primaryAuthorShare: 0,
      busFactorOne: false,
      topAuthors: [],
    })),
    totalFilesRanked: entries.length,
  };
}

describe('baseline with hotspots', () => {
  it('snapshots hotspots when provided', () => {
    const issues = [makeIssue('warning', 'foo')];
    const hotspots = makeHotspotReport([
      { relativePath: 'src/a.ts', riskScore: 50, churn: 5 },
      { relativePath: 'src/b.ts', riskScore: 30, churn: 3 },
    ]);
    const baseline = baselineFromIssues(issues, hotspots);
    expect(baseline.hotspots).toHaveLength(2);
    expect(baseline.hotspots?.[0].relativePath).toBe('src/a.ts');
  });

  it('omits hotspots when the report is unavailable', () => {
    const baseline = baselineFromIssues([], {
      available: false,
      window: { since: null, commitsScanned: 0 },
      hotspots: [],
      totalFilesRanked: 0,
    });
    expect(baseline.hotspots).toBeUndefined();
  });
});

describe('computeDiff hotspot deltas', () => {
  it('classifies risen / fallen / appeared / resolved', () => {
    const before = baselineFromIssues(
      [],
      makeHotspotReport([
        { relativePath: 'src/stable.ts', riskScore: 40, churn: 3 },
        { relativePath: 'src/rising.ts', riskScore: 30, churn: 3 },
        { relativePath: 'src/falling.ts', riskScore: 60, churn: 3 },
        { relativePath: 'src/resolved.ts', riskScore: 20, churn: 2 },
      ]),
    );

    const diff = computeDiff(
      before,
      [],
      makeHotspotReport([
        { relativePath: 'src/stable.ts', riskScore: 40, churn: 3 },
        { relativePath: 'src/rising.ts', riskScore: 55, churn: 5 },
        { relativePath: 'src/falling.ts', riskScore: 35, churn: 2 },
        { relativePath: 'src/appeared.ts', riskScore: 45, churn: 3 },
      ]),
    );

    expect(diff.hotspotDiff).toBeDefined();
    const paths = {
      rose: diff.hotspotDiff!.rose.map((d) => d.relativePath),
      fell: diff.hotspotDiff!.fell.map((d) => d.relativePath),
      appeared: diff.hotspotDiff!.appeared.map((d) => d.relativePath),
      resolved: diff.hotspotDiff!.resolved.map((d) => d.relativePath),
    };
    expect(paths.rose).toContain('src/rising.ts');
    expect(paths.fell).toContain('src/falling.ts');
    expect(paths.appeared).toContain('src/appeared.ts');
    expect(paths.resolved).toContain('src/resolved.ts');
  });

  it('omits hotspot diff when baseline has no hotspots', () => {
    const before = baselineFromIssues([makeIssue('warning', 'foo')]);
    const diff = computeDiff(before, [makeIssue('warning', 'foo')]);
    expect(diff.hotspotDiff).toBeUndefined();
  });
});
