import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getChangedFiles } from '../../src/utils/changedFiles.js';

const execFileAsync = promisify(execFile);

async function git(cwd: string, args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}

async function setupRepo(): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-diff-'));
  await git(dir, ['init', '-q', '--initial-branch=main']);
  await git(dir, ['config', 'user.email', 'test@example.com']);
  await git(dir, ['config', 'user.name', 'Test']);
  await git(dir, ['config', 'commit.gpgsign', 'false']);
  return dir;
}

describe('getChangedFiles', () => {
  let repo: string;

  beforeEach(async () => {
    repo = await setupRepo();
  });

  afterEach(async () => {
    await fs.rm(repo, { recursive: true, force: true });
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

  it('includes uncommitted working-tree changes', async () => {
    await fs.writeFile(path.join(repo, 'a.txt'), 'one');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'first']);

    // Uncommitted new file — no second commit yet
    await fs.writeFile(path.join(repo, 'uncommitted.txt'), 'wip');

    // No HEAD~1 exists yet (only one commit), but status fallback should still surface the file.
    const result = await getChangedFiles(repo);
    expect(result.available).toBe(true);
    expect(result.files).toContain('uncommitted.txt');
  });

  it('returns available=false when base ref does not exist', async () => {
    await fs.writeFile(path.join(repo, 'a.txt'), 'one');
    await git(repo, ['add', 'a.txt']);
    await git(repo, ['commit', '-q', '-m', 'first']);

    const result = await getChangedFiles(repo, 'nonexistent-ref');
    expect(result.available).toBe(false);
  });
});
