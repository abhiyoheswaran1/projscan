import { describe, it, expect } from 'vitest';
import { computeRiskScore } from '../../src/core/hotspotAnalyzer.js';

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
});
