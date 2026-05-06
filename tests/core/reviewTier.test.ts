import { describe, it, expect } from 'vitest';
import { selectReviewTier, shapeReviewForTier } from '../../src/core/review.js';
import type { ReviewReport } from '../../src/types.js';

describe('selectReviewTier (1.5+)', () => {
  it('returns full when no budget is given', () => {
    expect(selectReviewTier(undefined)).toBe('full');
    expect(selectReviewTier(0)).toBe('full');
    expect(selectReviewTier(-100)).toBe('full');
    expect(selectReviewTier(NaN)).toBe('full');
  });

  it('returns full when budget is large', () => {
    expect(selectReviewTier(7000)).toBe('full');
    expect(selectReviewTier(50000)).toBe('full');
  });

  it('returns summary at the 3000-7000 band', () => {
    expect(selectReviewTier(3000)).toBe('summary');
    expect(selectReviewTier(5000)).toBe('summary');
    expect(selectReviewTier(6999)).toBe('summary');
  });

  it('returns verdict-only below 3000', () => {
    expect(selectReviewTier(1)).toBe('verdict-only');
    expect(selectReviewTier(2999)).toBe('verdict-only');
  });
});

const FIXTURE_FULL: ReviewReport = {
  available: true,
  base: { ref: 'origin/main', resolvedSha: 'a'.repeat(40) },
  head: { ref: 'HEAD', resolvedSha: 'b'.repeat(40) },
  prDiff: {
    available: true,
    base: { ref: 'origin/main', resolvedSha: 'a'.repeat(40) },
    head: { ref: 'HEAD', resolvedSha: 'b'.repeat(40) },
    totalFilesChanged: 12,
    filesAdded: Array.from({ length: 8 }, (_, i) => `src/added${i}.ts`),
    filesRemoved: ['src/removed.ts'],
    filesModified: Array.from({ length: 8 }, (_, i) => ({
      relativePath: `src/modified${i}.ts`,
      status: 'modified' as const,
      exportsAdded: [`exp${i}`],
      exportsRemoved: [],
      exportsRenamed: [],
      importsAdded: [`imp${i}`],
      importsRemoved: [],
      callsAdded: [`call${i}`],
      callsRemoved: [],
      cyclomaticDelta: i + 1,
      fanInDelta: i,
    })),
  },
  changedFiles: Array.from({ length: 10 }, (_, i) => ({
    relativePath: `src/file${i}.ts`,
    riskScore: 90 - i,
    riskScoreDelta: i,
    cyclomaticComplexity: 10 + i,
    cyclomaticComplexityDelta: i,
    status: 'modified' as const,
    fanInDelta: 0,
    fanIn: 5,
    fanOut: 3,
  })) as ReviewReport['changedFiles'],
  newCycles: Array.from({ length: 5 }, (_, i) => ({
    files: [`src/cycle${i}-a.ts`, `src/cycle${i}-b.ts`],
    expanded: false,
  })) as ReviewReport['newCycles'],
  riskyFunctions: Array.from({ length: 5 }, (_, i) => ({
    file: `src/risky${i}.ts`,
    name: `fn${i}`,
    cyclomaticComplexity: 30 - i,
    cyclomaticComplexityDelta: 10,
    line: 1,
    endLine: 50,
    reason: 'high CC',
  })) as ReviewReport['riskyFunctions'],
  dependencyChanges: Array.from({ length: 5 }, (_, i) => ({
    workspace: 'root',
    workspacePath: 'package.json',
    added: [{ name: `dep${i}`, version: '1.0.0', kind: 'dep' as const }],
    removed: [],
    bumped: [],
  })) as ReviewReport['dependencyChanges'],
  verdict: 'review',
  summary: ['10 changed files', '5 new cycles'],
};

describe('shapeReviewForTier (1.5+)', () => {
  it('full tier returns the report unchanged plus a tier marker', () => {
    const out = shapeReviewForTier(FIXTURE_FULL, 'full');
    expect(out.tier).toBe('full');
    expect(out.changedFiles).toHaveLength(10);
    expect(out.newCycles).toHaveLength(5);
  });

  it('summary tier trims lists to the top-N and adds totals', () => {
    const out = shapeReviewForTier(FIXTURE_FULL, 'summary') as {
      tier: string;
      changedFiles: unknown[];
      newCycles: unknown[];
      riskyFunctions: unknown[];
      dependencyChanges: unknown[];
      totals: Record<string, number>;
      prDiff: {
        filesAdded: unknown[];
        filesModified: unknown[];
      };
    };
    expect(out.tier).toBe('summary');
    expect(out.changedFiles.length).toBeLessThanOrEqual(5);
    expect(out.newCycles.length).toBeLessThanOrEqual(3);
    expect(out.riskyFunctions.length).toBeLessThanOrEqual(3);
    expect(out.dependencyChanges.length).toBeLessThanOrEqual(3);
    expect(out.prDiff.filesAdded.length).toBeLessThanOrEqual(5);
    expect(out.prDiff.filesModified.length).toBeLessThanOrEqual(5);
    expect(out.totals).toEqual({
      filesChanged: 10,
      cyclesAdded: 5,
      riskyFunctionsAdded: 5,
      depsChanged: 5,
      taintFlowsAdded: 0,
    });
  });

  it('summary tier drops heavy per-file expansion arrays', () => {
    const out = shapeReviewForTier(FIXTURE_FULL, 'summary') as {
      prDiff: { filesModified: Array<Record<string, unknown>> };
    };
    const firstModified = out.prDiff.filesModified[0];
    expect(firstModified).not.toHaveProperty('exportsAdded');
    expect(firstModified).not.toHaveProperty('importsAdded');
    expect(firstModified).not.toHaveProperty('callsAdded');
    // ...but keeps the deltas an agent uses for risk scoring.
    expect(firstModified).toHaveProperty('cyclomaticDelta');
    expect(firstModified).toHaveProperty('fanInDelta');
  });

  it('verdict-only tier strips everything except the verdict and totals', () => {
    const out = shapeReviewForTier(FIXTURE_FULL, 'verdict-only') as {
      tier: string;
      verdict: string;
      summary: string[];
      totals: Record<string, number>;
    };
    expect(out.tier).toBe('verdict-only');
    expect(out.verdict).toBe('review');
    expect(out.summary).toEqual(['10 changed files', '5 new cycles']);
    expect(out.totals.filesChanged).toBe(10);
    expect(out).not.toHaveProperty('prDiff');
    expect(out).not.toHaveProperty('changedFiles');
    expect(out).not.toHaveProperty('newCycles');
    expect(out).not.toHaveProperty('riskyFunctions');
    expect(out).not.toHaveProperty('dependencyChanges');
  });

  it('passes unavailable reports through unchanged', () => {
    const unavail: ReviewReport = {
      available: false,
      reason: 'no diff',
      base: { ref: 'main', resolvedSha: null },
      head: { ref: 'HEAD', resolvedSha: null },
      prDiff: {
        available: false,
        reason: 'no diff',
        base: { ref: 'main', resolvedSha: null },
        head: { ref: 'HEAD', resolvedSha: null },
        totalFilesChanged: 0,
        filesAdded: [],
        filesRemoved: [],
        filesModified: [],
      },
      changedFiles: [],
      newCycles: [],
      riskyFunctions: [],
      dependencyChanges: [],
      verdict: 'ok',
      summary: [],
    };
    const out = shapeReviewForTier(unavail, 'verdict-only');
    expect(out.tier).toBe('verdict-only');
    expect(out.available).toBe(false);
  });
});
