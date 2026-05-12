import { describe, it, expect } from 'vitest';
import {
  CRY_WOLF_RUN_COUNT,
  NOISY_RUN_COUNT,
  computeSeverityDrift,
  type ProjectMemory,
} from '../../src/core/memory.js';

function makeMemory(rules: ProjectMemory['rules']): ProjectMemory {
  return {
    schemaVersion: 1,
    lastUpdatedAt: new Date().toISOString(),
    rules,
    hotspots: {},
    totalRuns: Object.values(rules).reduce((acc, r) => acc + r.runCount, 0),
  };
}

describe('Project Memory — severity drift (1.9+, loop #4)', () => {
  it('returns "stable" for an unseen rule (no signal)', () => {
    const m = makeMemory({});
    expect(computeSeverityDrift(m, 'unknown-rule')).toBe('stable');
  });

  it('returns "cry-wolf" for a rule fired CRY_WOLF_RUN_COUNT+ times with zero fixes', () => {
    const iso = new Date().toISOString();
    const m = makeMemory({
      'no-default-export-found': {
        ruleId: 'no-default-export-found',
        firstSeenAt: iso,
        lastSeenAt: iso,
        runCount: CRY_WOLF_RUN_COUNT,
        fixedCount: 0,
        suppressedInConfig: false,
      },
    });
    expect(computeSeverityDrift(m, 'no-default-export-found')).toBe('cry-wolf');
  });

  it('returns "noisy" for a rule with low fix-rate but below cry-wolf threshold', () => {
    const iso = new Date().toISOString();
    const m = makeMemory({
      'unused-import-warning': {
        ruleId: 'unused-import-warning',
        firstSeenAt: iso,
        lastSeenAt: iso,
        runCount: NOISY_RUN_COUNT + 1,
        // fixRate = 1 / 6 = 0.166... < NOISY_FIX_RATE (0.2)
        fixedCount: 1,
        suppressedInConfig: false,
      },
    });
    expect(computeSeverityDrift(m, 'unused-import-warning')).toBe('noisy');
  });

  it('returns "stable" once fix-rate clears the NOISY_FIX_RATE threshold', () => {
    const iso = new Date().toISOString();
    const m = makeMemory({
      'rule-with-fixes': {
        ruleId: 'rule-with-fixes',
        firstSeenAt: iso,
        lastSeenAt: iso,
        runCount: NOISY_RUN_COUNT + 5,
        // fixRate = 4 / 10 = 0.4 > NOISY_FIX_RATE (0.2)
        fixedCount: 4,
        suppressedInConfig: false,
      },
    });
    expect(computeSeverityDrift(m, 'rule-with-fixes')).toBe('stable');
  });

  it('treats suppressed-in-config rules as "stable" regardless of fix history', () => {
    // The user has explicitly opted out via .projscanrc; that's a
    // deliberate signal, not drift. Surfacing it as cry-wolf would
    // inflate the noisy-rules count needlessly.
    const iso = new Date().toISOString();
    const m = makeMemory({
      'silenced-rule': {
        ruleId: 'silenced-rule',
        firstSeenAt: iso,
        lastSeenAt: iso,
        runCount: CRY_WOLF_RUN_COUNT + 5,
        fixedCount: 0,
        suppressedInConfig: true,
      },
    });
    expect(computeSeverityDrift(m, 'silenced-rule')).toBe('stable');
  });

  it('returns "stable" for a rule below NOISY_RUN_COUNT (too few runs)', () => {
    const iso = new Date().toISOString();
    const m = makeMemory({
      'new-rule': {
        ruleId: 'new-rule',
        firstSeenAt: iso,
        lastSeenAt: iso,
        runCount: NOISY_RUN_COUNT - 1,
        fixedCount: 0,
        suppressedInConfig: false,
      },
    });
    expect(computeSeverityDrift(m, 'new-rule')).toBe('stable');
  });

  it('cry-wolf takes precedence when both conditions could match', () => {
    const iso = new Date().toISOString();
    const m = makeMemory({
      'long-ignored-rule': {
        ruleId: 'long-ignored-rule',
        firstSeenAt: iso,
        lastSeenAt: iso,
        runCount: CRY_WOLF_RUN_COUNT + 5,
        fixedCount: 0,
        suppressedInConfig: false,
      },
    });
    // Both "noisy" (low fix-rate) and "cry-wolf" (high run count, zero
    // fixes) are technically true; cry-wolf is the stronger signal.
    expect(computeSeverityDrift(m, 'long-ignored-rule')).toBe('cry-wolf');
  });
});
