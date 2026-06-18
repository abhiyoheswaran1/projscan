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
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-review-signals-test-'));
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

describe('computeReview structural signals', () => {
  it('flags new high-CC function as risky on file modification', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export function foo() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/a.ts',
      `export function foo() { return 1; }
export function bar(x) {
  if (x > 1) return 1;
  if (x > 2) return 2;
  if (x > 3) return 3;
  if (x > 4) return 4;
  if (x > 5) return 5;
  if (x > 6) return 6;
  if (x > 7) return 7;
  if (x > 8) return 8;
  if (x > 9) return 9;
  return 0;
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add bar']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    const bar = r.riskyFunctions.find((f) => f.name === 'bar');
    expect(bar).toBeDefined();
    expect(bar!.cyclomaticComplexity).toBeGreaterThanOrEqual(10);
    expect(bar!.reason).toBe('added');
    expect(r.verdict === 'review' || r.verdict === 'block').toBe(true);
  });

  it('does NOT report false-positive risky-functions when a file has multiple anonymous arrows (regression)', async () => {
    // Regression for a bug live since 0.13.0:
    // findRiskyFunctions used `Map<name, cc>` keyed by fn.name. Many real
    // files have multiple INLINE arrow callbacks (no binding name -> ast.ts
    // labels them '<anonymous>'), which collapsed into a single map entry.
    // Every head <anonymous> compared against the LAST base <anonymous>'s CC.
    //
    // To trigger the bug we need: (1) two inline arrows in the same file,
    // not `export const foo = ...` arrows, those bind to a name, and (2)
    // ordering such that the LAST base anon's CC differs enough from the
    // FIRST head anon's CC to cross the jump threshold. Below: base has
    // [arrow_high (CC about 8), arrow_low (CC=1)]; the buggy code stores
    // baseByName.<anonymous> = 1 (the low one, last write). Head has the
    // same two arrows unchanged, but when iterating head fns, the FIRST
    // (still CC about 8) gets paired with baseCc=1 -> delta 7 >=
    // CC_JUMP_THRESHOLD (5) -> false-positive 'jumped' on an arrow that
    // did not move.
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write(
      'src/api.ts',
      `export function api(items) {
  return items
    .filter(x => {
      if (x === 1) return true;
      if (x === 2) return true;
      if (x === 3) return true;
      if (x === 4) return true;
      if (x === 5) return true;
      if (x === 6) return true;
      if (x === 7) return true;
      return false;
    })
    .map(x => x + 1);
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // Head: same body unchanged + a NEW exported helper. The new export
    // is what makes prDiff classify the file as 'modified' (without a
    // structural change, prDiff.filesModified is empty and findRiskyFunctions
    // never iterates the file). The two inline arrows still have CC 8 and 1.
    // Under the buggy code: the cc=8 filter callback is paired with the
    // last-write-of-baseByName.<anonymous>=1 -> delta 7 >= CC_JUMP_THRESHOLD
    // -> 'jumped' flag on an arrow that did not move.
    await write(
      'src/api.ts',
      `export function api(items) {
  return items
    .filter(x => {
      if (x === 1) return true;
      if (x === 2) return true;
      if (x === 3) return true;
      if (x === 4) return true;
      if (x === 5) return true;
      if (x === 6) return true;
      if (x === 7) return true;
      return false;
    })
    .map(x => x + 1);
}

export function helper() {
  return 42;
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add helper']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    expect(r.riskyFunctions.filter((f) => f.file === 'src/api.ts')).toHaveLength(0);
  });

  it('detects new cycles introduced between refs', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await write('src/b.ts', `export const b = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write('src/a.ts', `import { b } from './b.js';\nexport const a = b;\n`);
    await write('src/b.ts', `import { a } from './a.js';\nexport const b = a;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add cycle']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    expect(r.newCycles.length).toBeGreaterThan(0);
    expect(r.newCycles[0].classification).toBe('new');
    expect(r.verdict).toBe('block');
  });

  it('reports dependency additions in package.json', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', dependencies: {} }));
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'package.json',
      JSON.stringify({ name: 'x', dependencies: { axios: '^1.0.0' } }, null, 2),
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add axios']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    expect(r.dependencyChanges).toHaveLength(1);
    const change = r.dependencyChanges[0];
    expect(change.added).toContainEqual({ name: 'axios', version: '^1.0.0', kind: 'dep' });
  });

  it('summarizes dependency kind moves separately from package additions and removals', async () => {
    await setupRepo();
    await write(
      'package.json',
      JSON.stringify({ name: 'x', dependencies: { axios: '^1.0.0' } }, null, 2),
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'package.json',
      JSON.stringify({ name: 'x', devDependencies: { axios: '^1.0.0' } }, null, 2),
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'move axios to dev']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.dependencyChanges[0].added).toContainEqual({
      name: 'axios',
      version: '^1.0.0',
      kind: 'dev',
    });
    expect(r.dependencyChanges[0].removed).toContainEqual({
      name: 'axios',
      version: '^1.0.0',
      kind: 'dep',
    });
    expect(r.summary).toContain('Dependency changes: kind moves 1 runtime->dev.');
    expect(r.summary).not.toContain('Dependency changes: +1 -1 ~0.');
  });

  it('labels release-scale review blocks as manual sign-off', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', dependencies: {} }, null, 2));
    await write('src/hot.ts', `export const value = 0;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    for (let i = 1; i <= 5; i++) {
      await write('src/hot.ts', `export const value = ${i};\n`);
      await git(['add', '.']);
      await git(['commit', '-q', '-m', `churn ${i}`]);
    }

    await write(
      'package.json',
      JSON.stringify({ name: 'x', dependencies: { axios: '^1.0.0' } }, null, 2),
    );
    await write('src/hot.ts', `export const value = 6;\nexport const releaseGate = true;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'release-scale change']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.verdict).toBe('block');
    expect(r.riskyFunctions).toEqual([]);
    expect(r.newTaintFlows).toEqual([]);
    expect(r.newDataflowRisks).toEqual([]);
    expect(r.contractChanges ?? []).toEqual([]);
    expect(r.summary.some((line) => line.includes('Maximum changed-file risk score'))).toBe(true);
    expect(r.summary).toContain('Dependency changes: +1 -0 ~0.');
    expect(r.summary.some((line) => line.toLowerCase().includes('manual release sign-off'))).toBe(
      true,
    );
  });
});
