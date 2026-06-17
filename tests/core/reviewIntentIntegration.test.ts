import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { computeReview } from '../../src/core/review.js';
import {
  createReviewRepoTemp,
  GIT_REVIEW_TIMEOUT_MS,
  git,
  removeReviewRepoTemp,
  setupRepo,
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

describe('computeReview intent integration', () => {
  it('annotates findings with intent alignment when intent is passed (1.9+)', async () => {
    await setupRepo(tmp);
    await write(tmp, 'package.json', JSON.stringify({ name: 'x' }));
    await write(tmp, 'src/auth.ts', `export function login() { return 1; }\n`);
    await git(tmp, ['add', '.']);
    await git(tmp, ['commit', '-q', '-m', 'init']);

    // Add a new file in the auth module - matches the stated intent.
    await write(tmp, 'src/auth/session.ts', `export function newSession() { return {}; }\n`);
    await git(tmp, ['add', '.']);
    await git(tmp, ['commit', '-q', '-m', 'add session']);

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

    const newFile = r.changedFiles.find((f) => f.relativePath === 'src/auth/session.ts');
    expect(newFile?.intentAlignment).toBe('expected');
    expect(r.summary.some((s) => /Intent:/.test(s))).toBe(true);
    expect(['ok', 'review', 'block']).toContain(r.verdict);
  });

  it('omits intent fields when no intent is passed (1.9+ default)', async () => {
    await setupRepo(tmp);
    await write(tmp, 'package.json', JSON.stringify({ name: 'x' }));
    await write(tmp, 'src/a.ts', `export const a = 1;\n`);
    await git(tmp, ['add', '.']);
    await git(tmp, ['commit', '-q', '-m', 'init']);
    const r = await computeReview(tmp, { base: 'HEAD', head: 'HEAD' });
    expect(r.intent).toBeUndefined();
    expect(r.intentAnalysis).toBeUndefined();
  });
});
