import { detectCollisions, type CollisionReport } from './collisionDetector.js';
import { listClaims, findContendedClaims, type Claim } from './claims.js';
import { computeMergeRisk, type MergeRiskReport } from './mergeRisk.js';

/**
 * Coordination summary (4.x arc, epic 5 — the capstone).
 *
 * Composes the three swarm primitives — collisions, claims, and merge-risk —
 * into one budget-shaped read with a `readiness` verdict, so an agent gets a
 * single coordination signal instead of three calls. It is also the arc's
 * measurable outcome surface: the counts (collisions caught, contended claims,
 * merge hotspots) quantify what the coordination layer surfaced. Local-first.
 */

export type CoordinationReadiness = 'clear' | 'caution' | 'conflicted';

export interface CoordinationSummary {
  schemaVersion: 1;
  available: boolean;
  reason?: string;
  worktreeCount: number;
  collisions: { total: number; high: number; medium: number };
  claims: { total: number; contendedTargets: number };
  mergeRisk: {
    hotspotCount: number;
    integrationOrder: Array<{ worktree: string; branch: string | null; riskScore: number }>;
  };
  readiness: CoordinationReadiness;
  summary: string[];
}

export interface CoordinationInputs {
  collisionReport: CollisionReport;
  claims: Claim[];
  mergeRisk: MergeRiskReport;
}

/** Pure: fold the three swarm signals into a summary + readiness verdict. */
export function summarizeCoordination(inputs: CoordinationInputs): CoordinationSummary {
  const { collisionReport, claims, mergeRisk } = inputs;

  if (!collisionReport.available) {
    return {
      schemaVersion: 1,
      available: false,
      ...(collisionReport.reason ? { reason: collisionReport.reason } : {}),
      worktreeCount: collisionReport.worktrees.length,
      collisions: { total: 0, high: 0, medium: 0 },
      claims: { total: claims.length, contendedTargets: 0 },
      mergeRisk: { hotspotCount: 0, integrationOrder: [] },
      readiness: 'clear',
      summary: [collisionReport.reason ?? 'Coordination unavailable.'],
    };
  }

  const high = collisionReport.collisions.filter((c) => c.severity === 'high').length;
  const medium = collisionReport.collisions.filter((c) => c.severity === 'medium').length;
  const contendedTargets = new Set(findContendedClaims(claims).map((c) => c.target)).size;

  const readiness: CoordinationReadiness =
    high > 0 || contendedTargets > 0
      ? 'conflicted'
      : medium > 0
        ? 'caution'
        : 'clear';

  const summary: string[] = [];
  summary.push(`${collisionReport.worktrees.length} in-flight worktree(s).`);
  if (high + medium > 0) {
    summary.push(`${high + medium} collision(s): ${high} high, ${medium} medium.`);
  } else {
    summary.push('No collisions across worktrees.');
  }
  if (contendedTargets > 0) summary.push(`${contendedTargets} claim target(s) contended by multiple agents.`);
  if (mergeRisk.hotFiles.length > 0) summary.push(`${mergeRisk.hotFiles.length} merge hotspot file(s).`);
  if (mergeRisk.integrationOrder.length > 0) {
    const first = mergeRisk.integrationOrder[0];
    summary.push(`Merge ${first.branch ?? first.worktree} first (lowest risk).`);
  }

  return {
    schemaVersion: 1,
    available: true,
    worktreeCount: collisionReport.worktrees.length,
    collisions: { total: collisionReport.collisions.length, high, medium },
    claims: { total: claims.length, contendedTargets },
    mergeRisk: {
      hotspotCount: mergeRisk.hotFiles.length,
      integrationOrder: mergeRisk.integrationOrder.map((o) => ({
        worktree: o.worktree,
        branch: o.branch,
        riskScore: o.riskScore,
      })),
    },
    readiness,
    summary,
  };
}

/** Run the full coordination read for the repo's in-flight worktrees. */
export async function computeCoordination(
  rootPath: string,
  options: { baseRef?: string } = {},
): Promise<CoordinationSummary> {
  const [collisionReport, claims, mergeRisk] = await Promise.all([
    detectCollisions(rootPath, options),
    listClaims(rootPath),
    computeMergeRisk(rootPath, options),
  ]);
  return summarizeCoordination({ collisionReport, claims, mergeRisk });
}
