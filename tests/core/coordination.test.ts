import { describe, it, expect } from 'vitest';
import {
  summarizeCoordination,
  coordinationHints,
  coordinationSignature,
} from '../../src/core/coordination.js';
import type { CollisionReport } from '../../src/core/collisionDetector.js';
import type { Claim } from '../../src/core/claims.js';
import type { MergeRiskReport } from '../../src/core/mergeRisk.js';

function collisionReport(p: Partial<CollisionReport>): CollisionReport {
  return { schemaVersion: 1, available: true, worktrees: [], collisions: [], ...p };
}
function mergeRisk(p: Partial<MergeRiskReport>): MergeRiskReport {
  return {
    schemaVersion: 1,
    available: true,
    integrationOrder: [],
    hotFiles: [],
    collisions: [],
    ...p,
  };
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
        evidence: {
          commandPath: 'projscan collisions',
          command: 'projscan collisions --format json',
          localOnly: true,
          worktreeCount: 2,
          currentWorktree: { path: '/a', branch: 'a', changedFileCount: 1, baseRef: 'main' },
          activeSignals: [
            {
              name: 'collisions',
              commandPath: 'projscan collisions',
              source: 'git worktree list, local diffs, and the local import graph',
            },
          ],
          validationWorkflow: [
            {
              command: 'projscan collisions --format json',
              purpose: 'Find same-file and dependency overlaps across sibling worktrees.',
            },
          ],
          sessionSeparation: {
            currentEvidence:
              'Current worktree evidence is read from local git/worktree state during this command.',
            rememberedContext:
              'Remembered session context is read separately through projscan session and agent-brief coordination hints.',
            command: 'projscan agent-brief --format json',
          },
        },
      }),
      claims: [claim('src/a.ts', 'a'), claim('src/b.ts', 'b')],
      mergeRisk: mergeRisk({}),
    });
    expect(out.available).toBe(true);
    expect(out.readiness).toBe('clear');
    expect(out.worktreeCount).toBe(2);
    expect(out.evidence).toMatchObject({
      commandPath: 'projscan coordinate',
      command: 'projscan coordinate --format json',
      localOnly: true,
      currentWorktree: { path: '/a', branch: 'a', changedFileCount: 1, baseRef: 'main' },
      activeSignals: [
        { name: 'collisions', commandPath: 'projscan collisions' },
        { name: 'claims', commandPath: 'projscan claim list' },
        { name: 'merge-risk', commandPath: 'projscan merge-risk' },
        { name: 'watch', commandPath: 'projscan coordinate --watch' },
      ],
    });
    expect(out.evidence?.validationWorkflow.map((step) => step.command)).toContain(
      'projscan coordinate --watch --interval 5 --format json',
    );
  });

  it('is conflicted when there is a high-severity collision', () => {
    const out = summarizeCoordination({
      collisionReport: collisionReport({
        worktrees: [
          { path: '/a', branch: 'a', changedFileCount: 1, baseRef: 'main' },
          { path: '/b', branch: 'b', changedFileCount: 1, baseRef: 'main' },
        ],
        collisions: [
          {
            kind: 'same-file',
            severity: 'high',
            worktreeA: '/a',
            fileA: 'x.ts',
            worktreeB: '/b',
            fileB: 'x.ts',
            reason: '',
          },
        ],
      }),
      claims: [],
      mergeRisk: mergeRisk({
        hotFiles: [{ file: 'x.ts', worktrees: ['/a', '/b'], severity: 'high' }],
      }),
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
          {
            kind: 'dependency',
            severity: 'medium',
            worktreeA: '/a',
            fileA: 'db.ts',
            worktreeB: '/b',
            fileB: 'auth.ts',
            reason: '',
          },
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

describe('coordinationSignature', () => {
  const base = (collisions: Parameters<typeof collisionReport>[0]['collisions'] = []) =>
    summarizeCoordination({
      collisionReport: collisionReport({
        worktrees: [
          { path: '/a', branch: 'a', changedFileCount: 1, baseRef: 'main' },
          { path: '/b', branch: 'b', changedFileCount: 1, baseRef: 'main' },
        ],
        collisions,
      }),
      claims: [],
      mergeRisk: mergeRisk({}),
    });

  it('is stable for equivalent coordination state', () => {
    expect(coordinationSignature(base())).toBe(coordinationSignature(base()));
  });

  it('changes when a collision appears', () => {
    const before = coordinationSignature(base());
    const after = coordinationSignature(
      base([
        {
          kind: 'same-file',
          severity: 'high',
          worktreeA: '/a',
          fileA: 'x.ts',
          worktreeB: '/b',
          fileB: 'x.ts',
          reason: '',
        },
      ]),
    );
    expect(after).not.toBe(before);
  });
});

describe('coordinationHints', () => {
  it('returns no hints when coordination is unavailable or clear', () => {
    expect(
      coordinationHints(
        summarizeCoordination({
          collisionReport: collisionReport({ available: false, reason: 'only one worktree' }),
          claims: [],
          mergeRisk: mergeRisk({ available: false }),
        }),
      ),
    ).toEqual([]);

    const clear = summarizeCoordination({
      collisionReport: collisionReport({
        worktrees: [
          { path: '/a', branch: 'a', changedFileCount: 1, baseRef: 'main' },
          { path: '/b', branch: 'b', changedFileCount: 1, baseRef: 'main' },
        ],
      }),
      claims: [],
      mergeRisk: mergeRisk({}),
    });
    expect(coordinationHints(clear)).toEqual([]);
  });

  it('summarizes collisions, contention, and merge order when conflicted', () => {
    const summary = summarizeCoordination({
      collisionReport: collisionReport({
        worktrees: [
          { path: '/a', branch: 'a', changedFileCount: 1, baseRef: 'main' },
          { path: '/b', branch: 'b', changedFileCount: 1, baseRef: 'main' },
        ],
        collisions: [
          {
            kind: 'same-file',
            severity: 'high',
            worktreeA: '/a',
            fileA: 'x.ts',
            worktreeB: '/b',
            fileB: 'x.ts',
            reason: '',
          },
        ],
      }),
      claims: [claim('src/auth.ts', 'a'), claim('src/auth.ts', 'b')],
      mergeRisk: mergeRisk({
        integrationOrder: [
          { worktree: '/b', branch: 'b', riskScore: 0 },
          { worktree: '/a', branch: 'a', riskScore: 2 },
        ],
      }),
    });
    const hints = coordinationHints(summary);
    expect(hints.length).toBeGreaterThan(0);
    expect(hints.join(' ')).toMatch(/conflicted/i);
    expect(hints.join(' ')).toMatch(/collision/i);
    expect(hints.join(' ')).toMatch(/contend/i);
    // every hint is a non-empty string
    expect(hints.every((h) => typeof h === 'string' && h.length > 0)).toBe(true);
  });
});
