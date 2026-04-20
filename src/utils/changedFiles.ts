import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import path from 'node:path';

const execFileAsync = promisify(execFile);

const DEFAULT_BASE_REFS = ['origin/main', 'origin/master', 'main', 'master'];

export interface ChangedFilesResult {
  available: boolean;
  reason?: string;
  baseRef: string | null;
  files: string[];
}

/**
 * Return files changed since a git base ref. Uses three-dot diff semantics
 * (merge-base…HEAD) to surface "new in this branch" changes. Falls back
 * across a list of common base refs, then HEAD~1 if none exist.
 *
 * Returned paths are relative (POSIX-style) to rootPath, matching FileEntry.relativePath.
 */
export async function getChangedFiles(
  rootPath: string,
  explicitBaseRef?: string,
): Promise<ChangedFilesResult> {
  const isRepo = await isGitRepo(rootPath);
  if (!isRepo) {
    return {
      available: false,
      reason: 'not a git repository',
      baseRef: null,
      files: [],
    };
  }

  const candidates = explicitBaseRef ? [explicitBaseRef] : [...DEFAULT_BASE_REFS, 'HEAD~1'];
  let lastError: string | null = null;

  for (const ref of candidates) {
    const exists = await refExists(rootPath, ref);
    if (!exists) {
      lastError = `ref not found: ${ref}`;
      continue;
    }
    try {
      const files = await diffNames(rootPath, ref);
      return { available: true, baseRef: ref, files };
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // Last resort: include uncommitted changes only
  try {
    const files = await statusNames(rootPath);
    if (files.length > 0) {
      return { available: true, baseRef: '(working tree)', files };
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }

  return {
    available: false,
    reason: lastError ?? 'no usable base ref found',
    baseRef: null,
    files: [],
  };
}

async function isGitRepo(rootPath: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--git-dir'], { cwd: rootPath });
    return true;
  } catch {
    return false;
  }
}

async function refExists(rootPath: string, ref: string): Promise<boolean> {
  try {
    await execFileAsync('git', ['rev-parse', '--verify', '--quiet', ref], { cwd: rootPath });
    return true;
  } catch {
    return false;
  }
}

async function diffNames(rootPath: string, baseRef: string): Promise<string[]> {
  const { stdout } = await execFileAsync(
    'git',
    ['diff', '--name-only', '--diff-filter=d', `${baseRef}...HEAD`],
    { cwd: rootPath, maxBuffer: 10 * 1024 * 1024 },
  );

  // Also include uncommitted changes so PR-style runs cover work-in-progress edits.
  let uncommitted: string[] = [];
  try {
    uncommitted = await statusNames(rootPath);
  } catch {
    // ignore
  }

  const set = new Set<string>();
  for (const raw of stdout.split('\n')) {
    const line = raw.trim();
    if (line) set.add(normalizePath(line));
  }
  for (const f of uncommitted) set.add(f);

  return [...set].sort();
}

async function statusNames(rootPath: string): Promise<string[]> {
  const { stdout } = await execFileAsync(
    'git',
    ['status', '--porcelain'],
    { cwd: rootPath, maxBuffer: 10 * 1024 * 1024 },
  );
  const out = new Set<string>();
  for (const raw of stdout.split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // Format: "XY path" or "XY orig -> new" for renames
    const withoutStatus = line.replace(/^..\s+/, '');
    const renamed = withoutStatus.includes(' -> ')
      ? withoutStatus.split(' -> ').pop()!
      : withoutStatus;
    out.add(normalizePath(renamed));
  }
  return [...out];
}

function normalizePath(p: string): string {
  return p.split(path.sep).join('/');
}
