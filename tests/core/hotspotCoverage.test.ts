import { describe, it, expect } from 'vitest';
import { computeRiskScore } from '../../src/core/hotspotAnalyzer.js';

describe('computeRiskScore with coverage', () => {
  it('produces the same score when coverage is not provided', () => {
    const a = computeRiskScore({ churn: 10, lines: 200, authors: 3, daysSinceLastChange: 5, issueCount: 0 });
    const b = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 3,
      daysSinceLastChange: 5,
      issueCount: 0,
      coverage: null,
    });
    expect(a).toBe(b);
  });

  it('penalizes low coverage on churning files', () => {
    const wellCovered = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 3,
      daysSinceLastChange: 5,
      issueCount: 0,
      coverage: 95,
    });
    const uncovered = computeRiskScore({
      churn: 10,
      lines: 200,
      authors: 3,
      daysSinceLastChange: 5,
      issueCount: 0,
      coverage: 10,
    });
    expect(uncovered).toBeGreaterThan(wellCovered);
  });

  it('does not penalize uncovered files that never change', () => {
    const coveragePenalty = computeRiskScore({
      churn: 0,
      lines: 200,
      authors: 0,
      daysSinceLastChange: null,
      issueCount: 0,
      coverage: 10,
    });
    expect(coveragePenalty).toBe(0);
  });
});
