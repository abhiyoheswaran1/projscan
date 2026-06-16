import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { detectCollisions, listWorktrees } from '../../src/core/collisionDetector.js';

const execFileAsync = promisify(execFile);

let root: string; // main worktree
let sibling: string; // linked worktree
const cleanup: string[] = [];

async function git(cwd: string, ...args: string[]): Promise<void> {
  await execFileAsync('git', args, { cwd, env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' } });
}

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-collision-'));
  cleanup.push(root);
  await git(root, 'init', '-q', '-b', 'main');
  await git(root, 'config', 'user.email', 't@t.t');
  await git(root, 'config', 'user.name', 't');
  await fs.mkdir(path.join(root, 'src'), { recursive: true });
  // auth.ts imports db.ts → db.ts is in auth.ts's blast radius.
  await fs.writeFile(
    path.join(root, 'src', 'db.ts'),
    'export function query(sql: string) { return sql; }\n',
  );
  await fs.writeFile(
    path.join(root, 'src', 'auth.ts'),
    'import { query } from "./db.js"; export function login() { return query("select 1"); }\n',
  );
  await fs.writeFile(path.join(root, 'src', 'unrelated.ts'), 'export const x = 1;\n');
  // service.ts → auth.ts → db.ts: service is two hops from db (transitive only).
  await fs.writeFile(
    path.join(root, 'src', 'service.ts'),
    'import { login } from "./auth.js"; export function run() { return login(); }\n',
  );
  await git(root, 'add', '.');
  await git(root, 'commit', '-q', '-m', 'base');

  // Sibling worktree on its own branch (a second in-flight agent).
  sibling = `${root}-wt`;
  cleanup.push(sibling);
  await git(root, 'worktree', 'add', '-q', '-b', 'agent-b', sibling);
});

afterEach(async () => {
  // Remove worktrees first so the main repo dir can be cleaned.
  await execFileAsync('git', ['worktree', 'remove', '--force', sibling], { cwd: root }).catch(
    () => {},
  );
  await Promise.all(cleanup.splice(0).map((d) => fs.rm(d, { recursive: true, force: true })));
});

describe('listWorktrees', () => {
  it('enumerates the main worktree and linked worktrees with their branches', async () => {
    const wts = await listWorktrees(root);
    const branches = wts.map((w) => w.branch).sort();
    expect(wts.length).toBe(2);
    expect(branches).toEqual(['agent-b', 'main']);
  });
});

describe('detectCollisions', () => {
  it('is unavailable when there is only one worktree', async () => {
    await execFileAsync('git', ['worktree', 'remove', '--force', sibling], { cwd: root });
    const report = await detectCollisions(root);
    expect(report.available).toBe(false);
    expect(report.collisions).toEqual([]);
  });

  it('flags a same-file collision when two worktrees change the same file', async () => {
    // Agent A (main): uncommitted edit to db.ts. Agent B (sibling): committed edit to db.ts.
    await fs.writeFile(
      path.join(root, 'src', 'db.ts'),
      'export function query(sql: string) { return sql.trim(); }\n',
    );
    await fs.writeFile(
      path.join(sibling, 'src', 'db.ts'),
      'export function query(sql: string) { return sql.toUpperCase(); }\n',
    );
    await git(sibling, 'commit', '-qam', 'b edits db');

    const report = await detectCollisions(root);

    expect(report.available).toBe(true);
    const sameFile = report.collisions.filter((c) => c.kind === 'same-file');
    expect(sameFile.some((c) => c.fileA === 'src/db.ts' && c.severity === 'high')).toBe(true);
  });

  it('flags a dependency collision when one worktree edits a file the other imports', async () => {
    // Agent A (main): edits db.ts. Agent B (sibling): edits auth.ts, which imports db.ts.
    await fs.writeFile(
      path.join(root, 'src', 'db.ts'),
      'export function query(sql: string) { return sql.trim(); }\n',
    );
    await fs.writeFile(
      path.join(sibling, 'src', 'auth.ts'),
      'import { query } from "./db.js"; export function login() { return query("select 2"); }\n',
    );
    await git(sibling, 'commit', '-qam', 'b edits auth');

    const report = await detectCollisions(root);

    expect(report.available).toBe(true);
    const dep = report.collisions.filter((c) => c.kind === 'dependency');
    expect(
      dep.some(
        (c) =>
          (c.fileA === 'src/db.ts' && c.fileB === 'src/auth.ts') ||
          (c.fileA === 'src/auth.ts' && c.fileB === 'src/db.ts'),
      ),
    ).toBe(true);
  });

  it('reports no collision when worktrees touch unrelated files', async () => {
    await fs.writeFile(
      path.join(root, 'src', 'db.ts'),
      'export function query(sql: string) { return sql.trim(); }\n',
    );
    await fs.writeFile(path.join(sibling, 'src', 'unrelated.ts'), 'export const x = 2;\n');
    await git(sibling, 'commit', '-qam', 'b edits unrelated');

    const report = await detectCollisions(root);

    expect(report.available).toBe(true);
    expect(report.collisions).toEqual([]);
  });
});

describe('detectCollisions — transitive recall (opt-in)', () => {
  beforeEach(async () => {
    // Agent A (main): edit db.ts. Agent B: edit service.ts (service → auth → db,
    // so service is TWO hops from db — invisible to the precise 1-hop default).
    await fs.writeFile(
      path.join(root, 'src', 'db.ts'),
      'export function query(sql: string) { return sql.trim(); }\n',
    );
    await fs.writeFile(
      path.join(sibling, 'src', 'service.ts'),
      'import { login } from "./auth.js"; export function run() { return login() + 1; }\n',
    );
    await git(sibling, 'commit', '-qam', 'b edits service');
  });

  it('does NOT flag the two-hop dependency by default (precise 1-hop)', async () => {
    const report = await detectCollisions(root);
    const dep = report.collisions.filter(
      (c) =>
        c.kind === 'dependency' && (c.fileA === 'src/service.ts' || c.fileB === 'src/service.ts'),
    );
    expect(dep).toEqual([]);
  });

  it('flags the two-hop dependency when transitive recall is enabled, with a distance', async () => {
    const report = await detectCollisions(root, { transitive: true });
    const hit = report.collisions.find(
      (c) =>
        c.kind === 'dependency' &&
        ((c.fileA === 'src/db.ts' && c.fileB === 'src/service.ts') ||
          (c.fileA === 'src/service.ts' && c.fileB === 'src/db.ts')),
    );
    expect(hit).toBeDefined();
    expect(hit?.distance).toBe(2);
  });
});
