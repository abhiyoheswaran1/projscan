import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanRepository } from './repositoryScanner.js';
import { collectIssues } from './issueEngine.js';
import { buildCodeGraph, type CodeGraph } from './codeGraph.js';
import { analyzeHotspots } from './hotspotAnalyzer.js';
import { computeCoupling } from './couplingAnalyzer.js';
import { diffGraphs } from './prDiff.js';
import { computeTaint } from './taint.js';
import { computeDataflow } from './dataflow.js';
import { annotateReviewWithIntent, appendIntentToSummary, parseIntent } from './intent.js';
import { loadConfig } from '../utils/config.js';
import type {
  ReviewCycle,
  ReviewContractChange,
  ReviewDataflowRisk,
  ReviewDependencyChange,
  ReviewFile,
  ReviewFunction,
  ReviewReport,
  ReviewTaintFlow,
  ReviewTier,
  PrDiffReport,
} from '../types.js';

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
}

const HIGH_CC_THRESHOLD = 10;
const CC_JUMP_THRESHOLD = 5;
const RISK_VERDICT_BLOCK_SCORE = 80;
const RISK_VERDICT_REVIEW_SCORE = 40;

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
    return unavailable(`Could not resolve base ref "${baseRef}".`, options, baseRef, headRef, headSha);
  }
  if (headSha && headSha === baseSha) {
    const report: ReviewReport = {
      available: true,
      base: { ref: baseRef, resolvedSha: baseSha },
      head: { ref: headRef, resolvedSha: headSha },
      prDiff: {
        available: true,
        base: { ref: baseRef, resolvedSha: baseSha },
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
      contractChanges: [],
      newTaintFlows: [],
      newDataflowRisks: [],
      verdict: 'ok',
      summary: ['No structural changes detected between base and head.'],
    };
    applyIntent(report, options.intent);
    return report;
  }

  // Head-side data: scan + graph + issues + hotspots.
  const headScan = await scanRepository(rootPath);
  const headGraph = await buildCodeGraph(rootPath, headScan.files);
  const headIssues = await collectIssues(rootPath, headScan.files);
  const headHotspots = await analyzeHotspots(rootPath, headScan.files, headIssues, {
    limit: 200,
    graph: headGraph,
  });

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

  // Build the per-file enriched view. Index head hotspots by path for O(1) lookup.
  const hotspotByPath = new Map<string, number>();
  for (const h of headHotspots.hotspots) hotspotByPath.set(h.relativePath, h.riskScore);

  const changedFiles: ReviewFile[] = [];
  for (const f of prDiff.filesAdded) {
    const headFile = headGraph.files.get(f);
    changedFiles.push({
      relativePath: f,
      status: 'added',
      riskScore: hotspotByPath.get(f) ?? null,
      cyclomaticComplexity: headFile?.parseOk ? headFile.cyclomaticComplexity : null,
      cyclomaticDelta: null,
      exportsAdded: headFile?.exports.length ?? 0,
      exportsRemoved: 0,
      importsAdded: headFile?.imports.length ?? 0,
      importsRemoved: 0,
    });
  }
  for (const f of prDiff.filesRemoved) {
    const baseFile = baseGraph.files.get(f);
    changedFiles.push({
      relativePath: f,
      status: 'removed',
      riskScore: null,
      cyclomaticComplexity: null,
      cyclomaticDelta: null,
      exportsAdded: 0,
      exportsRemoved: baseFile?.exports.length ?? 0,
      importsAdded: 0,
      importsRemoved: baseFile?.imports.length ?? 0,
    });
  }
  for (const f of prDiff.filesModified) {
    const headFile = headGraph.files.get(f.relativePath);
    changedFiles.push({
      relativePath: f.relativePath,
      status: 'modified',
      riskScore: hotspotByPath.get(f.relativePath) ?? null,
      cyclomaticComplexity: headFile?.parseOk ? headFile.cyclomaticComplexity : null,
      cyclomaticDelta: f.cyclomaticDelta,
      exportsAdded: f.exportsAdded.length,
      exportsRemoved: f.exportsRemoved.length,
      importsAdded: f.importsAdded.length,
      importsRemoved: f.importsRemoved.length,
    });
  }
  changedFiles.sort((a, b) => (b.riskScore ?? 0) - (a.riskScore ?? 0));

  // Cycles: compute on both sides; classify head cycles as new/expanded based
  // on overlap with base cycles.
  const headCoupling = computeCoupling(headGraph);
  const baseCoupling = computeCoupling(baseGraph);
  const newCycles = classifyNewCycles(baseCoupling.cycles, headCoupling.cycles, prDiff.filesAdded);

  // Risky functions: compare per-file function lists between base and head.
  const riskyFunctions = findRiskyFunctions(baseGraph, headGraph, prDiff);

  // Dependency changes across root + workspaces.
  const dependencyChanges = diffManifests(basePackageManifests, headPackageManifests);
  const contractChanges = buildContractChanges(
    prDiff,
    baseGraph,
    headGraph,
    basePackageManifests,
    headPackageManifests,
  );

  // 1.6+ — taint flows newly introduced at head. A flow is "new" iff
  //   (a) the (sourceFn, sinkFn) pair didn't exist at base, AND
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
  const newDataflowRisks = await computeNewDataflowRisks(rootPath, baseGraph, headGraph, touchedFiles);

  // Verdict.
  const { verdict, summary } = decideVerdict(
    changedFiles,
    newCycles,
    riskyFunctions,
    dependencyChanges,
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

async function computeNewTaintFlows(
  rootPath: string,
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
  touchedFiles: Set<string>,
): Promise<ReviewTaintFlow[]> {
  const { config } = await loadConfig(rootPath);
  const sources = config.taint?.sources ?? [];
  const sinks = config.taint?.sinks ?? [];
  const baseReport = computeTaint(baseGraph, { sources, sinks });
  const headReport = computeTaint(headGraph, { sources, sinks });
  if (!headReport.available) return [];
  const baseFlowKeys = new Set(
    baseReport.available ? baseReport.flows.map((f) => `${f.sourceFn}::${f.sinkFn}`) : [],
  );
  const out: ReviewTaintFlow[] = [];
  for (const flow of headReport.flows) {
    const key = `${flow.sourceFn}::${flow.sinkFn}`;
    if (baseFlowKeys.has(key)) continue;
    // Restrict to flows the PR actually had a hand in: at least one file
    // along the path must be in the change set. A genuinely-introduced flow
    // necessarily touches a modified file (the new source-fn, sink-fn, or
    // intermediate hop), so this is a strict refinement — never drops a
    // real flow. Without it, a base-graph parse failure would surface every
    // pre-existing head flow as "new" and avalanche the verdict to block.
    if (!flow.files.some((f) => touchedFiles.has(f))) continue;
    if (flow.files.some(isTestLikePath)) continue;
    out.push({
      sourceFn: flow.sourceFn,
      sinkFn: flow.sinkFn,
      source: flow.source,
      sink: flow.sink,
      pathLength: flow.path.length,
      files: flow.files,
    });
  }
  out.sort((a, b) => {
    if (a.pathLength !== b.pathLength) return a.pathLength - b.pathLength;
    return a.sourceFn.localeCompare(b.sourceFn);
  });
  return out;
}

async function computeNewDataflowRisks(
  rootPath: string,
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
  touchedFiles: Set<string>,
): Promise<ReviewDataflowRisk[]> {
  const { config } = await loadConfig(rootPath);
  const sources = config.taint?.sources ?? [];
  const sinks = config.taint?.sinks ?? [];
  const baseReport = computeDataflow(baseGraph, { sources, sinks });
  const headReport = computeDataflow(headGraph, { sources, sinks });
  if (!headReport.available) return [];
  const baseRiskKeys = new Set(
    baseReport.available ? baseReport.risks.map(reviewDataflowRiskKey) : [],
  );
  const out: ReviewDataflowRisk[] = [];
  for (const risk of headReport.risks) {
    // Legacy taint flows already have their own stable review field. Keep
    // this additive review list focused on deeper 3.0 dataflow findings.
    if (risk.kind !== 'bridge') continue;
    const key = reviewDataflowRiskKey(risk);
    if (baseRiskKeys.has(key)) continue;
    if (!risk.files.some((f) => touchedFiles.has(f))) continue;
    if (!isReviewBlockingDataflowRisk(risk)) continue;
    out.push({
      kind: risk.kind,
      sourceFn: risk.sourceFn,
      sinkFn: risk.sinkFn,
      bridgeFn: risk.bridgeFn,
      source: risk.source,
      sink: risk.sink,
      pathLength: risk.pathLength,
      files: risk.files,
      severity: risk.severity,
      confidence: risk.confidence,
    });
  }
  out.sort((a, b) => {
    if (a.pathLength !== b.pathLength) return a.pathLength - b.pathLength;
    return `${a.bridgeFn ?? ''}:${a.sourceFn}:${a.sinkFn}`.localeCompare(
      `${b.bridgeFn ?? ''}:${b.sourceFn}:${b.sinkFn}`,
    );
  });
  return out;
}


const BROAD_FILE_IO_REVIEW_SOURCES = new Set(['readFile', 'readFileSync']);
const BROAD_FILE_IO_REVIEW_SINKS = new Set(['writeFile', 'writeFileSync', 'unlink', 'rm', 'rmSync']);

function isReviewBlockingDataflowRisk(risk: { source: string; sink: string; files: string[] }): boolean {
  if (risk.files.some(isTestLikePath)) return false;
  if (BROAD_FILE_IO_REVIEW_SOURCES.has(risk.source)) return false;
  if (BROAD_FILE_IO_REVIEW_SINKS.has(risk.sink)) return false;
  return true;
}

function isTestLikePath(file: string): boolean {
  const normalized = file.replace(/\\/g, '/');
  return (
    normalized.startsWith('test/') ||
    normalized.startsWith('tests/') ||
    normalized.includes('/test/') ||
    normalized.includes('/tests/') ||
    normalized.includes('/__tests__/') ||
    /\.(test|spec)\.[^/]+$/.test(normalized)
  );
}

function reviewDataflowRiskKey(risk: {
  kind: string;
  bridgeFn?: string;
  sourceFn: string;
  sinkFn: string;
  source: string;
  sink: string;
  files?: string[];
}): string {
  return `${risk.kind}:${risk.bridgeFn ?? ''}:${risk.sourceFn}:${risk.sinkFn}:${risk.source}:${risk.sink}:${risk.files?.join('|') ?? ''}`;
}

// ── cycle classification ──────────────────────────────────

function classifyNewCycles(
  baseCycles: { files: string[] }[],
  headCycles: { files: string[] }[],
  filesAddedInPr: string[],
): ReviewCycle[] {
  const added = new Set(filesAddedInPr);
  const out: ReviewCycle[] = [];
  for (const head of headCycles) {
    const headSet = new Set(head.files);
    let bestOverlap = 0;
    for (const base of baseCycles) {
      let overlap = 0;
      for (const f of base.files) if (headSet.has(f)) overlap++;
      if (overlap > bestOverlap) bestOverlap = overlap;
    }
    if (bestOverlap === 0) {
      out.push({ files: [...head.files].sort(), size: head.files.length, classification: 'new' });
    } else if (bestOverlap < head.files.length) {
      // cycle existed but grew
      out.push({
        files: [...head.files].sort(),
        size: head.files.length,
        classification: 'expanded',
      });
    }
    // bestOverlap === head.files.length means the cycle is identical at base.
  }
  // Bump cycles where any file is newly added to the very front.
  out.sort((a, b) => {
    const aTouchesAdded = a.files.some((f) => added.has(f)) ? 0 : 1;
    const bTouchesAdded = b.files.some((f) => added.has(f)) ? 0 : 1;
    if (aTouchesAdded !== bTouchesAdded) return aTouchesAdded - bTouchesAdded;
    return b.size - a.size;
  });
  return out;
}

// ── risky function detection ──────────────────────────────

function findRiskyFunctions(
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
  prDiff: { filesAdded: string[]; filesModified: { relativePath: string }[] },
): ReviewFunction[] {
  const out: ReviewFunction[] = [];

  for (const file of prDiff.filesAdded) {
    const head = headGraph.files.get(file);
    if (!head) continue;
    for (const fn of head.functions ?? []) {
      if (fn.cyclomaticComplexity >= HIGH_CC_THRESHOLD) {
        out.push({
          file,
          name: fn.name,
          line: fn.line,
          endLine: fn.endLine,
          cyclomaticComplexity: fn.cyclomaticComplexity,
          baseCc: null,
          reason: 'added',
        });
      }
    }
  }

  for (const f of prDiff.filesModified) {
    const head = headGraph.files.get(f.relativePath);
    const base = baseGraph.files.get(f.relativePath);
    if (!head || !base) continue;
    // Group BOTH sides by name; we need to know the count on each side, not
    // just on base. Many functions can share a name within a file — the
    // dominant case is anonymous arrow callbacks all named '<anonymous>' by
    // ast.ts. A flat Map<name,cc> would collapse them and compare every head
    // <anonymous> to the LAST base <anonymous>, producing false-positive
    // crossed-threshold / jumped rows for every file with ≥2 anonymous arrows
    // of differing CC. Even a 1-base / N-head asymmetry is unsafe: a head
    // arrow that's actually NEWLY ADDED would be paired with the single base
    // arrow's CC and reported as 'crossed-threshold' instead of 'added'.
    const baseByName = new Map<string, number[]>();
    for (const fn of base.functions ?? []) {
      let list = baseByName.get(fn.name);
      if (!list) {
        list = [];
        baseByName.set(fn.name, list);
      }
      list.push(fn.cyclomaticComplexity);
    }
    const headCountByName = new Map<string, number>();
    for (const fn of head.functions ?? []) {
      headCountByName.set(fn.name, (headCountByName.get(fn.name) ?? 0) + 1);
    }
    for (const fn of head.functions ?? []) {
      const candidates = baseByName.get(fn.name);
      if (!candidates || candidates.length === 0) {
        // Truly added (no base function with this name). Flag if high CC.
        if (fn.cyclomaticComplexity >= HIGH_CC_THRESHOLD) {
          out.push({
            file: f.relativePath,
            name: fn.name,
            line: fn.line,
            endLine: fn.endLine,
            cyclomaticComplexity: fn.cyclomaticComplexity,
            baseCc: null,
            reason: 'added',
          });
        }
        continue;
      }
      // Pair head-vs-base only when the name is unambiguous on BOTH sides
      // (1 ↔ 1). Any other ratio (1↔N, N↔1, N↔M) means we can't reliably
      // tell which head fn corresponds to which base fn — typically
      // <anonymous> arrow callbacks with no stable identity. We skip the
      // crossed-threshold / jumped checks in those cases. Regressions that
      // legitimately make one of these high-CC can still surface via other
      // signals (the file's overall risk score and `projscan_hotspots
      // view: functions`).
      if (candidates.length > 1 || (headCountByName.get(fn.name) ?? 0) > 1) {
        continue;
      }
      const baseCc = candidates[0];
      // Existed: flag if it newly crossed the threshold.
      if (
        baseCc < HIGH_CC_THRESHOLD &&
        fn.cyclomaticComplexity >= HIGH_CC_THRESHOLD
      ) {
        out.push({
          file: f.relativePath,
          name: fn.name,
          line: fn.line,
          endLine: fn.endLine,
          cyclomaticComplexity: fn.cyclomaticComplexity,
          baseCc,
          reason: 'crossed-threshold',
        });
        continue;
      }
      // Or: jumped by JUMP threshold even if both sides under HIGH_CC_THRESHOLD.
      if (fn.cyclomaticComplexity - baseCc >= CC_JUMP_THRESHOLD) {
        out.push({
          file: f.relativePath,
          name: fn.name,
          line: fn.line,
          endLine: fn.endLine,
          cyclomaticComplexity: fn.cyclomaticComplexity,
          baseCc,
          reason: 'jumped',
        });
      }
    }
  }

  out.sort((a, b) => b.cyclomaticComplexity - a.cyclomaticComplexity);
  return out;
}

// ── manifest diffing ──────────────────────────────────────

interface ManifestSnapshot {
  workspace: string;
  manifestFile: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
  entrypoints: Record<string, string>;
}

async function readManifests(rootPath: string): Promise<Map<string, ManifestSnapshot>> {
  // Use detectWorkspaces to enumerate; if no workspaces just read the root.
  const { detectWorkspaces } = await import('./monorepo.js');
  const ws = await detectWorkspaces(rootPath);
  const out = new Map<string, ManifestSnapshot>();
  const all = ws.kind === 'none' ? [] : ws.packages;
  if (all.length === 0) {
    const root = await readOneManifest(rootPath, 'package.json', '');
    if (root) out.set('package.json', root);
    return out;
  }
  for (const p of all) {
    const manifestRel = p.relativePath ? `${p.relativePath}/package.json` : 'package.json';
    const dir = path.join(rootPath, p.relativePath);
    const m = await readOneManifest(dir, manifestRel, p.name);
    if (m) out.set(manifestRel, m);
  }
  return out;
}

async function readOneManifest(
  dir: string,
  manifestFile: string,
  workspaceName: string,
): Promise<ManifestSnapshot | null> {
  const p = path.join(dir, 'package.json');
  let raw: string;
  try {
    raw = await fs.readFile(p, 'utf-8');
  } catch {
    return null;
  }
  let parsed: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    main?: unknown;
    module?: unknown;
    types?: unknown;
    exports?: unknown;
    bin?: unknown;
  };
  try {
    parsed = JSON.parse(raw) as typeof parsed;
  } catch {
    return null;
  }
  return {
    workspace: workspaceName,
    manifestFile,
    dependencies: parsed.dependencies ?? {},
    devDependencies: parsed.devDependencies ?? {},
    entrypoints: readEntrypoints(parsed),
  };
}

function readEntrypoints(parsed: {
  main?: unknown;
  module?: unknown;
  types?: unknown;
  exports?: unknown;
  bin?: unknown;
}): Record<string, string> {
  const out: Record<string, string> = {};
  for (const field of ['main', 'module', 'types', 'exports', 'bin'] as const) {
    const value = parsed[field];
    if (value === undefined) continue;
    out[field] = entrypointValue(value);
  }
  return out;
}

function entrypointValue(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function diffManifests(
  base: Map<string, ManifestSnapshot>,
  head: Map<string, ManifestSnapshot>,
): ReviewDependencyChange[] {
  const out: ReviewDependencyChange[] = [];
  const allManifests = new Set<string>([...base.keys(), ...head.keys()]);
  for (const manifestFile of allManifests) {
    const b = base.get(manifestFile);
    const h = head.get(manifestFile);
    if (!b && !h) continue;
    const change = diffOneManifest(b, h, manifestFile);
    if (change.added.length || change.removed.length || change.bumped.length) {
      out.push(change);
    }
  }
  out.sort((a, b) => a.manifestFile.localeCompare(b.manifestFile));
  return out;
}

function buildContractChanges(
  prDiff: PrDiffReport,
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
  baseManifests: Map<string, ManifestSnapshot>,
  headManifests: Map<string, ManifestSnapshot>,
): ReviewContractChange[] {
  const changes: ReviewContractChange[] = [];
  for (const file of prDiff.filesAdded) {
    const entry = headGraph.files.get(file);
    for (const exp of entry?.exports ?? []) {
      changes.push(exportContractChange('export-added', file, exp.name));
    }
  }
  for (const file of prDiff.filesRemoved) {
    const entry = baseGraph.files.get(file);
    for (const exp of entry?.exports ?? []) {
      changes.push(exportContractChange('export-removed', file, exp.name));
    }
  }
  for (const file of prDiff.filesModified) {
    for (const symbol of file.exportsAdded) {
      changes.push(exportContractChange('export-added', file.relativePath, symbol));
    }
    for (const symbol of file.exportsRemoved) {
      changes.push(exportContractChange('export-removed', file.relativePath, symbol));
    }
    for (const rename of file.exportsRenamed) {
      changes.push({
        kind: 'export-renamed',
        file: file.relativePath,
        symbol: rename.to,
        before: rename.from,
        after: rename.to,
        confidence: 'high',
        why: `Export "${rename.from}" was renamed to "${rename.to}" in ${file.relativePath}; downstream imports of the old name can fail at compile time or runtime.`,
      });
    }
  }

  changes.push(...entrypointContractChanges(baseManifests, headManifests));
  return changes;
}

function exportContractChange(
  kind: 'export-added' | 'export-removed',
  file: string,
  symbol: string,
): ReviewContractChange {
  return {
    kind,
    file,
    symbol,
    confidence: 'high',
    why:
      kind === 'export-added'
        ? `Export "${symbol}" was added in ${file}; downstream code may start depending on a new public API.`
        : `Export "${symbol}" was removed from ${file}; downstream imports can fail at compile time or runtime.`,
  };
}

function entrypointContractChanges(
  base: Map<string, ManifestSnapshot>,
  head: Map<string, ManifestSnapshot>,
): ReviewContractChange[] {
  const out: ReviewContractChange[] = [];
  const allManifests = new Set<string>([...base.keys(), ...head.keys()]);
  for (const manifestFile of allManifests) {
    const baseEntrypoints = base.get(manifestFile)?.entrypoints ?? {};
    const headEntrypoints = head.get(manifestFile)?.entrypoints ?? {};
    const fields = new Set<string>([...Object.keys(baseEntrypoints), ...Object.keys(headEntrypoints)]);
    for (const field of fields) {
      const before = baseEntrypoints[field];
      const after = headEntrypoints[field];
      if (before === after) continue;
      const kind = field === 'exports' ? 'public-export-changed' : 'entrypoint-changed';
      out.push({
        kind,
        file: manifestFile,
        symbol: field,
        ...(before !== undefined ? { before } : {}),
        ...(after !== undefined ? { after } : {}),
        confidence: 'high',
        why:
          kind === 'public-export-changed'
            ? `${manifestFile} package "exports" changed; consumers may resolve different public modules.`
            : `${manifestFile} package "${field}" changed from ${before ?? '<unset>'} to ${after ?? '<unset>'}; package consumers may load a different entrypoint.`,
      });
    }
  }
  return out.sort((a, b) => `${a.file}:${a.symbol ?? ''}`.localeCompare(`${b.file}:${b.symbol ?? ''}`));
}

function diffOneManifest(
  base: ManifestSnapshot | undefined,
  head: ManifestSnapshot | undefined,
  manifestFile: string,
): ReviewDependencyChange {
  const workspace = head?.workspace ?? base?.workspace ?? '';
  const baseDeps = base?.dependencies ?? {};
  const baseDev = base?.devDependencies ?? {};
  const headDeps = head?.dependencies ?? {};
  const headDev = head?.devDependencies ?? {};

  const added: ReviewDependencyChange['added'] = [];
  const removed: ReviewDependencyChange['removed'] = [];
  const bumped: ReviewDependencyChange['bumped'] = [];

  for (const [name, version] of Object.entries(headDeps)) {
    if (!(name in baseDeps)) added.push({ name, version, kind: 'dep' });
    else if (baseDeps[name] !== version) bumped.push({ name, from: baseDeps[name], to: version, kind: 'dep' });
  }
  for (const [name, version] of Object.entries(baseDeps)) {
    if (!(name in headDeps)) removed.push({ name, version, kind: 'dep' });
  }
  for (const [name, version] of Object.entries(headDev)) {
    if (!(name in baseDev)) added.push({ name, version, kind: 'dev' });
    else if (baseDev[name] !== version) bumped.push({ name, from: baseDev[name], to: version, kind: 'dev' });
  }
  for (const [name, version] of Object.entries(baseDev)) {
    if (!(name in headDev)) removed.push({ name, version, kind: 'dev' });
  }

  added.sort((a, b) => a.name.localeCompare(b.name));
  removed.sort((a, b) => a.name.localeCompare(b.name));
  bumped.sort((a, b) => a.name.localeCompare(b.name));

  return { workspace, manifestFile, added, removed, bumped };
}

// ── verdict ───────────────────────────────────────────────

function decideVerdict(
  changedFiles: ReviewFile[],
  newCycles: ReviewCycle[],
  riskyFunctions: ReviewFunction[],
  depChanges: ReviewDependencyChange[],
  newTaintFlows: ReviewTaintFlow[],
  newDataflowRisks: ReviewDataflowRisk[],
): { verdict: ReviewReport['verdict']; summary: string[] } {
  const summary: string[] = [];
  let verdict: ReviewReport['verdict'] = 'ok';

  const maxRisk = Math.max(0, ...changedFiles.map((f) => f.riskScore ?? 0));
  if (maxRisk >= RISK_VERDICT_BLOCK_SCORE) {
    verdict = 'block';
    summary.push(`Maximum changed-file risk score is ${maxRisk.toFixed(1)} (>= ${RISK_VERDICT_BLOCK_SCORE}).`);
  } else if (maxRisk >= RISK_VERDICT_REVIEW_SCORE) {
    verdict = bumpTo(verdict, 'review');
    summary.push(`Maximum changed-file risk score is ${maxRisk.toFixed(1)} (>= ${RISK_VERDICT_REVIEW_SCORE}).`);
  }

  if (newCycles.length > 0) {
    const newOnly = newCycles.filter((c) => c.classification === 'new');
    if (newOnly.length > 0) {
      verdict = 'block';
      summary.push(`${newOnly.length} new import cycle(s) introduced.`);
    } else {
      verdict = bumpTo(verdict, 'review');
      summary.push(`${newCycles.length} cycle(s) expanded.`);
    }
  }

  if (riskyFunctions.length > 0) {
    verdict = bumpTo(verdict, 'review');
    summary.push(`${riskyFunctions.length} function(s) flagged: high CC added or jumped.`);
  }

  if (newTaintFlows.length > 0) {
    verdict = 'block';
    const sample = newTaintFlows
      .slice(0, 3)
      .map((f) => `${f.source}→${f.sink} (${f.sourceFn}${f.pathLength > 1 ? '…' : ''})`)
      .join(', ');
    summary.push(
      `${newTaintFlows.length} new taint flow(s) detected: ${sample}${newTaintFlows.length > 3 ? ', …' : ''}.`,
    );
  }

  if (newDataflowRisks.length > 0) {
    verdict = 'block';
    const sample = newDataflowRisks
      .slice(0, 3)
      .map((risk) => `${risk.source}→${risk.sink} (${risk.bridgeFn ?? risk.sourceFn})`)
      .join(', ');
    summary.push(
      `${newDataflowRisks.length} new dataflow risk(s) detected: ${sample}${newDataflowRisks.length > 3 ? ', …' : ''}.`,
    );
  }

  if (depChanges.length > 0) {
    const totals = depChanges.reduce(
      (acc, d) => {
        acc.added += d.added.length;
        acc.removed += d.removed.length;
        acc.bumped += d.bumped.length;
        return acc;
      },
      { added: 0, removed: 0, bumped: 0 },
    );
    if (totals.added + totals.removed + totals.bumped > 0) {
      summary.push(
        `Dependency changes: +${totals.added} -${totals.removed} ~${totals.bumped}.`,
      );
    }
  }

  if (changedFiles.length === 0 && summary.length === 0) {
    summary.push('No structural changes detected between base and head.');
  } else if (verdict === 'ok' && summary.length === 0) {
    summary.push(`${changedFiles.length} file(s) changed; no risk signals.`);
  }

  return { verdict, summary };
}

function bumpTo(current: ReviewReport['verdict'], target: ReviewReport['verdict']): ReviewReport['verdict'] {
  const order: Record<ReviewReport['verdict'], number> = { ok: 0, review: 1, block: 2 };
  return order[target] > order[current] ? target : current;
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

async function resolveSha(rootPath: string, ref: string): Promise<string | null> {
  const { code, stdout } = await runGit(rootPath, ['rev-parse', '--verify', `${ref}^{commit}`]).catch(
    () => ({ code: 1, stdout: '', stderr: '' }),
  );
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

/**
 * 1.5+ — pick a review tier based on the caller's token budget.
 *
 *   <3000  → 'verdict-only'  (verdict + summary + totals)
 *   <7000  → 'summary'       (verdict + summary + top files / top cycles / etc.)
 *   else   → 'full'          (everything)
 *
 * `0`, `undefined`, and any non-positive value all mean "no budget given"
 * — the caller wants the full report. The tier names are stable (clients
 * can read them off the response and key behavior off them).
 */
export function selectReviewTier(maxCostTokens: number | undefined): ReviewTier {
  if (typeof maxCostTokens !== 'number' || !Number.isFinite(maxCostTokens) || maxCostTokens <= 0) {
    return 'full';
  }
  if (maxCostTokens < 3000) return 'verdict-only';
  if (maxCostTokens < 7000) return 'summary';
  return 'full';
}

/**
 * Reshape a full ReviewReport for the chosen tier. The caller passes a
 * fully-populated report from `computeReview`; we return a plain object
 * sized for the tier. Returning `Record<string, unknown>` (rather than
 * narrowing the ReviewReport type) keeps the type contract simple for
 * the dispatcher and avoids an over-engineered union.
 *
 * `unavailable` reports (no diff, missing base, etc.) pass through as-is
 * — there's nothing to shape; the verdict + reason already convey
 * everything the agent needs.
 */
export function shapeReviewForTier(
  report: ReviewReport,
  tier: ReviewTier,
): Record<string, unknown> {
  if (!report.available || tier === 'full') {
    return { ...report, tier };
  }

  const filesChanged = report.changedFiles.length;
  const cyclesAdded = report.newCycles.length;
  const riskyFunctionsAdded = report.riskyFunctions.length;
  const depsChanged = report.dependencyChanges.length;
  const taintFlowsAdded = report.newTaintFlows?.length ?? 0;
  const dataflowRisksAdded = report.newDataflowRisks?.length ?? 0;
  const contractChanges = report.contractChanges?.length ?? 0;
  const totals = {
    filesChanged,
    cyclesAdded,
    riskyFunctionsAdded,
    depsChanged,
    taintFlowsAdded,
    dataflowRisksAdded,
    contractChanges,
  };

  if (tier === 'verdict-only') {
    return {
      available: report.available,
      base: report.base,
      head: report.head,
      verdict: report.verdict,
      summary: report.summary,
      totals,
      tier,
    };
  }

  // summary tier: keep the verdict, the top-N of each list, and aggregate totals.
  // Drop per-file expansion lists in prDiff that bloat the response.
  const TOP = 5;
  const trimmedPrDiff = {
    available: report.prDiff.available,
    base: report.prDiff.base,
    head: report.prDiff.head,
    totalFilesChanged: report.prDiff.totalFilesChanged,
    filesAdded: report.prDiff.filesAdded.slice(0, TOP),
    filesRemoved: report.prDiff.filesRemoved.slice(0, TOP),
    filesModified: report.prDiff.filesModified.slice(0, TOP).map((f) => ({
      relativePath: f.relativePath,
      // Keep the deltas; drop the heavy added/removed export & import arrays.
      cyclomaticDelta: f.cyclomaticDelta,
      fanInDelta: f.fanInDelta,
    })),
  };

  return {
    available: report.available,
    base: report.base,
    head: report.head,
    prDiff: trimmedPrDiff,
    changedFiles: report.changedFiles.slice(0, TOP),
    newCycles: report.newCycles.slice(0, 3),
    riskyFunctions: report.riskyFunctions.slice(0, 3),
    dependencyChanges: report.dependencyChanges.slice(0, 3),
    contractChanges: report.contractChanges?.slice(0, TOP) ?? [],
    newTaintFlows: report.newTaintFlows?.slice(0, 5) ?? [],
    newDataflowRisks: report.newDataflowRisks?.slice(0, 5) ?? [],
    verdict: report.verdict,
    summary: report.summary,
    totals,
    tier,
  };
}
