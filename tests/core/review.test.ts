import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { computeReview } from '../../src/core/review.js';

let tmp: string;
const GIT_REVIEW_TIMEOUT_MS = 60000;

vi.setConfig({ testTimeout: GIT_REVIEW_TIMEOUT_MS, hookTimeout: GIT_REVIEW_TIMEOUT_MS });

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-review-test-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

function git(
  args: string[],
  cwd: string = tmp,
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const c = spawn('git', args, {
      cwd,
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

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

async function setupRepo(): Promise<void> {
  await git(['init', '-q', '-b', 'main']);
  await git(['config', 'user.email', 't@x']);
  await git(['config', 'user.name', 't']);
}

async function withFailingWorktreeAdd<T>(fn: () => Promise<T>): Promise<T> {
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

describe('computeReview', () => {
  it('returns unavailable when not a git repo', async () => {
    const r = await computeReview(tmp);
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/Not a git repository/);
  });

  it('returns ok verdict with no changes between identical refs', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    const r = await computeReview(tmp, { base: 'HEAD', head: 'HEAD' });
    expect(r.available).toBe(true);
    expect(r.verdict).toBe('ok');
    expect(r.changedFiles).toHaveLength(0);
  });

  it('reviews dirty worktree changes when base and head resolve to the same commit', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write('src/a.ts', `export const a = 2;\nexport const b = 3;\n`);

    const r = await computeReview(tmp, { base: 'HEAD', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.changedFiles.map((file) => file.relativePath)).toContain('src/a.ts');
    expect(r.prDiff.totalFilesChanged).toBeGreaterThan(0);
    expect(r.summary).not.toEqual(['No structural changes detected between base and head.']);
  });

  it('returns unavailable when the base worktree cannot be checked out', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write('src/a.ts', `export const a = 2;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'change a']);

    const r = await withFailingWorktreeAdd(() =>
      computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' }),
    );

    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/Could not check out base ref "HEAD~1"/);
    expect(r.changedFiles).toEqual([]);
    expect(r.newTaintFlows).toEqual([]);
    expect(r.newDataflowRisks).toEqual([]);
  });

  it('returns unavailable when an explicit head ref cannot be resolved', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    const r = await computeReview(tmp, { base: 'HEAD', head: 'missing-head' });

    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/Could not resolve head ref "missing-head"/);
    expect(r.base).toEqual({ ref: 'HEAD', resolvedSha: expect.any(String) });
    expect(r.head).toEqual({ ref: 'missing-head', resolvedSha: null });
    expect(r.changedFiles).toEqual([]);
    expect(r.prDiff.totalFilesChanged).toBe(0);
  });

  it('annotates findings with intent alignment when intent is passed (1.9+)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/auth.ts', `export function login() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // Add a new file in the auth module — matches the stated intent.
    await write('src/auth/session.ts', `export function newSession() { return {}; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add session']);

    const r = await computeReview(tmp, {
      base: 'HEAD~1',
      head: 'HEAD',
      intent: 'Add session management to auth',
    });
    expect(r.available).toBe(true);
    expect(r.intent).toBeDefined();
    expect(r.intent?.action).toBe('feature');
    expect(r.intent?.scopeTokens).toContain('auth');
    expect(r.intentAnalysis).toBeDefined();
    // The new src/auth/session.ts should be expected (feature + auth scope).
    const newFile = r.changedFiles.find((f) => f.relativePath === 'src/auth/session.ts');
    expect(newFile?.intentAlignment).toBe('expected');
    // Summary picks up an intent bullet.
    expect(r.summary.some((s) => /Intent:/.test(s))).toBe(true);
    // Verdict-flavoring sanity: verdict is one of the documented values.
    expect(['ok', 'review', 'block']).toContain(r.verdict);
  });

  it('omits intent fields when no intent is passed (1.9+ default)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);
    const r = await computeReview(tmp, { base: 'HEAD', head: 'HEAD' });
    expect(r.intent).toBeUndefined();
    expect(r.intentAnalysis).toBeUndefined();
  });
});
