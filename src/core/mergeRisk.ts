import { detectCollisions, type CollisionReport, type Collision } from './collisionDetector.js';

/**
 * Merge-risk preflight (4.x coordination arc, epic 3).
 *
 * Builds on collision detection: given the repo's in-flight worktrees and the
 * collisions between them, answer the two integration questions —
 *   1. In what order is it safe to merge? (integration order)
 *   2. Where does conflict risk concentrate? (hotspot files)
 * Local-first; reuses `detectCollisions` (no new git/graph machinery).
 */

export interface IntegrationStep {
  worktree: string;
  branch: string | null;
  /** Number of collisions this worktree is involved in. */
  collisionCount: number;
  changedFileCount: number;
  /** Sum of collision weights (high = 2, medium = 1) — lower merges first. */
  riskScore: number;
}

export interface RiskHotspot {
  file: string;
  /** Distinct worktrees that changed this file (>= 2 = contended). */
  worktrees: string[];
  severity: 'high' | 'medium';
}

export interface MergeRiskReport {
  schemaVersion: 1;
  available: boolean;
  reason?: string;
  integrationOrder: IntegrationStep[];
  hotFiles: RiskHotspot[];
  collisions: Collision[];
}

const WEIGHT: Record<Collision['severity'], number> = { high: 2, medium: 1 };

/** Pure derivation: turn a collision report into integration order + hotspots. */
export function deriveMergeRisk(report: CollisionReport): {
  integrationOrder: IntegrationStep[];
  hotFiles: RiskHotspot[];
} {
  if (!report.available) return { integrationOrder: [], hotFiles: [] };

  // Per-worktree collision involvement and risk weight.
  const involvement = new Map<string, { count: number; risk: number }>();
  const bump = (worktree: string, weight: number): void => {
    const cur = involvement.get(worktree) ?? { count: 0, risk: 0 };
    cur.count += 1;
    cur.risk += weight;
    involvement.set(worktree, cur);
  };
  for (const c of report.collisions) {
    bump(c.worktreeA, WEIGHT[c.severity]);
    bump(c.worktreeB, WEIGHT[c.severity]);
  }

  const integrationOrder: IntegrationStep[] = report.worktrees
    .map((w) => {
      const inv = involvement.get(w.path) ?? { count: 0, risk: 0 };
      return {
        worktree: w.path,
        branch: w.branch,
        collisionCount: inv.count,
        changedFileCount: w.changedFileCount,
        riskScore: inv.risk,
      };
    })
    // Merge the cleanest branch first: lowest risk, then fewest changed files,
    // then path for a stable, deterministic order.
    .sort(
      (a, b) =>
        a.riskScore - b.riskScore ||
        a.changedFileCount - b.changedFileCount ||
        a.worktree.localeCompare(b.worktree),
    );

  // Hotspot files: a file changed by >= 2 distinct worktrees (the highest-risk
  // merge-conflict signal). Tracks the worst severity seen for that file.
  const fileWorktrees = new Map<string, Set<string>>();
  const fileSeverity = new Map<string, 'high' | 'medium'>();
  const record = (file: string, worktree: string, severity: 'high' | 'medium'): void => {
    if (!fileWorktrees.has(file)) fileWorktrees.set(file, new Set());
    fileWorktrees.get(file)!.add(worktree);
    if (severity === 'high' || !fileSeverity.has(file)) fileSeverity.set(file, severity);
  };
  for (const c of report.collisions) {
    record(c.fileA, c.worktreeA, c.severity);
    record(c.fileB, c.worktreeB, c.severity);
  }

  const hotFiles: RiskHotspot[] = [...fileWorktrees.entries()]
    .filter(([, wts]) => wts.size >= 2)
    .map(([file, wts]) => ({
      file,
      worktrees: [...wts],
      severity: fileSeverity.get(file) ?? 'medium',
    }))
    .sort(
      (a, b) =>
        b.worktrees.length - a.worktrees.length ||
        (a.severity === b.severity ? 0 : a.severity === 'high' ? -1 : 1) ||
        a.file.localeCompare(b.file),
    );

  return { integrationOrder, hotFiles };
}

/** Compute merge-risk for the repo's in-flight worktrees. */
export async function computeMergeRisk(
  rootPath: string,
  options: { baseRef?: string } = {},
): Promise<MergeRiskReport> {
  const collisionReport = await detectCollisions(rootPath, options);
  const { integrationOrder, hotFiles } = deriveMergeRisk(collisionReport);
  return {
    schemaVersion: 1,
    available: collisionReport.available,
    ...(collisionReport.reason ? { reason: collisionReport.reason } : {}),
    integrationOrder,
    hotFiles,
    collisions: collisionReport.collisions,
  };
}
