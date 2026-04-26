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
import type {
  ReviewCycle,
  ReviewDependencyChange,
  ReviewFile,
  ReviewFunction,
  ReviewReport,
} from '../types.js';

export interface ReviewOptions {
  /** Base ref. Default: origin/main → main → origin/master → master → HEAD~1. */
  base?: string;
  /** Head ref. Default: HEAD. */
  head?: string;
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
    await runGit(rootPath, ['worktree', 'add', '--detach', worktreeDir, baseSha]);
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

  // Verdict.
  const { verdict, summary } = decideVerdict(changedFiles, newCycles, riskyFunctions, dependencyChanges);

  return {
    available: true,
    base: { ref: baseRef, resolvedSha: baseSha },
    head: { ref: headRef, resolvedSha: headSha },
    prDiff,
    changedFiles,
    newCycles,
    riskyFunctions,
    dependencyChanges,
    verdict,
    summary,
  };
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
    const baseByName = new Map<string, number>();
    for (const fn of base.functions ?? []) baseByName.set(fn.name, fn.cyclomaticComplexity);
    for (const fn of head.functions ?? []) {
      const baseCc = baseByName.get(fn.name);
      if (baseCc === undefined) {
        // Newly added function. Flag if high CC.
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
  let parsed: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
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
  };
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

function runGit(cwd: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', reject);
    child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
  });
}
