import { describe, expect, it } from 'vitest';
import { collectFileInspectionEvidence } from '../../src/core/fileInspectionEvidence.js';
import type { FileEntry, HotspotReport, Issue } from '../../src/types.js';

describe('collectFileInspectionEvidence', () => {
  it('returns the matching hotspot and exact-location issues for a file', () => {
    const files = [file('src/a.ts'), file('src/ab.ts')];
    const issues: Issue[] = [
      issue('issue-a', 'warning', 'mentions src/a.ts', [{ file: 'src/ab.ts' }]),
      issue('issue-b', 'error', 'direct issue', [{ file: 'src/a.ts' }]),
    ];
    const hotspots = hotspotReport(['src/a.ts']);

    const evidence = collectFileInspectionEvidence({
      files,
      issues,
      hotspots,
      relativePath: 'src/a.ts',
    });

    expect(evidence.hotspot?.relativePath).toBe('src/a.ts');
    expect(evidence.issues.map((entry) => entry.id)).toEqual(['issue-b']);
  });

  it('returns empty evidence when no issue or hotspot matches the file', () => {
    const evidence = collectFileInspectionEvidence({
      files: [file('src/a.ts')],
      issues: [issue('issue-a', 'warning', 'elsewhere', [{ file: 'src/other.ts' }])],
      hotspots: hotspotReport(['src/other.ts']),
      relativePath: 'src/a.ts',
    });

    expect(evidence.hotspot).toBeNull();
    expect(evidence.issues).toEqual([]);
  });
});

function file(relativePath: string): FileEntry {
  return {
    relativePath,
    absolutePath: `/repo/${relativePath}`,
    extension: '.ts',
    directory: relativePath.split('/').slice(0, -1).join('/') || '.',
    sizeBytes: 10,
  };
}

function issue(
  id: string,
  severity: Issue['severity'],
  description: string,
  locations: Issue['locations'],
): Issue {
  return {
    id,
    severity,
    title: id,
    description,
    category: 'test',
    fixAvailable: false,
    locations,
  };
}

function hotspotReport(relativePaths: string[]): HotspotReport {
  return {
    available: true,
    window: { since: null, commitsScanned: 0 },
    totalFilesRanked: relativePaths.length,
    hotspots: relativePaths.map((relativePath) => ({
      relativePath,
      churn: 1,
      distinctAuthors: 1,
      daysSinceLastChange: null,
      lineCount: 1,
      cyclomaticComplexity: 1,
      sizeBytes: 10,
      issueCount: 0,
      issueIds: [],
      riskScore: 1,
      reasons: [],
      primaryAuthor: null,
      primaryAuthorShare: 0,
      busFactorOne: false,
      topAuthors: [],
    })),
  };
}
