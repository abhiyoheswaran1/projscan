import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { spawn } from 'node:child_process';
import { computeReview } from '../../src/core/review.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-review-test-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

function git(args: string[], cwd: string = tmp): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const c = spawn('git', args, { cwd, env: { ...process.env, GIT_AUTHOR_NAME: 't', GIT_AUTHOR_EMAIL: 't@x', GIT_COMMITTER_NAME: 't', GIT_COMMITTER_EMAIL: 't@x' } });
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

  it('flags new high-CC function as risky on file modification', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export function foo() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // Modify src/a.ts to add a function with CC >= 10.
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
    // Verdict should escalate at least to 'review' on a risky-function flag.
    expect(r.verdict === 'review' || r.verdict === 'block').toBe(true);
  });

  it('detects new cycles introduced between refs', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/a.ts', `export const a = 1;\n`);
    await write('src/b.ts', `export const b = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // Introduce a cycle a -> b -> a.
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

  it('flags a NEW taint flow introduced by the PR and forces verdict to block (1.6+)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    // Base has a benign reader.
    await write(
      'src/handler.ts',
      `export function handler() { return 1; }\n`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // PR introduces process.env source + exec sink in the same function.
    await write(
      'src/handler.ts',
      `import { exec } from 'child_process';
export function handler() {
  const cmd = process.env.MY_CMD;
  exec(cmd ?? 'echo hi');
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add exec']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    expect(r.newTaintFlows.length).toBeGreaterThan(0);
    const flow = r.newTaintFlows.find((f) => f.sourceFn === 'handler');
    expect(flow).toBeDefined();
    expect(flow!.source).toBe('env');
    expect(flow!.sink).toBe('exec');
    // A new taint flow always blocks.
    expect(r.verdict).toBe('block');
    expect(r.summary.some((s) => s.includes('taint'))).toBe(true);
  });

  it('does NOT flag pre-existing taint flows in unchanged files (1.6+ regression)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    // src/danger.ts already has a flow at base.
    await write(
      'src/danger.ts',
      `import { exec } from 'child_process';
export function danger() {
  const cmd = process.env.MY_CMD;
  exec(cmd ?? 'echo hi');
}
`,
    );
    await write('src/other.ts', `export const x = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // PR only edits src/other.ts, leaves src/danger.ts alone.
    await write('src/other.ts', `export const x = 2;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'tweak other']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    // The flow exists at head, but it ALSO existed at base, AND the PR
    // didn't touch any file along its path — must not surface as new.
    expect(r.newTaintFlows).toHaveLength(0);
    expect(r.verdict).toBe('ok');
  });

  it('flags a NEW cross-file taint flow (source in one file, sink in another) (1.6+)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    // Sink file already exists at base — wraps child_process.exec.
    await write(
      'src/sink.ts',
      `import { exec } from 'child_process';
export function runIt(cmd: string | undefined) { exec(cmd ?? 'echo'); }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    // PR adds a NEW source file that reads process.env and calls into the
    // existing sink wrapper. Source-fn is in src/reader.ts, sink-fn is in
    // src/sink.ts — exercises the cross-file BFS path.
    await write(
      'src/reader.ts',
      `import { runIt } from './sink.js';
export function reader() {
  const v = process.env.MY_CMD;
  runIt(v);
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add reader']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
    expect(r.available).toBe(true);
    const flow = r.newTaintFlows.find((f) => f.sourceFn === 'reader');
    expect(flow).toBeDefined();
    expect(flow!.sinkFn).toBe('runIt');
    expect(flow!.source).toBe('env');
    expect(flow!.sink).toBe('exec');
    // Path crosses files: reader (src/reader.ts) → runIt (src/sink.ts).
    expect(flow!.files).toEqual(['src/reader.ts', 'src/sink.ts']);
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
});
