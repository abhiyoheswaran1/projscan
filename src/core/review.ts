import { computeCoupling } from './couplingAnalyzer.js';
import { diffGraphs } from './prDiff.js';
import { annotateReviewWithIntent, appendIntentToSummary, parseIntent } from './intent.js';
import { findRiskyFunctions } from './reviewRiskyFunctions.js';
import { decideVerdict } from './reviewVerdict.js';
import { buildContractChanges } from './reviewContractChanges.js';
import { buildReviewChangedFiles, indexHotspotRisk } from './reviewChangedFiles.js';
import { classifyNewCycles, scopeCyclesToFiles } from './reviewCycles.js';
import { buildReviewGraphEvidence } from './reviewGraphEvidence.js';
import { computeNewDataflowRisks, computeNewTaintFlows } from './reviewFlowDiffs.js';
import { buildReviewBaseSnapshot } from './reviewBaseSnapshot.js';
import { runReviewGit as runGit } from './reviewGit.js';
import { buildReviewHeadSnapshot } from './reviewHeadSnapshot.js';
import { buildNoChangeReviewReport } from './reviewNoChanges.js';
import { resolvePackageScopeFiles, scopePrDiffToPackage } from './reviewPackageScope.js';
import { diffManifests, readManifests, scopeDependencyChanges } from './reviewManifests.js';
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
  await scopePrDiffToPackage(rootPath, prDiff, options.package);
  const graphScopeFiles = await resolvePackageScopeFiles(rootPath, headGraph, options.package);

  // Build the per-file enriched view. Index head hotspots by path for O(1) lookup.
  const changedFiles = buildReviewChangedFiles(
    prDiff,
    baseGraph,
    headGraph,
    indexHotspotRisk(headHotspots.hotspots),
  );

  // Cycles: compute on both sides; classify head cycles as new/expanded based
  // on overlap with base cycles.
  const headCoupling = computeCoupling(headGraph);
  const baseCoupling = computeCoupling(baseGraph);
  const newCycles = scopeCyclesToFiles(
    classifyNewCycles(baseCoupling.cycles, headCoupling.cycles, prDiff.filesAdded),
    graphScopeFiles,
  );

  // Risky functions: compare per-file function lists between base and head.
  const riskyFunctions = findRiskyFunctions(baseGraph, headGraph, prDiff);

  // Dependency changes across root + workspaces.
  const dependencyChanges = scopeDependencyChanges(
    diffManifests(basePackageManifests, headPackageManifests),
    options.package,
  );
  const contractChanges = buildContractChanges(
    prDiff,
    baseGraph,
    headGraph,
    basePackageManifests,
    headPackageManifests,
    options.package,
  );

  // 1.6+ — taint flows newly introduced at head. A flow is "new" iff
  //   (a) the (sourceFn, sinkFn, source, sink) flow didn't exist at base, AND
  //   (b) at least one file along the flow's path is in the PR diff.
  // (b) prevents a base-graph parse failure from avalanching every
  // pre-existing head flow into a false "new" verdict. Project config
  // adds user-declared sources/sinks on top of the built-in defaults.
  const touchedFiles = new Set<string>([
    ...prDiff.filesAdded,
    ...prDiff.filesRemoved,
    ...prDiff.filesModified.map((f) => f.relativePath),
  ]);
  const newTaintFlows = await computeNewTaintFlows(rootPath, baseGraph, headGraph, touchedFiles);
  const newDataflowRisks = await computeNewDataflowRisks(
    rootPath,
    baseGraph,
    headGraph,
    touchedFiles,
  );
  const graphEvidence = buildReviewGraphEvidence(
    headGraph,
    touchedFiles,
    newDataflowRisks.length,
    graphScopeFiles,
  );

  // Verdict.
  const { verdict, summary } = decideVerdict(
    changedFiles,
    newCycles,
    riskyFunctions,
    dependencyChanges,
    contractChanges,
    newTaintFlows,
    newDataflowRisks,
  );

  const report: ReviewReport = {
    available: true,
    base: { ref: baseRef, resolvedSha: baseSha },
    head: { ref: headRef, resolvedSha: headSha },
    prDiff,
    changedFiles,
    newCycles,
    riskyFunctions,
    dependencyChanges,
    contractChanges,
    newTaintFlows,
    newDataflowRisks,
    graphEvidence,
    verdict,
    summary,
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

// ── git helpers (mirror prDiff.ts; kept private to keep coupling low) ──

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

async function isGitRepository(rootPath: string): Promise<boolean> {
  const { code } = await runGit(rootPath, ['rev-parse', '--is-inside-work-tree']).catch(() => ({
    code: 1,
    stdout: '',
    stderr: '',
  }));
  return code === 0;
}

async function isWorktreeClean(rootPath: string): Promise<boolean> {
  const unstaged = await runGit(rootPath, ['diff', '--quiet', '--ignore-submodules', '--']).catch(
    () => ({
      code: 1,
      stdout: '',
      stderr: '',
    }),
  );
  if (unstaged.code !== 0) return false;

  const staged = await runGit(rootPath, [
    'diff',
    '--cached',
    '--quiet',
    '--ignore-submodules',
    '--',
  ]).catch(() => ({
    code: 1,
    stdout: '',
    stderr: '',
  }));
  if (staged.code !== 0) return false;

  const untracked = await runGit(rootPath, ['ls-files', '--others', '--exclude-standard']).catch(
    () => ({
      code: 1,
      stdout: '',
      stderr: '',
    }),
  );
  return untracked.code === 0 && untracked.stdout.trim().length === 0;
}

async function resolveSha(rootPath: string, ref: string): Promise<string | null> {
  const { code, stdout } = await runGit(rootPath, [
    'rev-parse',
    '--verify',
    `${ref}^{commit}`,
  ]).catch(() => ({ code: 1, stdout: '', stderr: '' }));
  if (code !== 0) return null;
  const sha = stdout.trim();
  return sha || null;
}

async function pickDefaultBase(rootPath: string): Promise<string> {
  for (const candidate of ['origin/main', 'main', 'origin/master', 'master']) {
    if (await resolveSha(rootPath, candidate)) return candidate;
  }
  return 'HEAD~1';
}
