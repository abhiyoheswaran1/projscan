import type {
  CoverageJoinedHotspot,
  CoverageJoinedReport,
  CoverageReport,
  HotspotReport,
} from '../types.js';

/**
 * Join a hotspot report with a coverage report and rank entries by
 * "risk × uncovered fraction" — the files that most deserve tests.
 */
export function joinCoverageWithHotspots(
  hotspots: HotspotReport,
  coverage: CoverageReport,
): CoverageJoinedReport {
  if (!hotspots.available) {
    return {
      available: false,
      reason: hotspots.reason ?? 'hotspots unavailable',
      coverageSource: coverage.source,
      coverageSourceFile: coverage.sourceFile,
      entries: [],
    };
  }
  if (!coverage.available) {
    return {
      available: false,
      reason: coverage.reason ?? 'coverage unavailable',
      coverageSource: coverage.source,
      coverageSourceFile: coverage.sourceFile,
      entries: [],
    };
  }

  const coverageMap = new Map<string, number>();
  for (const f of coverage.files) coverageMap.set(f.relativePath, f.lineCoverage);

  const entries: CoverageJoinedHotspot[] = hotspots.hotspots.map((h) => {
    const cov = coverageMap.get(h.relativePath);
    const uncovered = typeof cov === 'number' ? Math.max(0, (100 - cov) / 100) : 1;
    const priority = h.riskScore * (0.3 + 0.7 * uncovered);
    return {
      relativePath: h.relativePath,
      riskScore: h.riskScore,
      churn: h.churn,
      lineCount: h.lineCount,
      issueCount: h.issueCount,
      coverage: typeof cov === 'number' ? cov : null,
      priority: Math.round(priority * 10) / 10,
      reasons: h.reasons,
    };
  });

  entries.sort((a, b) => b.priority - a.priority);

  return {
    available: true,
    coverageSource: coverage.source,
    coverageSourceFile: coverage.sourceFile,
    entries,
  };
}
