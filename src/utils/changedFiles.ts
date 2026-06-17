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
  uncommittedFiles: string[];
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
      uncommittedFiles: [],
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
      const { files, uncommittedFiles } = await diffNames(rootPath, ref);
      return { available: true, baseRef: ref, files, uncommittedFiles };
    } catch (err) {
      // 1.10+ — surface stdio-too-large explicitly instead of letting it
      // fall through to the generic "no usable base ref" path. The ref
      // exists; the diff against it is just too big to fit in our 10MB
      // buffer (typical when HEAD has diverged from the base by 100K+
      // files). The user needs a closer base ref or a streaming reader,
      // not a missing-ref diagnosis.
      if (isMaxBufferError(err)) {
        return {
          available: false,
          reason:
            `git diff against "${ref}" exceeded the 10MB output buffer ` +
            '(typically > 100K files changed). Use --base-ref to pin a closer ref.',
          baseRef: null,
          files: [],
          uncommittedFiles: [],
        };
      }
      lastError = err instanceof Error ? err.message : String(err);
    }
  }

  // Last resort: include uncommitted changes only
  try {
    const files = await statusNames(rootPath);
    if (files.length > 0) {
      return { available: true, baseRef: '(working tree)', files, uncommittedFiles: files };
    }
  } catch (err) {
    lastError = err instanceof Error ? err.message : String(err);
  }

  return {
    available: false,
    reason: lastError ?? 'no usable base ref found',
    baseRef: null,
    files: [],
    uncommittedFiles: [],
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

async function diffNames(
  rootPath: string,
  baseRef: string,
): Promise<{ files: string[]; uncommittedFiles: string[] }> {
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

  return { files: [...set].sort(), uncommittedFiles: uncommitted };
}

async function statusNames(rootPath: string): Promise<string[]> {
  const { stdout } = await execFileAsync(
    'git',
    ['status', '--porcelain', '--untracked-files=all'],
    { cwd: rootPath, maxBuffer: 10 * 1024 * 1024 },
  );
  const out = new Set<string>();
  for (const raw of stdout.split('\n')) {
    if (!raw.trim()) continue;
    // Format: "XY path" or "XY orig -> new" for renames. Keep leading
    // status columns intact until after the regex strips them; trimming first
    // turns " M file" into "M file" and leaks the status into the path.
    const withoutStatus = raw.replace(/^..\s+/, '').trim();
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

function isMaxBufferError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { code?: unknown; message?: unknown };
  if (e.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return true;
  if (typeof e.message === 'string' && /maxBuffer length exceeded/i.test(e.message)) return true;
  return false;
}
