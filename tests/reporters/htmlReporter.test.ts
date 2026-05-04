import { describe, it, expect, vi } from 'vitest';
import {
  reportHealthHtml,
  reportHotspotsHtml,
  reportCouplingHtml,
  reportReviewHtml,
  reportImpactHtml,
  reportPrDiffHtml,
  reportCoverageHtml,
  htmlShell,
} from '../../src/reporters/htmlReporter.js';
import type {
  CouplingReport,
  CoverageJoinedReport,
  HotspotReport,
  ImpactReport,
  Issue,
  PrDiffReport,
  ReviewReport,
} from '../../src/types.js';

function captured(fn: () => void): string {
  const spy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
  try {
    fn();
    return spy.mock.calls.map((c) => String(c[0])).join('\n');
  } finally {
    spy.mockRestore();
  }
}

describe('htmlShell', () => {
  it('produces a complete HTML document with the title set', () => {
    const out = htmlShell('My Title', '<p>hi</p>');
    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toContain('<title>My Title</title>');
    expect(out).toContain('<p>hi</p>');
    expect(out).toContain('</html>');
  });

  it('escapes the title for HTML safety', () => {
    const out = htmlShell('<script>alert(1)</script>', '');
    expect(out).not.toContain('<script>alert(1)</script>');
    expect(out).toContain('&lt;script&gt;');
  });
});

describe('reportHealthHtml', () => {
  it('renders the score, grade, and issues table', () => {
    const issues: Issue[] = [
      {
        id: 'unused-dependency-foo',
        title: 'Unused dependency: foo',
        description: 'foo is declared but unused',
        severity: 'warning',
        category: 'dependencies',
        fixAvailable: false,
        suggestedAction: { summary: 'Remove or wire up foo.' },
      },
    ];
    const out = captured(() => reportHealthHtml(issues));
    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toContain('Project health');
    expect(out).toContain('Unused dependency');
    expect(out).toContain('projscan fix-suggest unused-dependency-foo');
  });

  it('handles the empty-issues happy path', () => {
    const out = captured(() => reportHealthHtml([]));
    expect(out).toContain('No issues detected');
  });
});

describe('reportHotspotsHtml', () => {
  it('renders unavailable reason when reports.available is false', () => {
    const r: HotspotReport = {
      available: false,
      reason: 'Not a git repo',
      window: { since: null, commitsScanned: 0 },
      hotspots: [],
      totalFilesRanked: 0,
    };
    const out = captured(() => reportHotspotsHtml(r));
    expect(out).toContain('Not a git repo');
  });

  it('renders the hotspots table', () => {
    const r: HotspotReport = {
      available: true,
      window: { since: '12 months ago', commitsScanned: 100 },
      hotspots: [
        {
          relativePath: 'src/big.ts',
          riskScore: 87.3,
          churn: 50,
          distinctAuthors: 4,
          primaryAuthor: 'a@b',
          primaryAuthorShare: 0.5,
          authorShares: [],
          daysSinceLastChange: 5,
          busFactorOne: false,
          lineCount: 800,
          cyclomaticComplexity: 42,
          issueCount: 3,
          coverage: null,
          reasons: ['high churn', 'high CC'],
        },
      ],
      totalFilesRanked: 1,
    };
    const out = captured(() => reportHotspotsHtml(r));
    expect(out).toContain('src/big.ts');
    expect(out).toContain('87.3');
    expect(out).toContain('high CC');
  });
});

describe('reportCouplingHtml', () => {
  it('renders cycles and the file table', () => {
    const r: CouplingReport = {
      files: [{ relativePath: 'src/a.ts', fanIn: 5, fanOut: 2, instability: 0.286 }],
      cycles: [{ files: ['src/a.ts', 'src/b.ts'], size: 2 }],
      crossPackageEdges: [],
      totalFiles: 1,
      totalCycles: 1,
      totalCrossPackageEdges: 0,
    };
    const out = captured(() => reportCouplingHtml(r));
    expect(out).toContain('src/a.ts');
    expect(out).toContain('Fan-in');
    // Cycle row joins <code> blocks with " → ".
    expect(out).toMatch(/<code>src\/a\.ts<\/code> → <code>src\/b\.ts<\/code>/);
  });
});

describe('reportReviewHtml', () => {
  it('shows the verdict badge', () => {
    const r: ReviewReport = {
      available: true,
      base: { ref: 'main', resolvedSha: 'aaaaaaa' },
      head: { ref: 'HEAD', resolvedSha: 'bbbbbbb' },
      prDiff: {
        available: true,
        base: { ref: 'main', resolvedSha: 'aaaaaaa' },
        head: { ref: 'HEAD', resolvedSha: 'bbbbbbb' },
        filesAdded: [],
        filesRemoved: [],
        filesModified: [],
        totalFilesChanged: 0,
      },
      changedFiles: [],
      newCycles: [],
      riskyFunctions: [],
      dependencyChanges: [],
      verdict: 'block',
      summary: ['One new cycle', 'High max risk'],
    };
    const out = captured(() => reportReviewHtml(r));
    expect(out).toContain('PR Review');
    expect(out).toContain('BLOCK');
    expect(out).toContain('One new cycle');
  });
});

describe('reportImpactHtml', () => {
  it('renders distance + file rows', () => {
    const r: ImpactReport = {
      available: true,
      target: { kind: 'file', value: 'src/x.ts' },
      definitionFiles: [],
      directCallers: [],
      reachable: [
        { file: 'src/a.ts', distance: 1 },
        { file: 'src/b.ts', distance: 2 },
      ],
      totalReachable: 2,
      truncated: false,
      maxDistance: 10,
    };
    const out = captured(() => reportImpactHtml(r));
    expect(out).toContain('Impact:');
    expect(out).toContain('src/a.ts');
    expect(out).toContain('src/b.ts');
  });
});

describe('reportPrDiffHtml', () => {
  it('renders unavailable reason cleanly', () => {
    const r: PrDiffReport = {
      available: false,
      reason: 'Not a git repo',
      base: { ref: '', resolvedSha: null },
      head: { ref: '', resolvedSha: null },
      filesAdded: [],
      filesRemoved: [],
      filesModified: [],
      totalFilesChanged: 0,
    };
    const out = captured(() => reportPrDiffHtml(r));
    expect(out).toContain('Not a git repo');
  });

  it('renders three sections with their counts', () => {
    const r: PrDiffReport = {
      available: true,
      base: { ref: 'main', resolvedSha: 'aaaaaaa' },
      head: { ref: 'HEAD', resolvedSha: 'bbbbbbb' },
      filesAdded: ['src/new.ts'],
      filesRemoved: ['src/old.ts'],
      filesModified: [
        {
          relativePath: 'src/edited.ts',
          status: 'modified',
          exportsAdded: ['foo'],
          exportsRemoved: ['bar'],
          exportsRenamed: [],
          importsAdded: [],
          importsRemoved: [],
          callsAdded: [],
          callsRemoved: [],
          cyclomaticDelta: 3,
          fanInDelta: -1,
        },
      ],
      totalFilesChanged: 3,
    };
    const out = captured(() => reportPrDiffHtml(r));
    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toContain('Added (1)');
    expect(out).toContain('Removed (1)');
    expect(out).toContain('Modified (1)');
    expect(out).toContain('src/new.ts');
    expect(out).toContain('src/old.ts');
    expect(out).toContain('src/edited.ts');
    expect(out).toContain('+exports');
    expect(out).toContain('foo');
    expect(out).toContain('bar');
    expect(out).toContain('ΔCC +3');
  });
});

describe('reportCoverageHtml', () => {
  it('renders unavailable reason cleanly', () => {
    const r: CoverageJoinedReport = {
      available: false,
      reason: 'No coverage source found',
      coverageSource: null,
      coverageSourceFile: null,
      entries: [],
    };
    const out = captured(() => reportCoverageHtml(r));
    expect(out).toContain('No coverage source found');
  });

  it('renders the entries table with priority + risk + coverage columns', () => {
    const r: CoverageJoinedReport = {
      available: true,
      coverageSource: 'lcov',
      coverageSourceFile: 'coverage/lcov.info',
      entries: [
        {
          relativePath: 'src/scary.ts',
          riskScore: 92.4,
          churn: 30,
          lineCount: 500,
          issueCount: 5,
          coverage: 0.12,
          priority: 88.5,
          reasons: ['high churn', 'low coverage'],
        },
        {
          relativePath: 'src/safe.ts',
          riskScore: 10.0,
          churn: 1,
          lineCount: 50,
          issueCount: 0,
          coverage: 0.95,
          priority: 5.0,
          reasons: ['well covered'],
        },
      ],
    };
    const out = captured(() => reportCoverageHtml(r));
    expect(out).toMatch(/^<!DOCTYPE html>/);
    expect(out).toContain('lcov');
    expect(out).toContain('coverage/lcov.info');
    expect(out).toContain('src/scary.ts');
    expect(out).toContain('92.4');
    expect(out).toContain('12%');
    expect(out).toContain('88.5');
    expect(out).toContain('src/safe.ts');
    expect(out).toContain('95%');
    // Split by </tr> so each row stands alone, then verify per-row class.
    const rowsByPath: Record<string, string> = {};
    for (const row of out.split('</tr>')) {
      if (row.includes('src/scary.ts')) rowsByPath['scary'] = row;
      if (row.includes('src/safe.ts')) rowsByPath['safe'] = row;
    }
    expect(rowsByPath['scary']).toMatch(/<tr class="severity-error">/);
    expect(rowsByPath['safe']).toMatch(/<tr>/);
    expect(rowsByPath['safe']).not.toMatch(/<tr class="severity-error">/);
  });

  it('handles entries with null coverage gracefully', () => {
    const r: CoverageJoinedReport = {
      available: true,
      coverageSource: null,
      coverageSourceFile: null,
      entries: [
        {
          relativePath: 'src/x.ts',
          riskScore: 50,
          churn: 5,
          lineCount: 100,
          issueCount: 1,
          coverage: null,
          priority: 50,
          reasons: [],
        },
      ],
    };
    const out = captured(() => reportCoverageHtml(r));
    expect(out).toContain('src/x.ts');
    // A null coverage should render as '-', not '0%'.
    expect(out).toMatch(/<td class="right">-<\/td>/);
  });
});
