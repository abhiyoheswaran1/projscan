import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { addClaim, listClaims, releaseClaim } from '../../src/core/claims.js';

const execFileAsync = promisify(execFile);

let root: string;
let sibling: string;
const cleanup: string[] = [];

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd });
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-claims-'));
  cleanup.push(root);
  await git(root, 'init', '-q', '-b', 'main');
  await git(root, 'config', 'user.email', 't@t.t');
  await git(root, 'config', 'user.name', 't');
  await fs.writeFile(path.join(root, 'README.md'), '# fixture\n');
  await git(root, 'add', '.');
  await git(root, 'commit', '-q', '-m', 'base');
  sibling = `${root}-wt`;
  cleanup.push(sibling);
  await git(root, 'worktree', 'add', '-q', '-b', 'agent-b', sibling);
});

afterEach(async () => {
  await execFileAsync('git', ['worktree', 'remove', '--force', sibling], { cwd: root }).catch(() => {});
  await Promise.all(cleanup.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe('claims', () => {
  it('records a claim and lists it back', async () => {
    const { claim, contention } = await addClaim(root, { target: 'src/auth.ts', agent: 'agent-a' });
    expect(claim.target).toBe('src/auth.ts');
    expect(claim.agent).toBe('agent-a');
    expect(contention).toEqual([]);
    const claims = await listClaims(root);
    expect(claims.map((c) => c.target)).toContain('src/auth.ts');
  });

  it('is visible across worktrees (shared store in the git common dir)', async () => {
    await addClaim(root, { target: 'src/auth.ts', agent: 'agent-a' });
    // A sibling worktree (a second agent) sees the same claim store.
    const fromSibling = await listClaims(sibling);
    expect(fromSibling.map((c) => c.target)).toContain('src/auth.ts');
  });

  it('flags contention when another agent claims an overlapping target', async () => {
    await addClaim(root, { target: 'src/auth.ts', agent: 'agent-a' });
    const { contention } = await addClaim(sibling, { target: 'src/auth.ts', agent: 'agent-b' });
    expect(contention.map((c) => c.agent)).toContain('agent-a');
  });

  it('treats a directory claim as contending with a file under it', async () => {
    await addClaim(root, { target: 'src/auth', agent: 'agent-a' });
    const { contention } = await addClaim(sibling, { target: 'src/auth/login.ts', agent: 'agent-b' });
    expect(contention.map((c) => c.target)).toContain('src/auth');
  });

  it('does not flag the same agent re-claiming its own target', async () => {
    await addClaim(root, { target: 'src/auth.ts', agent: 'agent-a' });
    const { contention } = await addClaim(root, { target: 'src/auth.ts', agent: 'agent-a' });
    expect(contention).toEqual([]);
  });

  it('does not flag unrelated targets', async () => {
    await addClaim(root, { target: 'src/auth.ts', agent: 'agent-a' });
    const { contention } = await addClaim(sibling, { target: 'src/billing.ts', agent: 'agent-b' });
    expect(contention).toEqual([]);
  });

  it('releases a claim by id', async () => {
    const { claim } = await addClaim(root, { target: 'src/auth.ts', agent: 'agent-a' });
    const released = await releaseClaim(root, { id: claim.id });
    expect(released.map((c) => c.id)).toEqual([claim.id]);
    expect(await listClaims(root)).toEqual([]);
  });

  it('releases all claims for an agent', async () => {
    await addClaim(root, { target: 'src/a.ts', agent: 'agent-a' });
    await addClaim(root, { target: 'src/b.ts', agent: 'agent-a' });
    await addClaim(root, { target: 'src/c.ts', agent: 'agent-b' });
    const released = await releaseClaim(root, { agent: 'agent-a' });
    expect(released.length).toBe(2);
    expect((await listClaims(root)).map((c) => c.agent)).toEqual(['agent-b']);
  });
});
