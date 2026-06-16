import { describe, it, expect } from 'vitest';
import { deriveMergeRisk } from '../../src/core/mergeRisk.js';
import type { CollisionReport } from '../../src/core/collisionDetector.js';

function report(partial: Partial<CollisionReport>): CollisionReport {
  return {
    schemaVersion: 1,
    available: true,
    worktrees: [],
    collisions: [],
    ...partial,
  };
}

describe('deriveMergeRisk', () => {
  it('orders the least-entangled worktree first (lower risk score wins)', () => {
    const r = report({
      worktrees: [
        { path: '/wt/a', branch: 'a', changedFileCount: 3, baseRef: 'main' },
        { path: '/wt/b', branch: 'b', changedFileCount: 1, baseRef: 'main' },
        { path: '/wt/c', branch: 'c', changedFileCount: 2, baseRef: 'main' },
      ],
      collisions: [
        // a <-> b same-file (high, weight 2 each); a <-> c dependency (medium, weight 1 each)
        {
          kind: 'same-file',
          severity: 'high',
          worktreeA: '/wt/a',
          fileA: 'x.ts',
          worktreeB: '/wt/b',
          fileB: 'x.ts',
          reason: '',
        },
        {
          kind: 'dependency',
          severity: 'medium',
          worktreeA: '/wt/a',
          fileA: 'y.ts',
          worktreeB: '/wt/c',
          fileB: 'z.ts',
          reason: '',
        },
      ],
    });

    const { integrationOrder } = deriveMergeRisk(r);
    // c has risk 1, b has risk 2, a has risk 3 → c, b, a.
    expect(integrationOrder.map((o) => o.branch)).toEqual(['c', 'b', 'a']);
    expect(integrationOrder[0].riskScore).toBe(1);
    expect(integrationOrder.find((o) => o.branch === 'a')?.riskScore).toBe(3);
  });

  it('ranks files changed by multiple worktrees as risk hotspots', () => {
    const r = report({
      worktrees: [
        { path: '/wt/a', branch: 'a', changedFileCount: 1, baseRef: 'main' },
        { path: '/wt/b', branch: 'b', changedFileCount: 1, baseRef: 'main' },
        { path: '/wt/c', branch: 'c', changedFileCount: 1, baseRef: 'main' },
      ],
      collisions: [
        {
          kind: 'same-file',
          severity: 'high',
          worktreeA: '/wt/a',
          fileA: 'hot.ts',
          worktreeB: '/wt/b',
          fileB: 'hot.ts',
          reason: '',
        },
        {
          kind: 'same-file',
          severity: 'high',
          worktreeA: '/wt/a',
          fileA: 'hot.ts',
          worktreeB: '/wt/c',
          fileB: 'hot.ts',
          reason: '',
        },
      ],
    });

    const { hotFiles } = deriveMergeRisk(r);
    expect(hotFiles[0].file).toBe('hot.ts');
    expect(hotFiles[0].worktrees.sort()).toEqual(['/wt/a', '/wt/b', '/wt/c']);
    expect(hotFiles[0].severity).toBe('high');
  });

  it('has no hotspots when collisions are purely cross-file dependencies', () => {
    const r = report({
      worktrees: [
        { path: '/wt/a', branch: 'a', changedFileCount: 1, baseRef: 'main' },
        { path: '/wt/b', branch: 'b', changedFileCount: 1, baseRef: 'main' },
      ],
      collisions: [
        {
          kind: 'dependency',
          severity: 'medium',
          worktreeA: '/wt/a',
          fileA: 'db.ts',
          worktreeB: '/wt/b',
          fileB: 'auth.ts',
          reason: '',
        },
      ],
    });

    const { hotFiles, integrationOrder } = deriveMergeRisk(r);
    expect(hotFiles).toEqual([]);
    // Both have equal risk (1); tie-break is deterministic by changed count then path.
    expect(integrationOrder.map((o) => o.branch)).toEqual(['a', 'b']);
  });

  it('passes through unavailability', () => {
    const r = report({
      available: false,
      reason: 'only one worktree',
      worktrees: [],
      collisions: [],
    });
    const out = deriveMergeRisk(r);
    expect(out.integrationOrder).toEqual([]);
    expect(out.hotFiles).toEqual([]);
  });
});
