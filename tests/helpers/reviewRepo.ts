import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawn } from 'node:child_process';

export const GIT_REVIEW_TIMEOUT_MS = 60000;

export interface GitResult {
  code: number;
  stdout: string;
  stderr: string;
}

export function createReviewRepoTemp(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-review-test-'));
}

export function removeReviewRepoTemp(root: string): Promise<void> {
  return fs.rm(root, { recursive: true, force: true });
}

export function git(root: string, args: string[]): Promise<GitResult> {
  return new Promise((resolve) => {
    const c = spawn('git', args, {
      cwd: root,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: 't',
        GIT_AUTHOR_EMAIL: 't@x',
        GIT_COMMITTER_NAME: 't',
        GIT_COMMITTER_EMAIL: 't@x',
      },
    });
    let so = '';
    let se = '';
    c.stdout.on('data', (d) => (so += d.toString()));
    c.stderr.on('data', (d) => (se += d.toString()));
    c.on('close', (code) => resolve({ code: code ?? 1, stdout: so, stderr: se }));
  });
}

export async function write(root: string, rel: string, content: string): Promise<void> {
  const full = path.join(root, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

export async function setupRepo(root: string): Promise<void> {
  await git(root, ['init', '-q', '-b', 'main']);
  await git(root, ['config', 'user.email', 't@x']);
  await git(root, ['config', 'user.name', 't']);
}

export async function withFailingWorktreeAdd<T>(fn: () => Promise<T>): Promise<T> {
  const oldPath = process.env.PATH ?? '';
  const oldRealPath = process.env.PROJSCAN_TEST_REAL_PATH;
  const fakeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fake-git-'));
  const fakeGit = path.join(fakeDir, 'git');
  await fs.writeFile(
    fakeGit,
    `#!/bin/sh
if [ "$1" = "worktree" ] && [ "$2" = "add" ]; then
  echo "fatal: could not create directory of .git/worktrees/projscan-review: Operation not permitted" >&2
  exit 128
fi
PATH="$PROJSCAN_TEST_REAL_PATH" exec git "$@"
`,
    'utf-8',
  );
  await fs.chmod(fakeGit, 0o755);
  process.env.PROJSCAN_TEST_REAL_PATH = oldPath;
  process.env.PATH = `${fakeDir}${path.delimiter}${oldPath}`;
  try {
    return await fn();
  } finally {
    process.env.PATH = oldPath;
    if (oldRealPath === undefined) {
      delete process.env.PROJSCAN_TEST_REAL_PATH;
    } else {
      process.env.PROJSCAN_TEST_REAL_PATH = oldRealPath;
    }
    await fs.rm(fakeDir, { recursive: true, force: true });
  }
}
