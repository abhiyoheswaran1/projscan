import { describe, it, expect } from 'vitest';
import {
  STABLE_RULE_DAYS,
  STABLE_RULE_RUN_COUNT,
  computeRuleConfidence,
  computeRuleConfidenceScore,
  type ProjectMemory,
} from '../../src/core/memory.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function makeMemory(rules: ProjectMemory['rules']): ProjectMemory {
  return {
    schemaVersion: 1,
    lastUpdatedAt: new Date().toISOString(),
    rules,
    hotspots: {},
    totalRuns: Object.values(rules).reduce((acc, r) => acc + r.runCount, 0),
  };
}

describe('Project Memory — per-rule confidence (1.7+)', () => {
  it('returns "medium" for an unseen rule (no signal)', () => {
    const m = makeMemory({});
    expect(computeRuleConfidence(m, 'unknown-rule')).toBe('medium');
    expect(computeRuleConfidenceScore(m, 'unknown-rule')).toBe(0.5);
  });

  it('returns "high" for a rule the user has actively fixed', () => {
    const iso = new Date().toISOString();
    const m = makeMemory({
      'eslint-no-unused-vars': {
        ruleId: 'eslint-no-unused-vars',
        firstSeenAt: iso,
        lastSeenAt: iso,
        runCount: 3,
        fixedCount: 2, // user has fixed instances
        suppressedInConfig: false,
      },
    });
    expect(computeRuleConfidence(m, 'eslint-no-unused-vars')).toBe('high');
    expect(computeRuleConfidenceScore(m, 'eslint-no-unused-vars')).toBeGreaterThan(0.6);
  });

  it('returns "low" for a long-running rule the user keeps ignoring', () => {
    const longAgo = new Date(Date.now() - (STABLE_RULE_DAYS + 5) * MS_PER_DAY).toISOString();
    const recent = new Date().toISOString();
    const m = makeMemory({
      'unused-dependency-foo': {
        ruleId: 'unused-dependency-foo',
        firstSeenAt: longAgo,
        lastSeenAt: recent,
        runCount: STABLE_RULE_RUN_COUNT + 4,
        fixedCount: 0,
        suppressedInConfig: false,
      },
    });
    expect(computeRuleConfidence(m, 'unused-dependency-foo')).toBe('low');
    expect(computeRuleConfidenceScore(m, 'unused-dependency-foo')).toBeLessThan(0.3);
  });

  it('returns "medium" for a rule with too few runs to judge', () => {
    const recent = new Date().toISOString();
    const m = makeMemory({
      'new-rule': {
        ruleId: 'new-rule',
        firstSeenAt: recent,
        lastSeenAt: recent,
        runCount: 1, // not yet at STABLE_RULE_RUN_COUNT
        fixedCount: 0,
        suppressedInConfig: false,
      },
    });
    expect(computeRuleConfidence(m, 'new-rule')).toBe('medium');
    expect(computeRuleConfidenceScore(m, 'new-rule')).toBe(0.5);
  });

  it('returns "medium" for a rule that has many runs but is too young to be "low"', () => {
    const recent = new Date().toISOString();
    const m = makeMemory({
      'recent-rule': {
        ruleId: 'recent-rule',
        firstSeenAt: recent,
        lastSeenAt: recent,
        // High run count, but firstSeenAt is "now" so age < STABLE_RULE_DAYS.
        runCount: STABLE_RULE_RUN_COUNT + 5,
        fixedCount: 0,
        suppressedInConfig: false,
      },
    });
    expect(computeRuleConfidence(m, 'recent-rule')).toBe('medium');
  });

  it('"high" score grows with fix-rate', () => {
    const iso = new Date().toISOString();
    const lowFix = makeMemory({
      r: {
        ruleId: 'r',
        firstSeenAt: iso,
        lastSeenAt: iso,
        runCount: 10,
        fixedCount: 1,
        suppressedInConfig: false,
      },
    });
    const highFix = makeMemory({
      r: {
        ruleId: 'r',
        firstSeenAt: iso,
        lastSeenAt: iso,
        runCount: 10,
        fixedCount: 8,
        suppressedInConfig: false,
      },
    });
    expect(computeRuleConfidenceScore(highFix, 'r')).toBeGreaterThan(
      computeRuleConfidenceScore(lowFix, 'r'),
    );
  });
});
