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
  });
});
