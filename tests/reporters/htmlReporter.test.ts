import { describe, it, expect, vi } from 'vitest';
import {
  reportHealthHtml,
  reportHotspotsHtml,
  reportCouplingHtml,
  reportReviewHtml,
  reportImpactHtml,
  htmlShell,
} from '../../src/reporters/htmlReporter.js';
import type {
  CouplingReport,
  HotspotReport,
  ImpactReport,
  Issue,
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
