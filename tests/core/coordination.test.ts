import { describe, it, expect } from 'vitest';
import { summarizeCoordination } from '../../src/core/coordination.js';
import type { CollisionReport } from '../../src/core/collisionDetector.js';
import type { Claim } from '../../src/core/claims.js';
import type { MergeRiskReport } from '../../src/core/mergeRisk.js';

function collisionReport(p: Partial<CollisionReport>): CollisionReport {
  return { schemaVersion: 1, available: true, worktrees: [], collisions: [], ...p };
}
function mergeRisk(p: Partial<MergeRiskReport>): MergeRiskReport {
  return { schemaVersion: 1, available: true, integrationOrder: [], hotFiles: [], collisions: [], ...p };
}
function claim(target: string, agent: string): Claim {
  return { id: `${agent}-${target}`, target, agent, claimedAt: '2026-06-05T00:00:00.000Z' };
}

describe('summarizeCoordination', () => {
  it('is clear when there are no collisions or contended claims', () => {
    const out = summarizeCoordination({
      collisionReport: collisionReport({
        worktrees: [
          { path: '/a', branch: 'a', changedFileCount: 1, baseRef: 'main' },
          { path: '/b', branch: 'b', changedFileCount: 1, baseRef: 'main' },
        ],
      }),
      claims: [claim('src/a.ts', 'a'), claim('src/b.ts', 'b')],
      mergeRisk: mergeRisk({}),
    });
    expect(out.available).toBe(true);
    expect(out.readiness).toBe('clear');
    expect(out.worktreeCount).toBe(2);
  });

  it('is conflicted when there is a high-severity collision', () => {
    const out = summarizeCoordination({
      collisionReport: collisionReport({
        worktrees: [
          { path: '/a', branch: 'a', changedFileCount: 1, baseRef: 'main' },
          { path: '/b', branch: 'b', changedFileCount: 1, baseRef: 'main' },
        ],
        collisions: [
          { kind: 'same-file', severity: 'high', worktreeA: '/a', fileA: 'x.ts', worktreeB: '/b', fileB: 'x.ts', reason: '' },
        ],
      }),
      claims: [],
      mergeRisk: mergeRisk({ hotFiles: [{ file: 'x.ts', worktrees: ['/a', '/b'], severity: 'high' }] }),
    });
    expect(out.readiness).toBe('conflicted');
    expect(out.collisions).toEqual({ total: 1, high: 1, medium: 0 });
    expect(out.mergeRisk.hotspotCount).toBe(1);
  });

  it('is conflicted when a claim is contended by two agents', () => {
    const out = summarizeCoordination({
      collisionReport: collisionReport({
        worktrees: [{ path: '/a', branch: 'a', changedFileCount: 0, baseRef: 'main' }],
      }),
      claims: [claim('src/auth.ts', 'a'), claim('src/auth.ts', 'b')],
      mergeRisk: mergeRisk({}),
    });
    expect(out.claims).toEqual({ total: 2, contendedTargets: 1 });
    expect(out.readiness).toBe('conflicted');
  });

  it('is caution for medium-only collisions', () => {
    const out = summarizeCoordination({
      collisionReport: collisionReport({
        worktrees: [
          { path: '/a', branch: 'a', changedFileCount: 1, baseRef: 'main' },
          { path: '/b', branch: 'b', changedFileCount: 1, baseRef: 'main' },
        ],
        collisions: [
          { kind: 'dependency', severity: 'medium', worktreeA: '/a', fileA: 'db.ts', worktreeB: '/b', fileB: 'auth.ts', reason: '' },
        ],
      }),
      claims: [],
      mergeRisk: mergeRisk({}),
    });
    expect(out.readiness).toBe('caution');
    expect(out.collisions.medium).toBe(1);
  });

  it('passes through unavailability', () => {
    const out = summarizeCoordination({
      collisionReport: collisionReport({ available: false, reason: 'only one worktree' }),
      claims: [],
      mergeRisk: mergeRisk({ available: false }),
    });
    expect(out.available).toBe(false);
    expect(out.reason).toBe('only one worktree');
  });
});
