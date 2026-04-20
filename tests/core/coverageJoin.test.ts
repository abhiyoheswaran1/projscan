import { describe, it, expect } from 'vitest';
import { joinCoverageWithHotspots } from '../../src/core/coverageJoin.js';
import type { CoverageReport, FileHotspot, HotspotReport } from '../../src/types.js';

function hotspot(path: string, riskScore: number, extra: Partial<FileHotspot> = {}): FileHotspot {
  return {
    relativePath: path,
    churn: 10,
    distinctAuthors: 2,
    daysSinceLastChange: 5,
    lineCount: 100,
    sizeBytes: 5000,
    issueCount: 0,
    issueIds: [],
    riskScore,
    reasons: [],
    primaryAuthor: 'alice',
    primaryAuthorShare: 1,
    busFactorOne: true,
    topAuthors: [],
    ...extra,
  };
}

function hotspotReport(hotspots: FileHotspot[]): HotspotReport {
  return {
    available: true,
    window: { since: '12 months ago', commitsScanned: 100 },
    hotspots,
    totalFilesRanked: hotspots.length,
  };
}

function coverageReport(entries: Array<{ path: string; pct: number }>): CoverageReport {
  return {
    available: true,
    source: 'lcov',
    sourceFile: 'coverage/lcov.info',
    totalCoverage: 50,
    files: entries.map((e) => ({
      relativePath: e.path,
      lineCoverage: e.pct,
      linesFound: 100,
      linesHit: e.pct,
    })),
  };
}

describe('joinCoverageWithHotspots', () => {
  it('returns unavailable when hotspots are unavailable', () => {
    const joined = joinCoverageWithHotspots(
      { available: false, reason: 'not a git repo', window: { since: null, commitsScanned: 0 }, hotspots: [], totalFilesRanked: 0 },
      coverageReport([]),
    );
    expect(joined.available).toBe(false);
    expect(joined.reason).toMatch(/not a git repo/);
  });

  it('returns unavailable when coverage is unavailable', () => {
    const joined = joinCoverageWithHotspots(
      hotspotReport([hotspot('src/a.ts', 50)]),
      {
        available: false,
        reason: 'no coverage file',
        source: null,
        sourceFile: null,
        totalCoverage: 0,
        files: [],
      },
    );
    expect(joined.available).toBe(false);
    expect(joined.reason).toMatch(/no coverage file/);
  });

  it('prioritizes high-risk low-coverage files', () => {
    const joined = joinCoverageWithHotspots(
      hotspotReport([
        hotspot('src/well-covered.ts', 50),
        hotspot('src/uncovered.ts', 50),
      ]),
      coverageReport([
        { path: 'src/well-covered.ts', pct: 95 },
        { path: 'src/uncovered.ts', pct: 10 },
      ]),
    );
    expect(joined.available).toBe(true);
    expect(joined.entries[0].relativePath).toBe('src/uncovered.ts');
    expect(joined.entries[0].coverage).toBe(10);
    expect(joined.entries[0].priority).toBeGreaterThan(joined.entries[1].priority);
  });

  it('handles files without coverage data (coverage = null)', () => {
    const joined = joinCoverageWithHotspots(
      hotspotReport([hotspot('src/uncovered.ts', 50)]),
      coverageReport([]),
    );
    expect(joined.entries[0].coverage).toBeNull();
  });
});
