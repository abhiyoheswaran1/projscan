import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { scanRepository } from './repositoryScanner.js';
import { buildCodeGraph, type CodeGraph } from './codeGraph.js';
import type { FileAstDiff, PrDiffReport } from '../types.js';

export interface PrDiffOptions {
  /** Base ref (branch, tag, sha). Default: origin/main, falling back to main. */
  base?: string;
  /** Head ref. Default: HEAD. */
  head?: string;
}

/**
 * Compute a structural diff between two refs by building a CodeGraph for each
 * side and comparing exports / imports / call sites / cyclomatic complexity /
 * fan-in.
 *
 * Strategy: stand up a throwaway git worktree at the base ref, scan it like
 * any other project, build its graph, then diff against the head graph
 * (caller passes head graph in or the function builds one from `rootPath`).
 *
 * This is "structural diff", not text diff: agents reviewing PRs care about
 * "what's the new export surface" and "which call sites disappeared", not
 * "what whitespace changed on line 42."
 */
export async function computePrDiff(
  rootPath: string,
  options: PrDiffOptions = {},
): Promise<PrDiffReport> {
  const isRepo = await isGitRepository(rootPath);
  if (!isRepo) {
    return {
      available: false,
      reason: 'Not a git repository - PR diff requires git history.',
      base: { ref: '', resolvedSha: null },
      head: { ref: '', resolvedSha: null },
      filesAdded: [],
      filesRemoved: [],
      filesModified: [],
      totalFilesChanged: 0,
    };
  }

  const headRef = options.head ?? 'HEAD';
  const baseRef = options.base ?? (await pickDefaultBase(rootPath));

  const headSha = await resolveSha(rootPath, headRef);
  const baseSha = await resolveSha(rootPath, baseRef);
  if (!baseSha) {
    return {
      available: false,
      reason: `Could not resolve base ref "${baseRef}".`,
      base: { ref: baseRef, resolvedSha: null },
      head: { ref: headRef, resolvedSha: headSha },
      filesAdded: [],
      filesRemoved: [],
      filesModified: [],
      totalFilesChanged: 0,
    };
  }

  // Build the head graph from rootPath as-is (the working tree).
  const headScan = await scanRepository(rootPath);
  const headGraph = await buildCodeGraph(rootPath, headScan.files);

  // Stand up a worktree at the base ref and scan it.
  const worktreeDir = await mkTempWorktreeDir();
  let baseGraph: CodeGraph;
  try {
    await runGit(rootPath, ['worktree', 'add', '--detach', worktreeDir, baseSha]);
    const baseScan = await scanRepository(worktreeDir);
    baseGraph = await buildCodeGraph(worktreeDir, baseScan.files);
  } finally {
    // Best-effort tear-down. `git worktree remove --force` handles the case
    // where the worktree dir is somehow non-empty.
    await runGit(rootPath, ['worktree', 'remove', '--force', worktreeDir]).catch(() => {});
    await fs.rm(worktreeDir, { recursive: true, force: true }).catch(() => {});
  }

  return diffGraphs(baseRef, baseSha, headRef, headSha, baseGraph, headGraph);
}

/** Pure function — exported for unit testing without a real git repo. */
export function diffGraphs(
  baseRef: string,
  baseSha: string | null,
  headRef: string,
  headSha: string | null,
  baseGraph: CodeGraph,
  headGraph: CodeGraph,
): PrDiffReport {
  const filesAdded: string[] = [];
  const filesRemoved: string[] = [];
  const filesModified: FileAstDiff[] = [];

  const allFiles = new Set<string>([...baseGraph.files.keys(), ...headGraph.files.keys()]);
  for (const file of allFiles) {
    const baseEntry = baseGraph.files.get(file);
    const headEntry = headGraph.files.get(file);

    if (!baseEntry && headEntry) {
      filesAdded.push(file);
      continue;
    }
    if (baseEntry && !headEntry) {
      filesRemoved.push(file);
      continue;
    }
    if (!baseEntry || !headEntry) continue; // unreachable, satisfies TS

    // Modified files: structural compare.
    const exportsBase = new Set(baseEntry.exports.map((e) => e.name));
    const exportsHead = new Set(headEntry.exports.map((e) => e.name));
    const importsBase = new Set(baseEntry.imports.map((i) => i.source));
    const importsHead = new Set(headEntry.imports.map((i) => i.source));
    const callsBase = new Set(baseEntry.callSites);
    const callsHead = new Set(headEntry.callSites);

    const rawExportsAdded = [...exportsHead].filter((x) => !exportsBase.has(x));
    const rawExportsRemoved = [...exportsBase].filter((x) => !exportsHead.has(x));
    // Pull out renames first; whatever's left stays as +/-.
    const { renames, addedAfter, removedAfter } = detectRenames(
      rawExportsRemoved,
      rawExportsAdded,
    );
    const exportsAdded = addedAfter;
    const exportsRemoved = removedAfter;
    const exportsRenamed = renames;
    const importsAdded = [...importsHead].filter((x) => !importsBase.has(x));
    const importsRemoved = [...importsBase].filter((x) => !importsHead.has(x));
    const callsAdded = [...callsHead].filter((x) => !callsBase.has(x));
    const callsRemoved = [...callsBase].filter((x) => !callsHead.has(x));

    const ccDelta =
      baseEntry.parseOk && headEntry.parseOk
        ? headEntry.cyclomaticComplexity - baseEntry.cyclomaticComplexity
        : null;
    const fanInBase = baseGraph.localImporters.get(file)?.size ?? 0;
    const fanInHead = headGraph.localImporters.get(file)?.size ?? 0;
    const fanInDelta = fanInHead - fanInBase;

    const hasChange =
      exportsAdded.length +
        exportsRemoved.length +
        exportsRenamed.length +
        importsAdded.length +
        importsRemoved.length +
        callsAdded.length +
        callsRemoved.length >
        0 ||
      (ccDelta !== null && ccDelta !== 0) ||
      fanInDelta !== 0;

    if (!hasChange) continue;

    filesModified.push({
      relativePath: file,
      status: 'modified',
      exportsAdded: exportsAdded.sort(),
      exportsRemoved: exportsRemoved.sort(),
      exportsRenamed,
      importsAdded: importsAdded.sort(),
      importsRemoved: importsRemoved.sort(),
      callsAdded: callsAdded.sort(),
      callsRemoved: callsRemoved.sort(),
      cyclomaticDelta: ccDelta,
      fanInDelta,
    });
  }

  filesAdded.sort();
  filesRemoved.sort();
  filesModified.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

  return {
    available: true,
    base: { ref: baseRef, resolvedSha: baseSha },
    head: { ref: headRef, resolvedSha: headSha },
    filesAdded,
    filesRemoved,
    filesModified,
    totalFilesChanged: filesAdded.length + filesRemoved.length + filesModified.length,
  };
}

// ── rename detection ──────────────────────────────────────

/**
 * Pair removed/added export names that look like renames. A pair counts as a
 * rename when it's the best-scoring match on both sides AND the similarity
 * exceeds a threshold. Each name participates in at most one pair (greedy by
 * descending score). Whatever isn't paired stays in the +/- lists.
 *
 * Similarity blends two signals (each in [0,1]): normalized Levenshtein
 * distance and longest-common-affix fraction. Threshold of 0.6 chosen to
 * pair "fooBar" → "fooBaz" and "Widget" → "WidgetThing" without pairing
 * unrelated names like "save" → "load".
 */
import type { ExportRename } from '../types.js';

interface RenameSplit {
  renames: ExportRename[];
  removedAfter: string[];
  addedAfter: string[];
}

export function detectRenames(removed: string[], added: string[]): RenameSplit {
  if (removed.length === 0 || added.length === 0) {
    return { renames: [], removedAfter: removed.sort(), addedAfter: added.sort() };
  }

  type Candidate = { from: string; to: string; score: number };
  const candidates: Candidate[] = [];
  for (const from of removed) {
    for (const to of added) {
      const score = similarity(from, to);
      if (score >= 0.5) candidates.push({ from, to, score });
    }
  }
  // Greedy: pick highest scores first; each name can only be paired once.
  candidates.sort((a, b) => b.score - a.score);
  const usedFrom = new Set<string>();
  const usedTo = new Set<string>();
  const renames: ExportRename[] = [];
  for (const c of candidates) {
    if (usedFrom.has(c.from) || usedTo.has(c.to)) continue;
    usedFrom.add(c.from);
    usedTo.add(c.to);
    renames.push({ from: c.from, to: c.to });
  }
  renames.sort((a, b) => a.from.localeCompare(b.from));

  return {
    renames,
    removedAfter: removed.filter((n) => !usedFrom.has(n)).sort(),
    addedAfter: added.filter((n) => !usedTo.has(n)).sort(),
  };
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  const dist = levenshtein(a, b);
  const editScore = 1 - dist / maxLen;
  const prefix = sharedPrefix(a, b);
  const suffix = sharedSuffix(a, b);
  const affixScore = Math.max(prefix, suffix) / maxLen;
  // Take the stronger signal. Either evidence alone is enough to suspect a
  // rename: a name that's mostly the same characters (high edit score) OR a
  // name that shares a long prefix/suffix (e.g. `fetch` -> `fetchUser`).
  return Math.max(editScore, affixScore);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  // Two-row DP — small allocations keep this cheap on the realistic name sizes.
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

function sharedPrefix(a: string, b: string): number {
  const cap = Math.min(a.length, b.length);
  let i = 0;
  while (i < cap && a.charCodeAt(i) === b.charCodeAt(i)) i++;
  return i;
}

function sharedSuffix(a: string, b: string): number {
  const cap = Math.min(a.length, b.length);
  let i = 0;
  while (i < cap && a.charCodeAt(a.length - 1 - i) === b.charCodeAt(b.length - 1 - i)) i++;
  return i;
}

// ── git helpers ───────────────────────────────────────────

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

/** origin/main if it exists, else main, else master. Mirrors what most tooling does. */
async function pickDefaultBase(rootPath: string): Promise<string> {
  for (const candidate of ['origin/main', 'main', 'origin/master', 'master']) {
    if (await resolveSha(rootPath, candidate)) return candidate;
  }
  return 'HEAD~1';
}

async function mkTempWorktreeDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-pr-diff-'));
}

interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

function runGit(
  cwd: string,
  args: string[],
  opts: { timeoutMs?: number } = {},
): Promise<GitResult> {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, { cwd, env: process.env });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const timeout = opts.timeoutMs
      ? setTimeout(() => {
          if (settled) return;
          settled = true;
          child.kill('SIGKILL');
          reject(new Error('git command timed out'));
        }, opts.timeoutMs)
      : null;
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('error', (err) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      reject(err);
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      resolve({ code: code ?? 1, stdout, stderr });
    });
  });
}
