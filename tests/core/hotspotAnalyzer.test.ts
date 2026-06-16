import { describe, it, expect } from 'vitest';
import { buildFileHotspot, computeRiskScore } from '../../src/core/hotspotAnalyzer.js';
import type { FileEntry } from '../../src/types.js';

const fileEntry: FileEntry = {
  relativePath: 'src/hot.ts',
  absolutePath: '/repo/src/hot.ts',
  extension: '.ts',
  sizeBytes: 4000,
  directory: 'src',
};

describe('computeRiskScore', () => {
  it('returns 0 for untouched files with no issues', () => {
    const score = computeRiskScore({
      churn: 0,
      lines: 100,
      authors: 0,
      daysSinceLastChange: null,
      issueCount: 0,
    });
    expect(score).toBe(0);
  });

  it('non-zero when file has open issues but no churn', () => {
    const score = computeRiskScore({
      churn: 0,
      lines: 50,
      authors: 0,
      daysSinceLastChange: null,
      issueCount: 2,
    });
    expect(score).toBeGreaterThan(0);
  });

  it('high churn + high complexity produces higher score than either alone', () => {
    const combined = computeRiskScore({
      churn: 40,
      lines: 800,
      authors: 3,
      daysSinceLastChange: 10,
      issueCount: 1,
    });
    const justChurn = computeRiskScore({
      churn: 40,
      lines: 1,
      authors: 3,
      daysSinceLastChange: 10,
      issueCount: 1,
    });
    const justComplexity = computeRiskScore({
      churn: 0,
      lines: 800,
      authors: 0,
      daysSinceLastChange: null,
      issueCount: 1,
    });
    expect(combined).toBeGreaterThan(justChurn);
    expect(combined).toBeGreaterThan(justComplexity);
  });

  it('recent changes get a recency boost', () => {
    const recent = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 2,
      daysSinceLastChange: 3,
      issueCount: 0,
    });
    const stale = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 2,
      daysSinceLastChange: 400,
      issueCount: 0,
    });
    expect(recent).toBeGreaterThan(stale);
  });

  it('scales monotonically with churn', () => {
    const low = computeRiskScore({
      churn: 2,
      lines: 100,
      authors: 1,
      daysSinceLastChange: 60,
      issueCount: 0,
    });
    const high = computeRiskScore({
      churn: 50,
      lines: 100,
      authors: 1,
      daysSinceLastChange: 60,
      issueCount: 0,
    });
    expect(high).toBeGreaterThan(low);
  });

  it('issues contribute meaningfully to the score', () => {
    const noIssues = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 1,
      daysSinceLastChange: 30,
      issueCount: 0,
    });
    const withIssues = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 1,
      daysSinceLastChange: 30,
      issueCount: 3,
    });
    expect(withIssues - noIssues).toBeGreaterThanOrEqual(30);
  });

  it('bus-factor-1 files get an additional penalty', () => {
    const base = computeRiskScore({
      churn: 10,
      lines: 300,
      authors: 2,
      daysSinceLastChange: 30,
      issueCount: 0,
    });
    const withBus = computeRiskScore({
      churn: 10,
      lines: 300,
      authors: 2,
      daysSinceLastChange: 30,
      issueCount: 0,
      busFactorOne: true,
    });
    expect(withBus).toBeGreaterThan(base);
    expect(withBus - base).toBeGreaterThanOrEqual(10);
  });

  // ── 0.11 LOC -> CC swap ─────────────────────────────────

  it('0.11: when complexity is provided, score uses it instead of lines', () => {
    // Same churn etc., big-file-but-low-CC vs small-file-but-high-CC: CC wins.
    const bigFileSimple = computeRiskScore({
      churn: 10,
      lines: 800,
      complexity: 5,
      authors: 1,
      daysSinceLastChange: 30,
      issueCount: 0,
    });
    const smallFileGnarly = computeRiskScore({
      churn: 10,
      lines: 80,
      complexity: 60,
      authors: 1,
      daysSinceLastChange: 30,
      issueCount: 0,
    });
    expect(smallFileGnarly).toBeGreaterThan(bigFileSimple);
  });

  it('0.11: complexity=null falls back to lines (non-AST language behavior)', () => {
    const withFallback = computeRiskScore({
      churn: 10,
      lines: 200,
      complexity: null,
      authors: 1,
      daysSinceLastChange: 30,
      issueCount: 0,
    });
    const withoutComplexityField = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 1,
      daysSinceLastChange: 30,
      issueCount: 0,
    });
    expect(withFallback).toBe(withoutComplexityField);
  });
});

describe('buildFileHotspot', () => {
  const nowMs = Date.UTC(2026, 5, 16);

  it('combines churn, author concentration, issues, coverage, and complexity evidence', () => {
    const hotspot = buildFileHotspot({
      file: fileEntry,
      churn: 5,
      distinctAuthors: 2,
      authorCommits: new Map([
        ['owner@example.com', 4],
        ['peer@example.com', 1],
      ]),
      lastTimestampMs: nowMs - 2 * 24 * 60 * 60 * 1000,
      lineCount: 120,
      issueIds: ['issue-1'],
      nowMs,
      coverage: 35.2,
      complexity: 31,
    });

    expect(hotspot).toMatchObject({
      relativePath: 'src/hot.ts',
      churn: 5,
      distinctAuthors: 2,
      daysSinceLastChange: 2,
      lineCount: 120,
      cyclomaticComplexity: 31,
      issueCount: 1,
      issueIds: ['issue-1'],
      primaryAuthor: 'owner@example.com',
      primaryAuthorShare: 0.8,
      busFactorOne: true,
      coverage: 35.2,
    });
    expect(hotspot.topAuthors).toEqual([
      { author: 'owner@example.com', commits: 4, share: 0.8 },
      { author: 'peer@example.com', commits: 1, share: 0.2 },
    ]);
    expect(hotspot.reasons).toEqual(
      expect.arrayContaining([
        '5 commits',
        'high complexity (CC 31)',
        '2 contributors',
        '1 open issue',
        'changed this week',
        'bus factor 1 (owner)',
        'low coverage (35%)',
      ]),
    );
    expect(hotspot.riskScore).toBeGreaterThan(0);
  });

  it('falls back to estimated line count and null complexity for unparsed files', () => {
    const hotspot = buildFileHotspot({
      file: fileEntry,
      churn: 1,
      distinctAuthors: 0,
      lastTimestampMs: null,
      nowMs,
    });

    expect(hotspot.lineCount).toBe(100);
    expect(hotspot.cyclomaticComplexity).toBeNull();
    expect(hotspot.coverage).toBeNull();
    expect(hotspot.primaryAuthor).toBeNull();
    expect(hotspot.primaryAuthorShare).toBe(0);
    expect(hotspot.busFactorOne).toBe(false);
    expect(hotspot.issueIds).toEqual([]);
    expect(hotspot.riskScore).toBeGreaterThan(0);
  });
});
