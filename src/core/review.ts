import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanRepository } from './repositoryScanner.js';
import { buildCodeGraph, type CodeGraph } from './codeGraph.js';
import { computeCoupling } from './couplingAnalyzer.js';
import { diffGraphs } from './prDiff.js';
import { detectWorkspaces, filterFilesByPackage } from './monorepo.js';
import { annotateReviewWithIntent, appendIntentToSummary, parseIntent } from './intent.js';
import { findRiskyFunctions } from './reviewRiskyFunctions.js';
import { decideVerdict } from './reviewVerdict.js';
import { buildContractChanges } from './reviewContractChanges.js';
import { buildReviewChangedFiles, indexHotspotRisk } from './reviewChangedFiles.js';
import { classifyNewCycles, scopeCyclesToFiles } from './reviewCycles.js';
import { buildReviewGraphEvidence } from './reviewGraphEvidence.js';
import { computeNewDataflowRisks, computeNewTaintFlows } from './reviewFlowDiffs.js';
import { buildReviewHeadSnapshot } from './reviewHeadSnapshot.js';
import { buildNoChangeReviewReport } from './reviewNoChanges.js';
import {
  diffManifests,
  readManifests,
  scopeDependencyChanges,
  type ManifestSnapshot,
} from './reviewManifests.js';
import type { PrDiffReport } from '../types/prDiff.js';
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

  // Base-side: spin up a worktree, scan, build graph. Best-effort cleanup.
  const worktreeDir = await mkTempWorktreeDir();
  let baseGraph: CodeGraph;
  let basePackageManifests: Map<string, ManifestSnapshot>;
  try {
    // `--` separator before positional args. baseSha is verified through
    // `rev-parse --verify ... ^{commit}` upstream so it's already sha-shaped,
    // but the separator is a defense-in-depth: if a future caller pipes a
    // user-supplied ref here without that verification, refs starting with
    // '-' (e.g. `--upload-pack=evil`) won't be parsed as flags.
    const addWorktree = await runGit(rootPath, [
      'worktree',
      'add',
      '--detach',
      '--',
      worktreeDir,
      baseSha,
    ]);
    if (addWorktree.code !== 0) {
      return unavailable(
        `Could not check out base ref "${baseRef}" for review: ${gitFailureSummary(addWorktree)}`,
        options,
        baseRef,
        headRef,
        headSha,
      );
    }
    const baseScan = await scanRepository(worktreeDir);
    baseGraph = await buildCodeGraph(worktreeDir, baseScan.files);
    basePackageManifests = await readManifests(worktreeDir);
  } finally {
    await runGit(rootPath, ['worktree', 'remove', '--force', worktreeDir]).catch(() => {});
    await fs.rm(worktreeDir, { recursive: true, force: true }).catch(() => {});
  }

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

async function resolvePackageScopeFiles(
  rootPath: string,
  graph: CodeGraph,
  packageName: string | undefined,
): Promise<Set<string> | undefined> {
  if (!packageName) return undefined;
  const workspaces = await detectWorkspaces(rootPath);
  return new Set(filterFilesByPackage(workspaces, packageName, [...graph.files.keys()]));
}

async function scopePrDiffToPackage(
  rootPath: string,
  prDiff: PrDiffReport,
  packageName: string | undefined,
): Promise<void> {
  if (!packageName) return;
  const workspaces = await detectWorkspaces(rootPath);
  const allChangedPaths = [
    ...prDiff.filesAdded,
    ...prDiff.filesRemoved,
    ...prDiff.filesModified.map((file) => file.relativePath),
  ];
  const allowed = new Set(filterFilesByPackage(workspaces, packageName, allChangedPaths));
  prDiff.filesAdded = prDiff.filesAdded.filter((file) => allowed.has(file));
  prDiff.filesRemoved = prDiff.filesRemoved.filter((file) => allowed.has(file));
  prDiff.filesModified = prDiff.filesModified.filter((file) => allowed.has(file.relativePath));
  prDiff.totalFilesChanged =
    prDiff.filesAdded.length + prDiff.filesRemoved.length + prDiff.filesModified.length;
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

async function mkTempWorktreeDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-review-'));
}

interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

function gitFailureSummary(result: GitResult): string {
  const message = (result.stderr || result.stdout).trim().replace(/\s+/g, ' ');
  return message || `git exited with code ${result.code}`;
}

/**
 * 1.9+ — Default cap on any single `git` invocation made from the
 * review pipeline (worktree add/remove, rev-parse, etc.). Without it
 * a hung git operation (credential prompt, blocking hook, dead remote)
 * would hang the MCP server until kill. Mirror of prDiff.ts's same
 * default; kept as a sibling rather than shared because runGit here
 * is intentionally minimal and `prDiff.runGit` carries extra
 * timeoutMs override plumbing that this caller doesn't need.
 */
const DEFAULT_GIT_TIMEOUT_MS = 30_000;

function runGit(cwd: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    // Detach stdin so credential prompts / interactive hooks see EOF
    // and exit instead of waiting forever.
    const child = spawn('git', args, { cwd, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill('SIGKILL');
      reject(new Error(`git command timed out after ${DEFAULT_GIT_TIMEOUT_MS}ms`));
    }, DEFAULT_GIT_TIMEOUT_MS);
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}
