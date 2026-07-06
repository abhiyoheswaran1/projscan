import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export interface GitWorktreeTarget {
  requestedPath: string;
  effectiveWorktreePath: string;
  gitCommonRoot: string | null;
  gitDir: string | null;
  branch: string | null;
  head: string | null;
  isLinkedWorktree: boolean;
}

export interface ResolveGitWorktreeTargetOptions {
  targetPath?: string;
}

export async function resolveGitWorktreeTarget(
  cwd: string,
  options: ResolveGitWorktreeTargetOptions = {},
): Promise<GitWorktreeTarget> {
  const requestedPath = canonicalizePath(
    options.targetPath ? path.resolve(cwd, options.targetPath) : cwd,
  );
  const gitCwd = resolveGitCwd(requestedPath);

  const effectiveWorktreePath = canonicalizePath(
    await gitRevParse(gitCwd, ['--path-format=absolute', '--show-toplevel']),
  );
  const gitCommonDir = canonicalizeOptionalPath(
    await gitRevParse(gitCwd, ['--path-format=absolute', '--git-common-dir']),
  );
  const gitDir = canonicalizeOptionalPath(
    await gitRevParse(gitCwd, ['--path-format=absolute', '--git-dir']),
  );
  const head = await gitRevParse(gitCwd, ['--verify', 'HEAD']).catch(() => null);
  const branch = await gitSymbolicRef(gitCwd, 'HEAD').catch(() => null);
  const commonRootWorktreePath = deriveCommonRootWorktreePath(gitCommonDir);

  return {
    requestedPath,
    effectiveWorktreePath,
    gitCommonRoot: commonRootWorktreePath,
    gitDir,
    branch,
    head,
    isLinkedWorktree:
      commonRootWorktreePath !== null && effectiveWorktreePath !== commonRootWorktreePath,
  };
}

function resolveGitCwd(targetPath: string): string {
  try {
    const stats = fs.statSync(targetPath);
    return stats.isDirectory() ? targetPath : path.dirname(targetPath);
  } catch {
    return path.dirname(targetPath);
  }
}

async function gitRevParse(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', ['rev-parse', ...args], {
    cwd,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim();
}

async function gitSymbolicRef(cwd: string, ref: string): Promise<string> {
  const { stdout } = await execFileAsync('git', ['symbolic-ref', ref], {
    cwd,
    maxBuffer: 1024 * 1024,
  });
  return stdout.trim().replace(/^refs\/heads\//, '');
}

function deriveCommonRootWorktreePath(gitCommonDir: string | null): string | null {
  if (!gitCommonDir) return null;
  if (path.basename(gitCommonDir) !== '.git') return null;
  return canonicalizePath(path.dirname(gitCommonDir));
}

function canonicalizeOptionalPath(value: string | null): string | null {
  if (!value) return null;
  return canonicalizePath(value);
}

function canonicalizePath(value: string): string {
  try {
    return fs.realpathSync.native(value);
  } catch {
    return path.resolve(value);
  }
}
