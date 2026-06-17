import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeReview } from '../../src/core/review.js';
import {
  createReviewRepoTemp,
  GIT_REVIEW_TIMEOUT_MS,
  git,
  removeReviewRepoTemp,
  setupRepo,
  withFailingWorktreeAdd,
  write,
} from '../helpers/reviewRepo.js';

let tmp: string;

vi.setConfig({ testTimeout: GIT_REVIEW_TIMEOUT_MS, hookTimeout: GIT_REVIEW_TIMEOUT_MS });

beforeEach(async () => {
  tmp = await createReviewRepoTemp();
});

afterEach(async () => {
  await removeReviewRepoTemp(tmp);
});

describe('computeReview', () => {
  it('returns unavailable when not a git repo', async () => {
    const r = await computeReview(tmp);
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/Not a git repository/);
  });

  it('returns ok verdict with no changes between identical refs', async () => {
    await setupRepo(tmp);
    await write(tmp, 'package.json', JSON.stringify({ name: 'x' }));
    await write(tmp, 'src/a.ts', `export const a = 1;\n`);
    await git(tmp, ['add', '.']);
    await git(tmp, ['commit', '-q', '-m', 'init']);

    const r = await computeReview(tmp, { base: 'HEAD', head: 'HEAD' });
    expect(r.available).toBe(true);
    expect(r.verdict).toBe('ok');
    expect(r.changedFiles).toHaveLength(0);
  });

  it('reviews dirty worktree changes when base and head resolve to the same commit', async () => {
    await setupRepo(tmp);
    await write(tmp, 'package.json', JSON.stringify({ name: 'x' }));
    await write(tmp, 'src/a.ts', `export const a = 1;\n`);
    await git(tmp, ['add', '.']);
    await git(tmp, ['commit', '-q', '-m', 'init']);

    await write(tmp, 'src/a.ts', `export const a = 2;\nexport const b = 3;\n`);

    const r = await computeReview(tmp, { base: 'HEAD', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.changedFiles.map((file) => file.relativePath)).toContain('src/a.ts');
    expect(r.prDiff.totalFilesChanged).toBeGreaterThan(0);
    expect(r.summary).not.toEqual(['No structural changes detected between base and head.']);
  });

  it('returns unavailable when the base worktree cannot be checked out', async () => {
    await setupRepo(tmp);
    await write(tmp, 'package.json', JSON.stringify({ name: 'x' }));
    await write(tmp, 'src/a.ts', `export const a = 1;\n`);
    await git(tmp, ['add', '.']);
    await git(tmp, ['commit', '-q', '-m', 'init']);

    await write(tmp, 'src/a.ts', `export const a = 2;\n`);
    await git(tmp, ['add', '.']);
    await git(tmp, ['commit', '-q', '-m', 'change a']);

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
    await setupRepo(tmp);
    await write(tmp, 'package.json', JSON.stringify({ name: 'x' }));
    await write(tmp, 'src/a.ts', `export const a = 1;\n`);
    await git(tmp, ['add', '.']);
    await git(tmp, ['commit', '-q', '-m', 'init']);

    const r = await computeReview(tmp, { base: 'HEAD', head: 'missing-head' });

    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/Could not resolve head ref "missing-head"/);
    expect(r.base).toEqual({ ref: 'HEAD', resolvedSha: expect.any(String) });
    expect(r.head).toEqual({ ref: 'missing-head', resolvedSha: null });
    expect(r.changedFiles).toEqual([]);
    expect(r.prDiff.totalFilesChanged).toBe(0);
  });
});
