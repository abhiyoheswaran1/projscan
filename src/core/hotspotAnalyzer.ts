import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { AuthorShare, FileEntry, Issue, FileHotspot, HotspotReport } from '../types.js';

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
      reason: 'Not a git repository — hotspot analysis requires git history',
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

    const riskScore = computeRiskScore({
      churn,
      lines,
      authors,
      daysSinceLastChange,
      issueCount: issueIds.length,
      busFactorOne,
    });

    const reasons = buildReasons({
      churn,
      lines,
      authors,
      daysSinceLastChange,
      issueCount: issueIds.length,
      busFactorOne,
      primaryAuthor,
    });

    return {
      relativePath: file.relativePath,
      churn,
      distinctAuthors: authors,
      daysSinceLastChange,
      lineCount: lines,
      sizeBytes: file.sizeBytes,
      issueCount: issueIds.length,
      issueIds,
      riskScore,
      reasons,
      primaryAuthor,
      primaryAuthorShare,
      busFactorOne,
      topAuthors,
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
  const filePaths = new Set(files.map((f) => f.relativePath));

  for (const issue of issues) {
    const haystack = `${issue.title}\n${issue.description}`;
    for (const filePath of filePaths) {
      if (!filePath) continue;
      if (haystack.includes(filePath)) {
        const list = index.get(filePath) ?? [];
        if (!list.includes(issue.id)) list.push(issue.id);
        index.set(filePath, list);
      }
    }
  }
  return index;
}

// ── Risk Scoring ──────────────────────────────────────────

interface ScoreInputs {
  churn: number;
  lines: number;
  authors: number;
  daysSinceLastChange: number | null;
  issueCount: number;
  busFactorOne?: boolean;
}

export function computeRiskScore(i: ScoreInputs): number {
  const churnWeight = Math.log2(1 + i.churn) * 20;
  const complexityWeight = Math.log2(1 + i.lines) * 4;
  const hotChurnXComplexity = Math.log2(1 + i.churn) * Math.log2(1 + i.lines) * 3;
  const authorWeight = Math.log2(1 + i.authors) * 5;
  const issueWeight = i.issueCount * 12;
  const busFactorPenalty = i.busFactorOne ? 15 : 0;

  let recencyBoost = 0;
  if (i.daysSinceLastChange !== null) {
    if (i.daysSinceLastChange <= 7) recencyBoost = 10;
    else if (i.daysSinceLastChange <= 30) recencyBoost = 6;
    else if (i.daysSinceLastChange <= 90) recencyBoost = 3;
  }

  const raw =
    churnWeight +
    complexityWeight +
    hotChurnXComplexity +
    authorWeight +
    issueWeight +
    recencyBoost +
    busFactorPenalty;

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

  if (i.lines >= 500) reasons.push(`large file (${i.lines} lines)`);
  else if (i.lines >= 250) reasons.push(`${i.lines} lines`);

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
