import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AuthorShare, FileEntry, Issue, FileHotspot, HotspotReport } from '../types.js';
import type { CodeGraph } from './codeGraph.js';

const CODE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.go', '.java', '.rs', '.php',
  '.c', '.cc', '.cpp', '.h', '.hpp',
  '.cs', '.swift', '.kt', '.kts', '.scala',
  '.vue', '.svelte',
]);

const MAX_LINE_READS = 400;
const MAX_LINE_READ_BYTES = 512 * 1024;
const DEFAULT_SINCE = '12 months ago';

export interface HotspotOptions {
  since?: string;
  limit?: number;
  coverage?: Map<string, number>;
  /**
   * Code graph for AST-derived complexity. When present, the risk score uses
   * cyclomatic complexity instead of the LOC proxy. Files outside the graph
   * (no language adapter) still fall back to LOC.
   */
  graph?: CodeGraph;
}

export async function analyzeHotspots(
  rootPath: string,
  files: FileEntry[],
  issues: Issue[],
  options: HotspotOptions = {},
): Promise<HotspotReport> {
  const limit = Math.max(1, Math.min(100, options.limit ?? 10));
  const since = options.since ?? DEFAULT_SINCE;

  const isRepo = await isGitRepository(rootPath);
  if (!isRepo) {
    return {
      available: false,
      reason: 'Not a git repository - hotspot analysis requires git history',
      window: { since: null, commitsScanned: 0 },
      hotspots: [],
      totalFilesRanked: 0,
    };
  }

  const churnMap = await collectGitChurn(rootPath, since);

  const candidates = files.filter(
    (f) => CODE_EXTENSIONS.has(f.extension) && f.sizeBytes <= MAX_LINE_READ_BYTES,
  );

  const candidatesByScore = [...candidates].sort((a, b) => {
    const ca = churnMap.get(a.relativePath)?.churn ?? 0;
    const cb = churnMap.get(b.relativePath)?.churn ?? 0;
    if (cb !== ca) return cb - ca;
    return b.sizeBytes - a.sizeBytes;
  });

  const readTargets = candidatesByScore.slice(0, MAX_LINE_READS);
  const lineCounts = new Map<string, number>();
  await Promise.all(
    readTargets.map(async (f) => {
      const lines = await countLines(f.absolutePath);
      if (lines !== null) lineCounts.set(f.relativePath, lines);
    }),
  );

  const issueIndex = indexIssuesByFile(issues, files);

  const now = Date.now();
  const hotspots: FileHotspot[] = candidates.map((file) => {
    const churnEntry = churnMap.get(file.relativePath);
    const churn = churnEntry?.churn ?? 0;
    const authors = churnEntry?.authors.size ?? 0;
    const lastTs = churnEntry?.lastTimestampMs ?? null;
    const daysSinceLastChange =
      lastTs === null ? null : Math.max(0, Math.floor((now - lastTs) / (1000 * 60 * 60 * 24)));

    const lines = lineCounts.get(file.relativePath) ?? estimateLines(file.sizeBytes);
    const issueIds = issueIndex.get(file.relativePath) ?? [];

    const topAuthors = rankAuthors(churnEntry?.authorCommits);
    const primaryAuthor = topAuthors[0]?.author ?? null;
    const primaryAuthorShare = topAuthors[0]?.share ?? 0;
    const busFactorOne = churn >= 3 && primaryAuthorShare >= 0.8;

    const coverage = options.coverage?.get(file.relativePath);
    const coverageValue = typeof coverage === 'number' ? coverage : null;

    // Prefer AST cyclomatic complexity when the graph parsed this file.
    // Files in the graph but with parseOk:false fall back to LOC too — a
    // failed parse means we can't trust the (zero) CC value.
    const graphEntry = options.graph?.files.get(file.relativePath);
    const cc = graphEntry?.parseOk ? graphEntry.cyclomaticComplexity : null;

    const riskScore = computeRiskScore({
      churn,
      lines,
      complexity: cc,
      authors,
      daysSinceLastChange,
      issueCount: issueIds.length,
      busFactorOne,
      coverage: coverageValue,
    });

    const reasons = buildReasons({
      churn,
      lines,
      complexity: cc,
      authors,
      daysSinceLastChange,
      issueCount: issueIds.length,
      busFactorOne,
      primaryAuthor,
      coverage: coverageValue,
    });

    return {
      relativePath: file.relativePath,
      churn,
      distinctAuthors: authors,
      daysSinceLastChange,
      lineCount: lines,
      cyclomaticComplexity: cc,
      sizeBytes: file.sizeBytes,
      issueCount: issueIds.length,
      issueIds,
      riskScore,
      reasons,
      primaryAuthor,
      primaryAuthorShare,
      busFactorOne,
      topAuthors,
      coverage: coverageValue,
    };
  });

  hotspots.sort((a, b) => b.riskScore - a.riskScore);

  const ranked = hotspots.filter((h) => h.riskScore > 0);

  return {
    available: true,
    window: {
      since,
      commitsScanned: countCommits(churnMap),
    },
    hotspots: ranked.slice(0, limit),
    totalFilesRanked: ranked.length,
  };
}

// ── Git Integration ───────────────────────────────────────

interface ChurnEntry {
  churn: number;
  authors: Set<string>;
  authorCommits: Map<string, number>;
  lastTimestampMs: number | null;
  commitHashes: Set<string>;
}

async function isGitRepository(rootPath: string): Promise<boolean> {
  try {
    const { code } = await runGit(rootPath, ['rev-parse', '--is-inside-work-tree']);
    return code === 0;
  } catch {
    return false;
  }
}

async function collectGitChurn(rootPath: string, since: string): Promise<Map<string, ChurnEntry>> {
  const map = new Map<string, ChurnEntry>();

  const args = [
    'log',
    `--since=${since}`,
    '--no-merges',
    '--name-only',
    '--pretty=format:COMMIT|%H|%ae|%at',
  ];

  let stdout: string;
  try {
    const result = await runGit(rootPath, args, { timeoutMs: 15_000 });
    if (result.code !== 0) return map;
    stdout = result.stdout;
  } catch {
    return map;
  }

  let currentHash: string | null = null;
  let currentAuthor: string | null = null;
  let currentTsMs: number | null = null;

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line) continue;

    if (line.startsWith('COMMIT|')) {
      const parts = line.split('|');
      currentHash = parts[1] ?? null;
      currentAuthor = parts[2] ?? null;
      const tsSec = parseInt(parts[3] ?? '', 10);
      currentTsMs = Number.isFinite(tsSec) ? tsSec * 1000 : null;
      continue;
    }

    if (!currentHash) continue;
    const filePath = normalizeFilePath(line);
    if (!filePath) continue;

    let entry = map.get(filePath);
    if (!entry) {
      entry = {
        churn: 0,
        authors: new Set(),
        authorCommits: new Map(),
        lastTimestampMs: null,
        commitHashes: new Set(),
      };
      map.set(filePath, entry);
    }

    if (!entry.commitHashes.has(currentHash)) {
      entry.commitHashes.add(currentHash);
      entry.churn++;
      if (currentAuthor) {
        entry.authorCommits.set(currentAuthor, (entry.authorCommits.get(currentAuthor) ?? 0) + 1);
      }
    }
    if (currentAuthor) entry.authors.add(currentAuthor);
    if (currentTsMs !== null && (entry.lastTimestampMs === null || currentTsMs > entry.lastTimestampMs)) {
      entry.lastTimestampMs = currentTsMs;
    }
  }

  return map;
}

function normalizeFilePath(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return trimmed.split(path.sep).join('/').replace(/^\.\//, '');
}

function countCommits(churnMap: Map<string, ChurnEntry>): number {
  const hashes = new Set<string>();
  for (const entry of churnMap.values()) {
    for (const h of entry.commitHashes) hashes.add(h);
  }
  return hashes.size;
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

    child.stdout.on('data', (d) => {
      stdout += d.toString();
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
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

// ── Line Counting ─────────────────────────────────────────

async function countLines(absolutePath: string): Promise<number | null> {
  try {
    const content = await fs.readFile(absolutePath, 'utf-8');
    if (!content) return 0;
    let lines = 1;
    for (let i = 0; i < content.length; i++) {
      if (content.charCodeAt(i) === 10) lines++;
    }
    return lines;
  } catch {
    return null;
  }
}

function estimateLines(sizeBytes: number): number {
  return Math.max(1, Math.round(sizeBytes / 40));
}

// ── Issue → File Mapping ──────────────────────────────────

function indexIssuesByFile(issues: Issue[], files: FileEntry[]): Map<string, string[]> {
  const index = new Map<string, string[]>();
  const filePathSet = new Set(files.map((f) => f.relativePath));

  const add = (file: string, issueId: string) => {
    const list = index.get(file) ?? [];
    if (!list.includes(issueId)) list.push(issueId);
    index.set(file, list);
  };

  for (const issue of issues) {
    // Prefer explicit locations when the analyzer supplied them - this is
    // exact and avoids the substring-false-positive problem where "src/a.ts"
    // would match issues that only mention "src/ab.ts".
    if (issue.locations && issue.locations.length > 0) {
      for (const loc of issue.locations) {
        if (loc.file && filePathSet.has(loc.file)) add(loc.file, issue.id);
      }
      continue;
    }

    // Fall back to substring scan for legacy issues with no locations.
    // Use word-boundary-ish guards: require the match to start at the
    // beginning of title/description OR be preceded/followed by non-path chars.
    const haystack = `${issue.title}\n${issue.description}`;
    for (const filePath of filePathSet) {
      if (!filePath) continue;
      if (!haystack.includes(filePath)) continue;
      if (!hasPathBoundaries(haystack, filePath)) continue;
      add(filePath, issue.id);
    }
  }
  return index;
}

function hasPathBoundaries(haystack: string, filePath: string): boolean {
  let startIdx = 0;
  while (startIdx < haystack.length) {
    const idx = haystack.indexOf(filePath, startIdx);
    if (idx === -1) return false;
    const before = idx > 0 ? haystack.charCodeAt(idx - 1) : -1;
    const after = idx + filePath.length < haystack.length ? haystack.charCodeAt(idx + filePath.length) : -1;
    // Good boundary = start-of-string, whitespace, quote, paren, comma, colon, or end-of-string.
    if (isPathBoundary(before) && isPathBoundary(after)) return true;
    startIdx = idx + 1;
  }
  return false;
}

function isPathBoundary(code: number): boolean {
  if (code === -1) return true; // string boundary
  // Safe neighbors: whitespace, quotes, parens, brackets, braces, punctuation
  // commonly adjacent to paths (colon, comma, period, question/exclamation/>/<).
  return (
    code === 0x20 /* space */ ||
    code === 0x09 /* tab */ ||
    code === 0x0a /* \n */ ||
    code === 0x0d /* \r */ ||
    code === 0x22 /* " */ ||
    code === 0x27 /* ' */ ||
    code === 0x60 /* ` */ ||
    code === 0x28 /* ( */ ||
    code === 0x29 /* ) */ ||
    code === 0x5b /* [ */ ||
    code === 0x5d /* ] */ ||
    code === 0x7b /* { */ ||
    code === 0x7d /* } */ ||
    code === 0x3a /* : */ ||
    code === 0x2c /* , */ ||
    code === 0x3b /* ; */ ||
    code === 0x2e /* . (e.g., "src/a.ts." end of sentence) */ ||
    code === 0x3f /* ? */ ||
    code === 0x21 /* ! */ ||
    code === 0x3e /* > */ ||
    code === 0x3c /* < */
  );
}

// ── Risk Scoring ──────────────────────────────────────────

interface ScoreInputs {
  churn: number;
  lines: number;
  /**
   * AST cyclomatic complexity. When null (no adapter parsed this file or
   * parse failed), the score falls back to `lines` so non-AST languages
   * like Ruby/Go/Java still rank.
   */
  complexity?: number | null;
  authors: number;
  daysSinceLastChange: number | null;
  issueCount: number;
  busFactorOne?: boolean;
  coverage?: number | null;
}

export function computeRiskScore(i: ScoreInputs): number {
  // 0.11: complexity replaces LOC as the second-axis "scariness" signal.
  // CC is a tighter proxy for control-flow risk than raw line count, but a
  // 200-line file might score CC=15 instead of LOC=200, so absolute scores
  // shift down for adapter-parsed files. Rankings are what matter.
  const cx = typeof i.complexity === 'number' ? i.complexity : i.lines;
  const churnWeight = Math.log2(1 + i.churn) * 20;
  const complexityWeight = Math.log2(1 + cx) * 4;
  const hotChurnXComplexity = Math.log2(1 + i.churn) * Math.log2(1 + cx) * 3;
  const authorWeight = Math.log2(1 + i.authors) * 5;
  const issueWeight = i.issueCount * 12;
  const busFactorPenalty = i.busFactorOne ? 15 : 0;

  let recencyBoost = 0;
  if (i.daysSinceLastChange !== null) {
    if (i.daysSinceLastChange <= 7) recencyBoost = 10;
    else if (i.daysSinceLastChange <= 30) recencyBoost = 6;
    else if (i.daysSinceLastChange <= 90) recencyBoost = 3;
  }

  // Coverage penalty: low coverage on a hot/changing file = scarier.
  // Only apply when coverage data is known AND the file has some churn.
  let coveragePenalty = 0;
  if (typeof i.coverage === 'number' && i.churn > 0) {
    const uncoveredFraction = Math.max(0, (100 - i.coverage) / 100);
    coveragePenalty = uncoveredFraction * Math.log2(1 + i.churn) * 4;
  }

  const raw =
    churnWeight +
    complexityWeight +
    hotChurnXComplexity +
    authorWeight +
    issueWeight +
    recencyBoost +
    busFactorPenalty +
    coveragePenalty;

  if (i.churn === 0 && i.issueCount === 0) return 0;

  return Math.round(raw * 10) / 10;
}

interface ReasonInputs extends ScoreInputs {
  primaryAuthor?: string | null;
}

function buildReasons(i: ReasonInputs): string[] {
  const reasons: string[] = [];
  if (i.churn >= 20) reasons.push(`high churn (${i.churn} commits)`);
  else if (i.churn >= 8) reasons.push(`frequent changes (${i.churn} commits)`);
  else if (i.churn > 0) reasons.push(`${i.churn} commit${i.churn === 1 ? '' : 's'}`);

  // When CC is available, prefer it over raw line count — it's the more
  // honest signal. Fall back to "large file (lines)" for non-AST languages.
  if (typeof i.complexity === 'number') {
    if (i.complexity >= 30) reasons.push(`high complexity (CC ${i.complexity})`);
    else if (i.complexity >= 15) reasons.push(`moderate complexity (CC ${i.complexity})`);
  } else {
    if (i.lines >= 500) reasons.push(`large file (${i.lines} lines)`);
    else if (i.lines >= 250) reasons.push(`${i.lines} lines`);
  }

  if (i.authors >= 5) reasons.push(`${i.authors} contributors`);
  else if (i.authors >= 2) reasons.push(`${i.authors} contributors`);

  if (i.issueCount > 0) {
    reasons.push(`${i.issueCount} open issue${i.issueCount === 1 ? '' : 's'}`);
  }

  if (i.daysSinceLastChange !== null && i.daysSinceLastChange <= 7) {
    reasons.push('changed this week');
  }

  if (i.busFactorOne && i.primaryAuthor) {
    reasons.push(`bus factor 1 (${formatAuthor(i.primaryAuthor)})`);
  }

  if (typeof i.coverage === 'number' && i.churn > 0) {
    if (i.coverage < 40) reasons.push(`low coverage (${Math.round(i.coverage)}%)`);
    else if (i.coverage < 70) reasons.push(`moderate coverage (${Math.round(i.coverage)}%)`);
  }

  return reasons;
}

function rankAuthors(authorCommits: Map<string, number> | undefined): AuthorShare[] {
  if (!authorCommits || authorCommits.size === 0) return [];
  const total = [...authorCommits.values()].reduce((sum, n) => sum + n, 0);
  if (total === 0) return [];

  return [...authorCommits.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([author, commits]) => ({
      author,
      commits,
      share: Math.round((commits / total) * 1000) / 1000,
    }));
}

function formatAuthor(email: string): string {
  const atIdx = email.indexOf('@');
  return atIdx > 0 ? email.slice(0, atIdx) : email;
}
