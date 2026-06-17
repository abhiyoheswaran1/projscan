import { detectCollisions, type CollisionReport } from './collisionDetector.js';
import { listClaims, findContendedClaims, type Claim } from './claims.js';
import { deriveMergeRisk, type MergeRiskReport } from './mergeRisk.js';
import {
  buildCoordinateCommandEvidence,
  type CoordinationCommandEvidence,
} from './coordinationEvidence.js';

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
  evidence?: CoordinationCommandEvidence;
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
      evidence: buildCoordinateCommandEvidence(
        collisionReport.evidence,
        collisionReport.worktrees.length,
      ),
    };
  }

  const high = collisionReport.collisions.filter((c) => c.severity === 'high').length;
  const medium = collisionReport.collisions.filter((c) => c.severity === 'medium').length;
  const contendedTargets = new Set(findContendedClaims(claims).map((c) => c.target)).size;

  const readiness: CoordinationReadiness =
    high > 0 || contendedTargets > 0 ? 'conflicted' : medium > 0 ? 'caution' : 'clear';

  const summary: string[] = [];
  summary.push(`${collisionReport.worktrees.length} in-flight worktree(s).`);
  if (high + medium > 0) {
    summary.push(`${high + medium} collision(s): ${high} high, ${medium} medium.`);
  } else {
    summary.push('No collisions across worktrees.');
  }
  if (contendedTargets > 0)
    summary.push(`${contendedTargets} claim target(s) contended by multiple agents.`);
  if (mergeRisk.hotFiles.length > 0)
    summary.push(`${mergeRisk.hotFiles.length} merge hotspot file(s).`);
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
    evidence: buildCoordinateCommandEvidence(
      collisionReport.evidence,
      collisionReport.worktrees.length,
    ),
  };
}

/**
 * Compact, agent-facing hints derived from a coordination summary — for
 * surfacing inside other reports (e.g. agent briefs). Empty when coordination
 * is unavailable or only one worktree is involved, so it adds nothing in the
 * common single-worktree case.
 */
export function coordinationHints(summary: CoordinationSummary): string[] {
  if (!summary.available) return [];
  const validation = coordinationValidationWorkflow(summary);
  if (summary.readiness === 'clear') {
    return summary.worktreeCount > 1
      ? [
          `Swarm readiness: clear across ${summary.worktreeCount} worktrees - ` +
            `${coordinationEvidenceBoundary(summary)}${validation} before parallel edits continue.`,
        ]
      : [];
  }
  const hints: string[] = [
    `Swarm readiness: ${summary.readiness} - ${coordinationEvidenceBoundary(summary)}${validation}.`,
  ];
  if (summary.collisions.high > 0) {
    hints.push(
      `${summary.collisions.high} high-severity collision(s) (same file edited by two worktrees).`,
    );
  }
  if (summary.collisions.medium > 0) {
    hints.push(`${summary.collisions.medium} dependency collision(s) across worktrees.`);
  }
  if (summary.claims.contendedTargets > 0) {
    hints.push(`${summary.claims.contendedTargets} claim target(s) contended by multiple agents.`);
  }
  const first = summary.mergeRisk.integrationOrder[0];
  if (first) hints.push(`Merge ${first.branch ?? first.worktree} first (lowest risk).`);
  return hints;
}

function coordinationEvidenceBoundary(summary: CoordinationSummary): string {
  const evidence = summary.evidence;
  if (!evidence) return '';
  return `\`${evidence.commandPath}\` local-only evidence sees ${currentWorktreeState(evidence)}; `;
}

function currentWorktreeState(
  evidence: NonNullable<CoordinationSummary['evidence']>,
): string {
  const current = evidence.currentWorktree;
  if (!current) return `${evidence.worktreeCount} worktree(s)`;
  const label = current.branch ?? current.path;
  const base = current.baseRef ?? 'working tree';
  return (
    `current worktree ${label} with ${current.changedFileCount} changed file(s) against ` +
    `${base} and ${current.uncommittedChangedFileCount} uncommitted file(s)`
  );
}

function coordinationValidationWorkflow(summary: CoordinationSummary): string {
  const commands = summary.evidence?.validationWorkflow.map((step) => step.command) ?? [];
  const coordinate = commands.find((command) => command === 'projscan coordinate --format json');
  const watch = commands.find((command) => command.startsWith('projscan coordinate --watch'));
  const agentBrief = commands.find((command) => command === 'projscan agent-brief --format json');

  return (
    'validate locally with ' +
    `\`${coordinate ?? 'projscan coordinate --format json'}\`, ` +
    `\`${watch ?? 'projscan coordinate --watch --interval 5 --format json'}\`, then ` +
    `\`${agentBrief ?? 'projscan agent-brief --format json'}\``
  );
}

/**
 * A stable fingerprint of the coordination state — readiness, worktree count,
 * collision counts, and contention. `--watch` mode re-emits only when this
 * changes between ticks, so stable state stays quiet.
 */
export function coordinationSignature(summary: CoordinationSummary): string {
  return [
    summary.available ? 'a' : 'u',
    summary.readiness,
    summary.worktreeCount,
    summary.collisions.high,
    summary.collisions.medium,
    summary.claims.contendedTargets,
    summary.mergeRisk.hotspotCount,
  ].join(':');
}

/** Run the full coordination read for the repo's in-flight worktrees. */
export async function computeCoordination(
  rootPath: string,
  options: { baseRef?: string } = {},
): Promise<CoordinationSummary> {
  // One collision pass feeds both the summary and the merge-risk derivation —
  // detectCollisions builds the code graph, so we must not run it twice.
  const [collisionReport, claims] = await Promise.all([
    detectCollisions(rootPath, options),
    listClaims(rootPath),
  ]);
  const { integrationOrder, hotFiles } = deriveMergeRisk(collisionReport);
  const mergeRisk: MergeRiskReport = {
    schemaVersion: 1,
    available: collisionReport.available,
    ...(collisionReport.reason ? { reason: collisionReport.reason } : {}),
    integrationOrder,
    hotFiles,
    collisions: collisionReport.collisions,
  };
  return summarizeCoordination({ collisionReport, claims, mergeRisk });
}
