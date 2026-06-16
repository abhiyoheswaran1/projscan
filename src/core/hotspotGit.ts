import { spawn } from 'node:child_process';
import path from 'node:path';

export interface ChurnEntry {
  churn: number;
  authors: Set<string>;
  authorCommits: Map<string, number>;
  lastTimestampMs: number | null;
  commitHashes: Set<string>;
}

interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

interface GitCommitState {
  hash: string | null;
  author: string | null;
  timestampMs: number | null;
}

export async function isGitRepository(rootPath: string): Promise<boolean> {
  try {
    const { code } = await runGit(rootPath, ['rev-parse', '--is-inside-work-tree']);
    return code === 0;
  } catch {
    return false;
  }
}

export async function collectGitChurn(
  rootPath: string,
  since: string,
): Promise<Map<string, ChurnEntry>> {
  const stdout = await readGitLog(rootPath, since);
  return stdout ? parseGitChurn(stdout) : new Map();
}

export function countCommits(churnMap: Map<string, ChurnEntry>): number {
  const hashes = new Set<string>();
  for (const entry of churnMap.values()) {
    for (const hash of entry.commitHashes) hashes.add(hash);
  }
  return hashes.size;
}

async function readGitLog(rootPath: string, since: string): Promise<string | null> {
  try {
    const result = await runGit(rootPath, gitLogArgs(since), { timeoutMs: 15_000 });
    return result.code === 0 ? result.stdout : null;
  } catch {
    return null;
  }
}

function gitLogArgs(since: string): string[] {
  return [
    'log',
    `--since=${since}`,
    '--no-merges',
    '--name-only',
    '--pretty=format:COMMIT|%H|%ae|%at',
  ];
}

function parseGitChurn(stdout: string): Map<string, ChurnEntry> {
  const map = new Map<string, ChurnEntry>();
  let commit: GitCommitState = { hash: null, author: null, timestampMs: null };

  for (const rawLine of stdout.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line) continue;
    if (line.startsWith('COMMIT|')) {
      commit = parseCommitLine(line);
      continue;
    }
    recordFileChange(map, commit, line);
  }

  return map;
}

function parseCommitLine(line: string): GitCommitState {
  const parts = line.split('|');
  const timestampSeconds = parseInt(parts[3] ?? '', 10);
  return {
    hash: parts[1] ?? null,
    author: parts[2] ?? null,
    timestampMs: Number.isFinite(timestampSeconds) ? timestampSeconds * 1000 : null,
  };
}

function recordFileChange(
  map: Map<string, ChurnEntry>,
  commit: GitCommitState,
  rawPath: string,
): void {
  if (!commit.hash) return;
  const filePath = normalizeFilePath(rawPath);
  if (!filePath) return;

  const entry = getOrCreateChurnEntry(map, filePath);
  recordCommit(entry, commit);
}

function getOrCreateChurnEntry(map: Map<string, ChurnEntry>, filePath: string): ChurnEntry {
  const existing = map.get(filePath);
  if (existing) return existing;

  const entry: ChurnEntry = {
    churn: 0,
    authors: new Set(),
    authorCommits: new Map(),
    lastTimestampMs: null,
    commitHashes: new Set(),
  };
  map.set(filePath, entry);
  return entry;
}

function recordCommit(entry: ChurnEntry, commit: GitCommitState): void {
  if (commit.hash && !entry.commitHashes.has(commit.hash)) {
    entry.commitHashes.add(commit.hash);
    entry.churn++;
    incrementAuthorCommit(entry, commit.author);
  }
  if (commit.author) entry.authors.add(commit.author);
  if (
    commit.timestampMs !== null &&
    (entry.lastTimestampMs === null || commit.timestampMs > entry.lastTimestampMs)
  ) {
    entry.lastTimestampMs = commit.timestampMs;
  }
}

function incrementAuthorCommit(entry: ChurnEntry, author: string | null): void {
  if (!author) return;
  entry.authorCommits.set(author, (entry.authorCommits.get(author) ?? 0) + 1);
}

function normalizeFilePath(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  return trimmed.split(path.sep).join('/').replace(/^\.\//, '');
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

    child.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    child.stderr.on('data', (data) => {
      stderr += data.toString();
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
