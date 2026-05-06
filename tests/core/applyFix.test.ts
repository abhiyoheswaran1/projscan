import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { executePlan, rollback, type ApplyPlan } from '../../src/core/applyFix.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-apply-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function read(rel: string): Promise<string> {
  return fs.readFile(path.join(tmp, rel), 'utf-8');
}

async function exists(rel: string): Promise<boolean> {
  try {
    await fs.access(path.join(tmp, rel));
    return true;
  } catch {
    return false;
  }
}

describe('executePlan', () => {
  describe('dry-run', () => {
    it('plans a create without writing', async () => {
      const plan: ApplyPlan = {
        summary: 'create x',
        changes: [{ path: 'x.json', op: 'create', content: '{}\n' }],
      };
      const res = await executePlan(tmp, plan, { dryRun: true });
      expect(res.ok).toBe(true);
      expect(res.applied).toBe(false);
      expect(res.changes).toHaveLength(1);
      expect(res.changes[0].afterHash).toBeTruthy();
      expect(await exists('x.json')).toBe(false);
    });

    it('plans a modify with before+after hashes', async () => {
      await fs.writeFile(path.join(tmp, 'a.txt'), 'old');
      const plan: ApplyPlan = {
        summary: 'modify a',
        changes: [{ path: 'a.txt', op: 'modify', content: 'new' }],
      };
      const res = await executePlan(tmp, plan, { dryRun: true });
      expect(res.applied).toBe(false);
      expect(res.changes[0].beforeHash).toBeTruthy();
      expect(res.changes[0].afterHash).toBeTruthy();
      expect(res.changes[0].beforeHash).not.toBe(res.changes[0].afterHash);
      expect(await read('a.txt')).toBe('old');
    });
  });

  describe('apply', () => {
    it('writes a created file and returns a rollback id', async () => {
      const plan: ApplyPlan = {
        summary: 'create x',
        changes: [{ path: 'x.json', op: 'create', content: '{}\n' }],
      };
      const res = await executePlan(tmp, plan);
      expect(res.ok).toBe(true);
      expect(res.applied).toBe(true);
      expect(res.rollbackId).toMatch(/^[0-9a-f-]{36}$/);
      expect(await read('x.json')).toBe('{}\n');
    });

    it('modifies an existing file atomically', async () => {
      await fs.writeFile(path.join(tmp, 'a.txt'), 'old');
      const plan: ApplyPlan = {
        summary: 'modify',
        changes: [{ path: 'a.txt', op: 'modify', content: 'new' }],
      };
      await executePlan(tmp, plan);
      expect(await read('a.txt')).toBe('new');
    });

    it('deletes an existing file', async () => {
      await fs.writeFile(path.join(tmp, 'kill.txt'), 'doomed');
      const plan: ApplyPlan = {
        summary: 'delete',
        changes: [{ path: 'kill.txt', op: 'delete' }],
      };
      const res = await executePlan(tmp, plan);
      expect(res.ok).toBe(true);
      expect(await exists('kill.txt')).toBe(false);
    });
  });

  describe('refusals', () => {
    it('refuses to create over an existing file', async () => {
      await fs.writeFile(path.join(tmp, 'a.txt'), 'already');
      const plan: ApplyPlan = {
        summary: 'bad create',
        changes: [{ path: 'a.txt', op: 'create', content: 'x' }],
      };
      const res = await executePlan(tmp, plan);
      expect(res.ok).toBe(false);
      expect(res.reason).toMatch(/already exists/);
      expect(await read('a.txt')).toBe('already');
    });

    it('refuses to modify a non-existent file', async () => {
      const plan: ApplyPlan = {
        summary: 'bad modify',
        changes: [{ path: 'nope.txt', op: 'modify', content: 'x' }],
      };
      const res = await executePlan(tmp, plan);
      expect(res.ok).toBe(false);
      expect(res.reason).toMatch(/does not exist/);
    });

    it('refuses path traversal', async () => {
      const plan: ApplyPlan = {
        summary: 'evil',
        changes: [{ path: '../escape.txt', op: 'create', content: 'x' }],
      };
      const res = await executePlan(tmp, plan);
      expect(res.ok).toBe(false);
      expect(res.reason).toMatch(/unsafe target path/);
    });

    it('refuses absolute paths', async () => {
      const plan: ApplyPlan = {
        summary: 'evil',
        changes: [{ path: '/etc/passwd', op: 'modify', content: 'x' }],
      };
      const res = await executePlan(tmp, plan);
      expect(res.ok).toBe(false);
      expect(res.reason).toMatch(/unsafe target path/);
    });
  });

  describe('multi-change atomic rollback (catch-block)', () => {
    it('rolls back successfully-created files when a later change fails mid-apply', async () => {
      // Trigger Phase-2 failure: first change creates `a.txt` as a file, then
      // a second change tries to create `a.txt/inner.txt` — mkdir on path.
      // dirname() expects `a.txt` to be a directory, but it's now a file →
      // fs.mkdir(... { recursive: true }) throws ENOTDIR. The catch block
      // must unlink `a.txt` so disk is back to its pre-apply state.
      const plan: ApplyPlan = {
        summary: 'create then mid-apply fail',
        changes: [
          { path: 'a.txt', op: 'create', content: 'hello\n' },
          { path: 'a.txt/inner.txt', op: 'create', content: 'never\n' },
        ],
      };
      const res = await executePlan(tmp, plan, { dryRun: false });
      expect(res.ok).toBe(false);
      expect(res.applied).toBe(false);
      expect(res.reason).toMatch(/Apply failed at "a\.txt\/inner\.txt"/);
      // The first change must have been rolled back.
      expect(await exists('a.txt')).toBe(false);
      // Second change never wrote anything (verify on the file form).
      expect(await exists('a.txt/inner.txt')).toBe(false);
      // No rollback record should have been written, since apply did not succeed.
      expect(await exists('.projscan-cache/rollbacks')).toBe(false);
    });

    it('restores prior content of a modified file when a later change fails', async () => {
      // Set up: a.txt exists with original content. Plan: modify a.txt,
      // then create b.txt/inner.txt (which fails because b.txt doesn't
      // exist in the form needed). Wait — actually we need the second
      // change to fail AFTER a.txt is modified. Use the same trick: plan
      // [create x.txt, modify a.txt, create x.txt/inner.txt]. Second
      // succeeds, third fails.
      await fs.writeFile(path.join(tmp, 'a.txt'), 'ORIGINAL');
      const plan: ApplyPlan = {
        summary: 'create + modify + fail',
        changes: [
          { path: 'x.txt', op: 'create', content: 'first' },
          { path: 'a.txt', op: 'modify', content: 'NEW' },
          { path: 'x.txt/inner.txt', op: 'create', content: 'never' },
        ],
      };
      const res = await executePlan(tmp, plan, { dryRun: false });
      expect(res.ok).toBe(false);
      expect(res.reason).toMatch(/Apply failed at "x\.txt\/inner\.txt"/);
      // x.txt should have been unlinked (created → reversed).
      expect(await exists('x.txt')).toBe(false);
      // a.txt should be back to its original content.
      expect(await read('a.txt')).toBe('ORIGINAL');
    });
  });

  describe('rollback', () => {
    it('reverses a create', async () => {
      const plan: ApplyPlan = {
        summary: 'create x',
        changes: [{ path: 'x.txt', op: 'create', content: 'hello' }],
      };
      const applied = await executePlan(tmp, plan);
      expect(await exists('x.txt')).toBe(true);
      const undo = await rollback(tmp, applied.rollbackId!);
      expect(undo.ok).toBe(true);
      expect(await exists('x.txt')).toBe(false);
    });

    it('reverses a modify', async () => {
      await fs.writeFile(path.join(tmp, 'a.txt'), 'original');
      const plan: ApplyPlan = {
        summary: 'mod',
        changes: [{ path: 'a.txt', op: 'modify', content: 'edited' }],
      };
      const applied = await executePlan(tmp, plan);
      expect(await read('a.txt')).toBe('edited');
      await rollback(tmp, applied.rollbackId!);
      expect(await read('a.txt')).toBe('original');
    });

    it('returns ok:false for unknown rollback id', async () => {
      const undo = await rollback(tmp, 'never-existed');
      expect(undo.ok).toBe(false);
      expect(undo.reason).toMatch(/No rollback record/);
    });

    it('rejects path-traversal in rollback id (security regression)', async () => {
      // Plant a planted .json file at the EXACT path that '../../secret'
      // would resolve to, so this test would FAIL (read the planted file)
      // without the UUID-format guard. Without the guard:
      //   path.join(tmp, '.projscan-cache/rollbacks', '../../secret.json')
      //     → `<tmp>/secret.json` (segments collapse during resolve)
      // With the guard: '../../secret' fails the UUID regex → readRollbackRecord
      // returns null → rollback() returns ok:false with "No rollback record".
      const planted = {
        schemaVersion: 1,
        rollbackId: 'planted',
        createdAt: 'x',
        summary: 'x',
        changes: [],
      };
      await fs.writeFile(path.join(tmp, 'secret.json'), JSON.stringify(planted));
      const undo = await rollback(tmp, '../../secret');
      expect(undo.ok).toBe(false);
      expect(undo.reason).toMatch(/No rollback record/);
    });

    it('rejects non-UUID rollback ids even when a same-named .json exists on disk (security regression)', async () => {
      // Plant a record at exactly the path a `not-a-uuid` lookup would try
      // to read. This is the test that actually exercises the UUID guard:
      // without the regex check, readRollbackRecord would read this file,
      // accept its valid schema, and rollback() would return ok:true with
      // an empty changes array (i.e. an attacker could replay arbitrary
      // .json content named *.json under .projscan-cache/rollbacks/).
      // With the guard, `not-a-uuid` is rejected by the regex before the
      // read, so we get ok:false / "No rollback record".
      const dir = path.join(tmp, '.projscan-cache', 'rollbacks');
      await fs.mkdir(dir, { recursive: true });
      await fs.writeFile(
        path.join(dir, 'not-a-uuid.json'),
        JSON.stringify({
          schemaVersion: 1,
          rollbackId: 'not-a-uuid',
          createdAt: 'x',
          summary: 'planted',
          changes: [],
        }),
      );
      const undo = await rollback(tmp, 'not-a-uuid');
      expect(undo.ok).toBe(false);
      expect(undo.reason).toMatch(/No rollback record/);
    });

    it('rejects a syntactically-valid UUID v3 (regression: regex must pin v4)', async () => {
      // A v3 UUID has the same shape as a v4 but version digit `3`.
      // Plant a same-named .json file so the test would PASS without a
      // strict-v4 regex. With `[1-5]` (lenient): would read the file,
      // return ok:true. With `4` (tight): rejected, ok:false.
      const dir = path.join(tmp, '.projscan-cache', 'rollbacks');
      await fs.mkdir(dir, { recursive: true });
      const v3Id = '11111111-1111-3111-8111-111111111111';
      await fs.writeFile(
        path.join(dir, `${v3Id}.json`),
        JSON.stringify({
          schemaVersion: 1,
          rollbackId: v3Id,
          createdAt: 'x',
          summary: 'planted',
          changes: [],
        }),
      );
      const undo = await rollback(tmp, v3Id);
      expect(undo.ok).toBe(false);
      expect(undo.reason).toMatch(/No rollback record/);
    });
  });
});
