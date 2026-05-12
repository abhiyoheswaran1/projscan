import { describe, it, expect } from 'vitest';
import { __internal } from '../../src/mcp/tools/reviewWatch.js';
import type { ReviewReport } from '../../src/types.js';

const { snapshotOf, signatureOf, diffSnapshots } = __internal;

function baseReport(): ReviewReport {
  return {
    available: true,
    base: { ref: 'main', resolvedSha: 'aaa' },
    head: { ref: 'HEAD', resolvedSha: 'bbb' },
    prDiff: {
      available: true,
      base: { ref: 'main', resolvedSha: 'aaa' },
      head: { ref: 'HEAD', resolvedSha: 'bbb' },
      filesAdded: [],
      filesRemoved: [],
      filesModified: [],
      totalFilesChanged: 0,
    },
    changedFiles: [],
    newCycles: [],
    riskyFunctions: [],
    dependencyChanges: [],
    newTaintFlows: [],
    verdict: 'ok',
    summary: [],
  };
}

describe('projscan_review_watch — snapshot + delta (1.9)', () => {
  it('snapshotOf produces sorted, deterministic fingerprints', () => {
    const r = baseReport();
    r.newCycles = [
      { files: ['b.js', 'a.js'], size: 2, classification: 'new' },
      { files: ['c.js', 'd.js'], size: 2, classification: 'expanded' },
    ];
    const snap = snapshotOf(r);
    // Cycle keys are each cycle's files sorted within, then the list sorted.
    expect(snap.cycleKeys).toEqual(['a.js|b.js', 'c.js|d.js']);
  });

  it('signature is stable across equivalent reports', () => {
    const a = baseReport();
    const b = baseReport();
    expect(signatureOf(snapshotOf(a))).toBe(signatureOf(snapshotOf(b)));
  });

  it('signature changes when verdict changes', () => {
    const a = baseReport();
    const b = baseReport();
    b.verdict = 'review';
    expect(signatureOf(snapshotOf(a))).not.toBe(signatureOf(snapshotOf(b)));
  });

  it('diffSnapshots reports added cycles', () => {
    const a = baseReport();
    const b = baseReport();
    b.newCycles = [{ files: ['x.js', 'y.js'], size: 2, classification: 'new' }];
    const delta = diffSnapshots(snapshotOf(a), snapshotOf(b));
    expect(delta.cycles.added).toBe(1);
    expect(delta.cycles.removed).toBe(0);
    expect(delta.changeKinds).toContain('cycles');
  });

  it('diffSnapshots reports removed cycles', () => {
    const a = baseReport();
    a.newCycles = [{ files: ['x.js', 'y.js'], size: 2, classification: 'new' }];
    const b = baseReport();
    const delta = diffSnapshots(snapshotOf(a), snapshotOf(b));
    expect(delta.cycles.added).toBe(0);
    expect(delta.cycles.removed).toBe(1);
    expect(delta.changeKinds).toContain('cycles');
  });

  it('diffSnapshots reports added/removed/bumped dep records separately', () => {
    const a = baseReport();
    const b = baseReport();
    b.dependencyChanges = [
      {
        workspace: '',
        manifestFile: 'package.json',
        added: [{ name: 'foo', version: '1.0.0', kind: 'dep' }],
        removed: [{ name: 'bar', version: '2.0.0', kind: 'dep' }],
        bumped: [{ name: 'baz', from: '1.0.0', to: '1.1.0', kind: 'dev' }],
      },
    ];
    const delta = diffSnapshots(snapshotOf(a), snapshotOf(b));
    expect(delta.deps.added).toBe(1);
    expect(delta.deps.removed).toBe(1);
    expect(delta.deps.bumped).toBe(1);
    expect(delta.changeKinds).toContain('deps');
  });

  it('diffSnapshots returns empty changeKinds when nothing moved', () => {
    const a = baseReport();
    a.newCycles = [{ files: ['x.js'], size: 1, classification: 'new' }];
    const b = baseReport();
    b.newCycles = [{ files: ['x.js'], size: 1, classification: 'new' }];
    const delta = diffSnapshots(snapshotOf(a), snapshotOf(b));
    expect(delta.changeKinds).toEqual([]);
    expect(delta.cycles.added).toBe(0);
    expect(delta.cycles.removed).toBe(0);
  });

  it('diffSnapshots from null prev counts everything as added', () => {
    const next = baseReport();
    next.newCycles = [{ files: ['x.js'], size: 1, classification: 'new' }];
    next.newTaintFlows = [
      {
        sourceFn: 'getSecret',
        sinkFn: 'exec',
        source: 'env',
        sink: 'spawn',
        pathLength: 2,
        files: ['x.js', 'y.js'],
      },
    ];
    const delta = diffSnapshots(null, snapshotOf(next));
    expect(delta.cycles.added).toBe(1);
    expect(delta.taint.added).toBe(1);
    expect(delta.changeKinds).toContain('cycles');
    expect(delta.changeKinds).toContain('taint');
    // Verdict / SHA fields always count as "changed" against a null prev.
    expect(delta.changeKinds).toContain('verdict');
    expect(delta.changeKinds).toContain('baseSha');
    expect(delta.changeKinds).toContain('headSha');
  });

  it('risky-function keys carry file + name (same name in different files is two entries)', () => {
    const a = baseReport();
    const b = baseReport();
    b.riskyFunctions = [
      {
        file: 'a.js',
        name: 'handle',
        line: 1,
        endLine: 5,
        cyclomaticComplexity: 12,
        baseCc: null,
        reason: 'added',
      },
      {
        file: 'b.js',
        name: 'handle',
        line: 1,
        endLine: 5,
        cyclomaticComplexity: 15,
        baseCc: null,
        reason: 'added',
      },
    ];
    const delta = diffSnapshots(snapshotOf(a), snapshotOf(b));
    expect(delta.risky.added).toBe(2);
    expect(delta.changeKinds).toContain('risky');
  });
});
