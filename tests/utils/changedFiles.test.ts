import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fsSync from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getChangedFiles } from '../../src/utils/changedFiles.js';
import { resolveGitWorktreeTarget } from '../../src/utils/gitWorktreeTarget.js';

const execFileAsync = promisify(execFile);
const GIT_CHANGED_FILES_TIMEOUT_MS = 60000;

vi.setConfig({
  testTimeout: GIT_CHANGED_FILES_TIMEOUT_MS,
  hookTimeout: GIT_CHANGED_FILES_TIMEOUT_MS,
});

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}

async function gitOutput(cwd: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync('git', args, { cwd });
  return stdout.trim();
}

async function setupRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-diff-'));
  await git(dir, ['init', '-q', '--initial-branch=main']);
  await git(dir, ['config', 'user.email', 'test@example.com']);
  await git(dir, ['config', 'user.name', 'Test']);
  await git(dir, ['config', 'commit.gpgsign', 'false']);
  return dir;
}

function canonicalPath(value: string): string {
  try {
    return fsSync.realpathSync.native(value);
  } catch {
    return path.resolve(value);
  }
}

interface LinkedWorktreeFixture {
  linkedWorktreePath: string;
  nestedLinkedFilePath: string;
}

async function setupLinkedWorktreeFixture(repoRoot: string): Promise<LinkedWorktreeFixture> {
  await fs.writeFile(path.join(repoRoot, 'base.txt'), 'base\n');
  await git(repoRoot, ['add', 'base.txt']);
  await git(repoRoot, ['commit', '-q', '-m', 'base']);

  const linkedWorktreePath = path.join(path.dirname(repoRoot), `${path.basename(repoRoot)}-agent-b`);
  await git(repoRoot, ['worktree', 'add', '-q', '-b', 'agent-b', linkedWorktreePath]);

  const nestedDir = path.join(linkedWorktreePath, 'src', 'nested');
  await fs.mkdir(nestedDir, { recursive: true });
  const nestedLinkedFilePath = path.join(nestedDir, 'feature.ts');

  return { linkedWorktreePath, nestedLinkedFilePath };
}

describe('getChangedFiles', () => {
  let repo: string;
  let extraCleanupPaths: string[];

  beforeEach(async () => {
    repo = await setupRepo();
    extraCleanupPaths = [];
  });

  afterEach(async () => {
    for (const cleanupPath of extraCleanupPaths) {
      await fs.rm(cleanupPath, { recursive: true, force: true });
    }
    if (repo) await fs.rm(repo, { recursive: true, force: true });
  });

  it('resolves linked worktrees and enclosing worktree roots from real git worktrees', async () => {
    const fixture = await setupLinkedWorktreeFixture(repo);
    extraCleanupPaths.push(fixture.linkedWorktreePath);
    const canonicalRepo = canonicalPath(repo);
    const canonicalLinkedWorktreePath = canonicalPath(fixture.linkedWorktreePath);
    const canonicalNestedLinkedFilePath = canonicalPath(fixture.nestedLinkedFilePath);
    const missingNestedLinkedFilePath = path.join(
      fixture.linkedWorktreePath,
      'missing',
      'deep',
      'path',
      'feature.ts',
    );

    const linkedTarget = await resolveGitWorktreeTarget(fixture.linkedWorktreePath);
    const sharedRootTarget = await resolveGitWorktreeTarget(repo);
    const nestedFileTarget = await resolveGitWorktreeTarget(repo, {
      targetPath: fixture.nestedLinkedFilePath,
    });
    const missingNestedFileTarget = await resolveGitWorktreeTarget(repo, {
      targetPath: missingNestedLinkedFilePath,
    });

    expect(linkedTarget.requestedPath).toBe(canonicalLinkedWorktreePath);
    expect(linkedTarget.effectiveWorktreePath).toBe(canonicalLinkedWorktreePath);
    expect(linkedTarget.gitCommonRoot).toBe(canonicalRepo);
    expect(linkedTarget.branch).toBe('agent-b');
    expect(linkedTarget.isLinkedWorktree).toBe(true);

    expect(sharedRootTarget.effectiveWorktreePath).toBe(canonicalRepo);
    expect(sharedRootTarget.gitCommonRoot).toBe(canonicalRepo);
    expect(sharedRootTarget.isLinkedWorktree).toBe(false);

    expect(nestedFileTarget.requestedPath).toBe(canonicalNestedLinkedFilePath);
    expect(nestedFileTarget.effectiveWorktreePath).toBe(canonicalLinkedWorktreePath);

    expect(missingNestedFileTarget.requestedPath).toBe(path.resolve(missingNestedLinkedFilePath));
    expect(missingNestedFileTarget.effectiveWorktreePath).toBe(canonicalLinkedWorktreePath);
  });

  it('returns null branch in detached HEAD state', async () => {
    await fs.writeFile(path.join(repo, 'a.txt'), 'one\n');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'first']);
    await git(repo, ['checkout', '--detach', 'HEAD']);

    const target = await resolveGitWorktreeTarget(repo);

    expect(target.branch).toBeNull();
  });

  it('returns available=false for non-git directories', async () => {
    const notRepo = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-notrepo-'));
    try {
      const result = await getChangedFiles(notRepo);
      expect(result.available).toBe(false);
      expect(result.files).toEqual([]);
    } finally {
      await fs.rm(notRepo, { recursive: true, force: true });
    }
  });

  it('detects files changed since HEAD~1', async () => {
    await fs.writeFile(path.join(repo, 'a.txt'), 'one');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'first']);

    await fs.writeFile(path.join(repo, 'b.txt'), 'two');
    await fs.writeFile(path.join(repo, 'a.txt'), 'one changed');
    await git(repo, ['add', '.']);
    await git(repo, ['commit', '-q', '-m', 'second']);

    const result = await getChangedFiles(repo, 'HEAD~1');
    expect(result.available).toBe(true);
    expect(result.baseRef).toBe('HEAD~1');
    expect(result.files.sort()).toEqual(['a.txt', 'b.txt']);
  });

  it('includes committed deletions in changed-file evidence', async () => {
    await fs.mkdir(path.join(repo, 'src'), { recursive: true });
    await fs.writeFile(path.join(repo, 'src', 'removed.ts'), 'export const removed = true;\n');
    await git(repo, ['add', 'src/removed.ts']);
    await git(repo, ['commit', '-q', '-m', 'first']);

    await fs.rm(path.join(repo, 'src', 'removed.ts'));
    await git(repo, ['add', '-u']);
    await git(repo, ['commit', '-q', '-m', 'delete removed file']);

    const result = await getChangedFiles(repo, 'HEAD~1');

    expect(result.available).toBe(true);
    expect(result.files).toEqual(['src/removed.ts']);
  });

  it('skips implicit base refs that resolve to HEAD', async () => {
    await fs.writeFile(path.join(repo, 'a.txt'), 'one');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'first']);

    await fs.writeFile(path.join(repo, 'a.txt'), 'two');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'second']);

    const result = await getChangedFiles(repo);

    expect(result.available).toBe(true);
    expect(result.baseRef).toBe('HEAD~1');
    expect(result.files).toEqual(['a.txt']);
  });

  it('rejects explicit base refs that resolve to HEAD', async () => {
    await fs.writeFile(path.join(repo, 'a.txt'), 'one');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'first']);

    const result = await getChangedFiles(repo, 'HEAD');

    expect(result.available).toBe(false);
    expect(result.reason).toContain('resolves to HEAD');
    expect(result.files).toEqual([]);
  });

  it('includes uncommitted working-tree changes', async () => {
    await fs.writeFile(path.join(repo, 'a.txt'), 'one');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'first']);

    // Uncommitted new file - no second commit yet
    await fs.writeFile(path.join(repo, 'uncommitted.txt'), 'wip');

    // No HEAD~1 exists yet (only one commit), but status fallback should still surface the file.
    const result = await getChangedFiles(repo);
    expect(result.available).toBe(true);
    expect(result.files).toContain('uncommitted.txt');
  });

  it('excludes projscan-owned cache and memory artifacts from changed files', async () => {
    await fs.writeFile(path.join(repo, 'a.txt'), 'one');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'first']);

    // projscan writes these itself as a side effect of running; they are never
    // the user's work, so they must not appear as changed files even when the
    // repo has no .gitignore for them.
    await fs.mkdir(path.join(repo, '.projscan-cache'), { recursive: true });
    await fs.writeFile(path.join(repo, '.projscan-cache', 'graph.json'), '{}');
    await fs.mkdir(path.join(repo, '.projscan-memory'), { recursive: true });
    await fs.writeFile(path.join(repo, '.projscan-memory', 'memory.json'), '{}');
    // A real edit alongside the artifacts, to prove filtering is selective.
    await fs.writeFile(path.join(repo, 'src.ts'), 'export const x = 1;\n');

    const result = await getChangedFiles(repo);

    expect(result.available).toBe(true);
    expect(result.files).toContain('src.ts');
    expect(result.files).not.toContain('.projscan-cache/graph.json');
    expect(result.files).not.toContain('.projscan-memory/memory.json');
    expect(result.uncommittedFiles).not.toContain('.projscan-cache/graph.json');
    expect(result.uncommittedFiles).not.toContain('.projscan-memory/memory.json');
  });

  it('expands untracked nested directories to file paths', async () => {
    await fs.writeFile(path.join(repo, 'a.txt'), 'one');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'first']);

    await fs.mkdir(path.join(repo, 'packages', 'api'), { recursive: true });
    await fs.writeFile(
      path.join(repo, 'packages', 'api', 'package.json'),
      '{"name":"@fixture/api"}\n',
    );

    const result = await getChangedFiles(repo);

    expect(result.available).toBe(true);
    expect(result.files).toContain('packages/api/package.json');
    expect(result.files).not.toContain('packages/');
  });

  it('normalizes modified working-tree paths without porcelain status prefixes', async () => {
    await fs.writeFile(path.join(repo, 'a.txt'), 'one');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'first']);

    await fs.writeFile(path.join(repo, 'a.txt'), 'one changed');

    const result = await getChangedFiles(repo);
    expect(result.available).toBe(true);
    expect(result.files).toContain('a.txt');
    expect(result.files).not.toContain('M a.txt');
  });

  it('preserves tracked diff paths that contain newlines', async () => {
    const filename = 'line\nbreak.txt';
    await fs.writeFile(path.join(repo, filename), 'one');
    await git(repo, ['add', filename]);
    await git(repo, ['commit', '-q', '-m', 'first']);

    await fs.writeFile(path.join(repo, filename), 'two');
    await git(repo, ['add', filename]);
    await git(repo, ['commit', '-q', '-m', 'second']);

    const result = await getChangedFiles(repo, 'HEAD~1');

    expect(result.files).toEqual([filename]);
    expect(result.files).not.toContain('line');
    expect(result.files).not.toContain('break.txt');
  });

  it('preserves untracked status paths that contain newlines', async () => {
    await fs.writeFile(path.join(repo, 'a.txt'), 'one');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'first']);
    const filename = 'untracked\nfile.txt';
    await fs.writeFile(path.join(repo, filename), 'two');

    const result = await getChangedFiles(repo);

    expect(result.files).toContain(filename);
    expect(result.files).not.toContain('untracked');
    expect(result.files).not.toContain('file.txt');
  });

  it('returns available=false when base ref does not exist', async () => {
    await fs.writeFile(path.join(repo, 'a.txt'), 'one');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'first']);

    const result = await getChangedFiles(repo, 'nonexistent-ref');
    expect(result.available).toBe(false);
  });

  it('targets the linked worktree when collecting changed files', async () => {
    const fixture = await setupLinkedWorktreeFixture(repo);
    extraCleanupPaths.push(fixture.linkedWorktreePath);
    const canonicalLinkedWorktreePath = canonicalPath(fixture.linkedWorktreePath);

    await fs.writeFile(path.join(fixture.linkedWorktreePath, 'linked-only.ts'), 'export const linked = 1;\n');
    await git(fixture.linkedWorktreePath, ['add', 'linked-only.ts']);
    await git(fixture.linkedWorktreePath, ['commit', '-q', '-m', 'linked change']);

    await fs.writeFile(path.join(repo, 'root-only.ts'), 'export const root = 1;\n');

    const result = await getChangedFiles(fixture.linkedWorktreePath, 'HEAD~1');
    const linkedHead = await gitOutput(fixture.linkedWorktreePath, ['rev-parse', 'HEAD']);

    expect(result.available).toBe(true);
    expect(result.files).toContain('linked-only.ts');
    expect(result.files).not.toContain('root-only.ts');
    expect(result.effectiveWorktreePath).toBe(canonicalLinkedWorktreePath);
    expect(result.effectiveWorktreeBranch).toBe('agent-b');
    expect(result.effectiveWorktreeHead).toBe(linkedHead);
  });
});
