import { diffGraphs } from './prDiff.js';
import { annotateReviewWithIntent, appendIntentToSummary, parseIntent } from './intent.js';
import { buildReviewBaseSnapshot } from './reviewBaseSnapshot.js';
import { buildReviewHeadSnapshot } from './reviewHeadSnapshot.js';
import { buildNoChangeReviewReport } from './reviewNoChanges.js';
import { isGitRepository, isWorktreeClean, pickDefaultBase, resolveSha } from './reviewRefs.js';
import { readManifests } from './reviewManifests.js';
import { buildReviewFindings } from './reviewFindings.js';
import type { ReviewReport } from '../types/review.js';

export { selectReviewTier, shapeReviewForTier } from './reviewTier.js';

export interface ReviewOptions {
  /** Base ref. Default: origin/main → main → origin/master → master → HEAD~1. */
  base?: string;
  /** Head ref. Default: HEAD. */
  head?: string;
  /**
   * 1.9+ — optional free-text PR description. When provided, projscan
   * parses it into an action type + scope tokens, classifies each
   * finding as expected / unexpected / out-of-scope, and surfaces an
   * `intent` echo plus `intentAnalysis` summary in the result. Does
   * NOT affect the verdict — verdict stays structural.
   */
  intent?: string;
  /** Optional workspace package name used to scope every review section before verdicting. */
  package?: string;
}

/**
 * Compose a one-shot PR review. Builds head + base graphs (worktree dance),
 * joins the structural diff with hotspot risk scores, surfaces cycles
 * introduced by the PR, flags newly-risky functions, and reports
 * package.json deltas. Output is shaped for an agent to read once and decide
 * whether to merge, request changes, or escalate.
 *
 * Verdict heuristic (rough; tune with usage):
 *   block  - max changed-file risk >= 80 OR a new cycle includes added files
 *   review - max changed-file risk >= 40 OR new high-CC functions OR
 *            major-dep-bump
 *   ok     - otherwise
 */
export async function computeReview(
  rootPath: string,
  options: ReviewOptions = {},
): Promise<ReviewReport> {
  const isRepo = await isGitRepository(rootPath);
  if (!isRepo) {
    return unavailable('Not a git repository - PR review requires git history.', options);
  }

  const headRef = options.head ?? 'HEAD';
  const baseRef = options.base ?? (await pickDefaultBase(rootPath));

  const headSha = await resolveSha(rootPath, headRef);
  const baseSha = await resolveSha(rootPath, baseRef);
  if (!baseSha) {
    return unavailable(
      `Could not resolve base ref "${baseRef}".`,
      options,
      baseRef,
      headRef,
      headSha,
    );
  }
  if (headSha && headSha === baseSha && (await isWorktreeClean(rootPath))) {
    const report = buildNoChangeReviewReport({ baseRef, baseSha, headRef, headSha });
    applyIntent(report, options.intent);
    return report;
  }

  const { graph: headGraph, hotspots: headHotspots } = await buildReviewHeadSnapshot(rootPath);

  const baseSnapshot = await buildReviewBaseSnapshot(rootPath, baseRef, baseSha);
  if (!baseSnapshot.available) {
    return unavailable(baseSnapshot.reason, options, baseRef, headRef, headSha);
  }
  const baseGraph = baseSnapshot.graph;
  const basePackageManifests = baseSnapshot.packageManifests;

  const headPackageManifests = await readManifests(rootPath);

  const prDiff = diffGraphs(baseRef, baseSha, headRef, headSha, baseGraph, headGraph);
  const findings = await buildReviewFindings({
    rootPath,
    packageName: options.package,
    prDiff,
    baseGraph,
    headGraph,
    headHotspots,
    basePackageManifests,
    headPackageManifests,
  });

  const report: ReviewReport = {
    available: true,
    base: { ref: baseRef, resolvedSha: baseSha },
    head: { ref: headRef, resolvedSha: headSha },
    prDiff,
    ...findings,
  };

  // 1.9+ — intent grounding. Parse the agent-supplied description,
  // annotate each finding with an alignment label, and append a
  // small intent summary to the verdict bullets. Does NOT change the
  // verdict — verdict stays structural.
  applyIntent(report, options.intent);

  return report;
}

function applyIntent(report: ReviewReport, rawIntent?: string): void {
  const intent = parseIntent(rawIntent);
  if (intent) {
    const analysis = annotateReviewWithIntent(report, intent);
    report.intent = {
      raw: intent.raw,
      action: intent.action,
      scopeTokens: intent.scopeTokens,
    };
    report.intentAnalysis = {
      totals: analysis.totals,
      notable: analysis.notable,
    };
    appendIntentToSummary(report.summary, analysis);
  }
}

function unavailable(
  reason: string,
  options: ReviewOptions,
  baseRef = options.base ?? '',
  headRef = options.head ?? 'HEAD',
  headSha: string | null = null,
): ReviewReport {
  return {
    available: false,
    reason,
    base: { ref: baseRef, resolvedSha: null },
    head: { ref: headRef, resolvedSha: headSha },
    prDiff: {
      available: false,
      reason,
      base: { ref: baseRef, resolvedSha: null },
      head: { ref: headRef, resolvedSha: headSha },
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
    newDataflowRisks: [],
    verdict: 'ok',
    summary: [reason],
  };
}
