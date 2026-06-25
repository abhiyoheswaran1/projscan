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

  const explicit = Boolean(explicitBaseRef);
  const candidates = explicitBaseRef ? [explicitBaseRef] : [...DEFAULT_BASE_REFS, 'HEAD~1'];
  let lastError: string | null = null;

  for (const ref of candidates) {
    const exists = await refExists(rootPath, ref);
    if (!exists) {
      lastError = `ref not found: ${ref}`;
      continue;
    }
    const resolvesToHead = await refResolvesToHead(rootPath, ref);
    if (resolvesToHead) {
      const reason = `base ref "${ref}" resolves to HEAD and would hide committed changes`;
      if (explicit) {
        return {
          available: false,
          reason,
          baseRef: null,
          files: [],
          uncommittedFiles: [],
        };
      }
      lastError = reason;
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

async function refResolvesToHead(rootPath: string, ref: string): Promise<boolean> {
  try {
    const [head, candidate] = await Promise.all([
      resolveRef(rootPath, 'HEAD'),
      resolveRef(rootPath, ref),
    ]);
    return head === candidate;
  } catch {
    return false;
  }
}

async function resolveRef(rootPath: string, ref: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['rev-parse', '--verify', ref], {
    cwd: rootPath,
  });
  return stdout.trim();
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
    ['diff', '-z', '--name-only', `${baseRef}...HEAD`],
    { cwd: rootPath, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 },
  );

  // Also include uncommitted changes so PR-style runs cover work-in-progress edits.
  let uncommitted: string[] = [];
  try {
    uncommitted = await statusNames(rootPath);
  } catch {
    // ignore
  }

  const set = new Set<string>();
  for (const file of parseNulList(stdout)) {
    if (file) set.add(normalizePath(file));
  }
  for (const f of uncommitted) set.add(f);

  return { files: [...set].sort(), uncommittedFiles: uncommitted };
}

async function statusNames(rootPath: string): Promise<string[]> {
  const { stdout } = await execFileAsync(
    'git',
    ['status', '--porcelain=v1', '-z', '--untracked-files=all'],
    { cwd: rootPath, encoding: 'buffer', maxBuffer: 10 * 1024 * 1024 },
  );
  const out = new Set<string>();
  const entries = parseNulList(stdout);
  for (let index = 0; index < entries.length; index += 1) {
    const raw = entries[index];
    if (!raw) continue;
    const status = raw.slice(0, 2);
    const file = raw.slice(3);
    if (!file) continue;
    out.add(normalizePath(file));
    if (isRenameOrCopyStatus(status)) index += 1;
  }
  return [...out];
}

function parseNulList(stdout: string | Buffer): string[] {
  const value = Buffer.isBuffer(stdout) ? stdout.toString('utf-8') : stdout;
  return value.split('\0').filter((entry) => entry.length > 0);
}

function isRenameOrCopyStatus(status: string): boolean {
  return status.includes('R') || status.includes('C');
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
