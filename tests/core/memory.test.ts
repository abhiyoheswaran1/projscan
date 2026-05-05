import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {
  loadMemory,
  saveMemory,
  recordRun,
  findStableRules,
  forgetRule,
  MEMORY_SCHEMA_VERSION,
  STABLE_RULE_RUN_COUNT,
  STABLE_RULE_DAYS,
} from '../../src/core/memory.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-memory-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('loadMemory', () => {
  it('returns a fresh empty memory when none exists', async () => {
    const m = await loadMemory(tmp);
    expect(m.schemaVersion).toBe(MEMORY_SCHEMA_VERSION);
    expect(m.totalRuns).toBe(0);
    expect(m.rules).toEqual({});
  });

  it('returns fresh memory on corrupt JSON', async () => {
    await fs.mkdir(path.join(tmp, '.projscan-memory'), { recursive: true });
    await fs.writeFile(path.join(tmp, '.projscan-memory', 'memory.json'), '{not json', 'utf-8');
    const m = await loadMemory(tmp);
    expect(m.totalRuns).toBe(0);
  });

  it('returns fresh memory on unknown schema version', async () => {
    await fs.mkdir(path.join(tmp, '.projscan-memory'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, '.projscan-memory', 'memory.json'),
      JSON.stringify({
        schemaVersion: 999,
        lastUpdatedAt: new Date().toISOString(),
        rules: { foo: { ruleId: 'foo', firstSeenAt: '', lastSeenAt: '', runCount: 1, fixedCount: 0, suppressedInConfig: false } },
        totalRuns: 5,
      }),
    );
    const m = await loadMemory(tmp);
    expect(m.totalRuns).toBe(0);
    expect(m.rules).toEqual({});
  });
});

describe('recordRun', () => {
  it('inserts new rule observations on first run', async () => {
    const m = await loadMemory(tmp);
    recordRun(m, ['unused-dependency-foo', 'cycle-detected-1']);
    expect(m.totalRuns).toBe(1);
    expect(m.rules['unused-dependency-foo'].runCount).toBe(1);
    expect(m.rules['unused-dependency-foo'].fixedCount).toBe(0);
    expect(m.rules['cycle-detected-1'].runCount).toBe(1);
  });

  it('increments runCount on repeat sightings', async () => {
    const m = await loadMemory(tmp);
    recordRun(m, ['unused-dependency-foo']);
    recordRun(m, ['unused-dependency-foo']);
    recordRun(m, ['unused-dependency-foo']);
    expect(m.rules['unused-dependency-foo'].runCount).toBe(3);
    expect(m.totalRuns).toBe(3);
  });

  it('marks rules as suppressed when listed in suppressedIds', async () => {
    const m = await loadMemory(tmp);
    recordRun(m, ['rule-a'], ['rule-a']);
    expect(m.rules['rule-a'].suppressedInConfig).toBe(true);
  });

  it('records suppression for a rule even if it did not fire this run', async () => {
    const m = await loadMemory(tmp);
    // First run: rule-a fires.
    recordRun(m, ['rule-a']);
    // Second run: user suppressed rule-a; it no longer surfaces.
    recordRun(m, [], ['rule-a']);
    expect(m.rules['rule-a'].suppressedInConfig).toBe(true);
  });
});

describe('findStableRules', () => {
  it('surfaces rules that pass the run-count + age threshold without being fixed', async () => {
    const m = await loadMemory(tmp);
    // Simulate `STABLE_RULE_RUN_COUNT` runs over enough time:
    const longAgo = new Date(Date.now() - (STABLE_RULE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    m.rules['stable-rule'] = {
      ruleId: 'stable-rule',
      firstSeenAt: longAgo,
      lastSeenAt: new Date().toISOString(),
      runCount: STABLE_RULE_RUN_COUNT,
      fixedCount: 0,
      suppressedInConfig: false,
    };
    m.rules['recent-rule'] = {
      ruleId: 'recent-rule',
      firstSeenAt: new Date().toISOString(),
      lastSeenAt: new Date().toISOString(),
      runCount: STABLE_RULE_RUN_COUNT,
      fixedCount: 0,
      suppressedInConfig: false,
    };
    const stable = findStableRules(m);
    expect(stable.map((r) => r.ruleId)).toEqual(['stable-rule']);
  });

  it('excludes rules already suppressed in config', async () => {
    const m = await loadMemory(tmp);
    const longAgo = new Date(Date.now() - (STABLE_RULE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    m.rules['x'] = {
      ruleId: 'x',
      firstSeenAt: longAgo,
      lastSeenAt: new Date().toISOString(),
      runCount: STABLE_RULE_RUN_COUNT,
      fixedCount: 0,
      suppressedInConfig: true,
    };
    expect(findStableRules(m)).toEqual([]);
  });

  it('excludes rules with any fix history', async () => {
    const m = await loadMemory(tmp);
    const longAgo = new Date(Date.now() - (STABLE_RULE_DAYS + 1) * 24 * 60 * 60 * 1000).toISOString();
    m.rules['x'] = {
      ruleId: 'x',
      firstSeenAt: longAgo,
      lastSeenAt: new Date().toISOString(),
      runCount: STABLE_RULE_RUN_COUNT,
      fixedCount: 1,
      suppressedInConfig: false,
    };
    expect(findStableRules(m)).toEqual([]);
  });
});

describe('saveMemory + load round-trip', () => {
  it('round-trips rules and totalRuns', async () => {
    const m = await loadMemory(tmp);
    recordRun(m, ['rule-a', 'rule-b']);
    recordRun(m, ['rule-a']);
    await saveMemory(tmp, m);
    const reloaded = await loadMemory(tmp);
    expect(reloaded.totalRuns).toBe(2);
    expect(reloaded.rules['rule-a'].runCount).toBe(2);
    expect(reloaded.rules['rule-b'].runCount).toBe(1);
  });
});

describe('forgetRule', () => {
  it('drops a rule and returns true', async () => {
    const m = await loadMemory(tmp);
    recordRun(m, ['rule-a']);
    expect(forgetRule(m, 'rule-a')).toBe(true);
    expect(m.rules['rule-a']).toBeUndefined();
  });

  it('returns false for unknown rules', async () => {
    const m = await loadMemory(tmp);
    expect(forgetRule(m, 'never-existed')).toBe(false);
  });
});
