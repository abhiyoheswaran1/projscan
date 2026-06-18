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
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-review-flow-test-'));
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

describe('computeReview flow risks', () => {
  it('does not block on taint or dataflow risks that only touch test files', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write(
      'src/a.ts',
      `export const a = 1;
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'tests/helper.test.ts',
      `import { writeFile } from 'node:fs/promises';

export function readSecret() {
  return process.env.TOKEN;
}

export async function writeSecret(value: string | undefined) {
  await writeFile('tmp-token', value ?? '');
}

export async function bridge() {
  const value = readSecret();
  return writeSecret(value);
}

export async function direct() {
  await writeFile('tmp-token', process.env.TOKEN ?? '');
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add test helper']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.newTaintFlows).toEqual([]);
    expect(r.newDataflowRisks).toEqual([]);
    expect(r.summary.some((line) => line.includes('taint flow'))).toBe(false);
    expect(r.summary.some((line) => line.includes('dataflow risk'))).toBe(false);
  });

  it('does not promote broad file-IO bridge dataflow to review blockers', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write(
      'src/cache.ts',
      `export function refresh() { return 1; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/cache.ts',
      `import { readFile, writeFile } from 'node:fs/promises';

export function readCache() {
  return readFile('cache.json', 'utf8');
}

export function saveCache(value: string) {
  return writeFile('cache.json', value);
}

export async function refresh() {
  const value = await readCache();
  return saveCache(value);
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add cache refresh']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.newDataflowRisks).toEqual([]);
    expect(r.summary.some((line) => line.includes('dataflow risk'))).toBe(false);
  });

  it('does not block review on unrelated generic parse/exec dataflow collisions', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write(
      'src/config.ts',
      `export function safeParse(raw: string) { return JSON.parse(raw); }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/config.ts',
      `import { parse } from './version.js';

export function safeParse(raw: string) {
  return parse(raw);
}
`,
    );
    await write(
      'src/version.ts',
      `const RE = /^v?(\d+)\.(\d+)\.(\d+)$/;

export function parse(version: string) {
  return RE.exec(version);
}
`,
    );
    await write(
      'scripts/smoke.mjs',
      `export function exec(command) {
  return process.env.PATH ? command : '';
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add parser and smoke helper']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(
      r.newDataflowRisks.find(
        (risk) =>
          risk.kind === 'bridge' &&
          risk.bridgeFn === 'safeParse' &&
          risk.sourceFn === 'exec' &&
          risk.sinkFn === 'parse',
      ),
    ).toBeUndefined();
    expect(r.summary.some((line) => line.includes('safeParse'))).toBe(false);
  });


  it('flags a NEW taint flow introduced by the PR and forces verdict to block (1.6+)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    // Base has a benign reader.
    await write('src/handler.ts', `export function handler() { return 1; }\n`);
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

  it('flags a NEW bridge dataflow risk introduced by the PR and forces verdict to block (3.0)', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x' }));
    await write('src/bridge.ts', `export function bridge() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/bridge.ts',
      `import { exec } from 'child_process';

export function readSecret() {
  return process.env.TOKEN;
}

export function runDangerous(value: string | undefined) {
  exec(value ?? 'echo ok');
}

export function bridge() {
  const value = readSecret();
  return runDangerous(value);
}
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add bridge risk']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.newTaintFlows).toHaveLength(0);
    expect(r.newDataflowRisks.some((risk) => risk.kind === 'bridge')).toBe(true);
    expect(r.graphEvidence).toEqual(
      expect.objectContaining({
        schemaVersion: 1,
        changedFiles: 1,
        dataflowRisks: 1,
      }),
    );
    expect(r.graphEvidence?.totalFunctions).toBeGreaterThanOrEqual(3);
    expect(r.graphEvidence?.totalCallEdges).toBeGreaterThanOrEqual(2);
    expect(r.verdict).toBe('block');
    expect(r.summary.some((s) => s.includes('dataflow'))).toBe(true);
  });

  it(
    'scopes taint, dataflow, graph evidence, and verdict to the requested workspace package',
    async () => {
      await setupRepo();
      await write(
        'package.json',
        JSON.stringify({ name: 'root', private: true, workspaces: ['packages/*'] }, null, 2),
      );
      await write(
        'packages/api/package.json',
        JSON.stringify({ name: '@app/api', main: './old.js' }, null, 2),
      );
      await write(
        'packages/api/src/danger.ts',
        `export function ok() { return 1; }
`,
      );
      await write(
        'packages/api/src/a.ts',
        `export const a = 1;
`,
      );
      await write(
        'packages/api/src/b.ts',
        `export const b = 1;
`,
      );
      await write(
        'packages/ui/package.json',
        JSON.stringify({ name: '@app/ui', main: './src/view.ts' }, null, 2),
      );
      await write(
        'packages/ui/src/view.ts',
        `export function view() { return 'old'; }
`,
      );
      await git(['add', '.']);
      await git(['commit', '-q', '-m', 'init monorepo']);

      await write(
        'packages/api/package.json',
        JSON.stringify({ name: '@app/api', main: './new.js' }, null, 2),
      );
      await write(
        'packages/api/src/danger.ts',
        `import { exec } from 'node:child_process';

export function runDangerous() {
  const command = process.env.API_CMD;
  exec(command ?? 'echo api');
}
`,
      );
      await write(
        'packages/api/src/a.ts',
        `import { b } from './b.js';
export const a = b;
`,
      );
      await write(
        'packages/api/src/b.ts',
        `import { a } from './a.js';
export const b = a;
`,
      );
      await write(
        'packages/ui/src/view.ts',
        `export function view() { return 'new'; }
export function button() { return 'button'; }
`,
      );
      await git(['add', '.']);
      await git(['commit', '-q', '-m', 'change api and ui']);

      const full = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
      expect(full.available).toBe(true);
      expect(full.verdict).toBe('block');
      expect(full.newTaintFlows.length + full.newDataflowRisks.length).toBeGreaterThan(0);

      const scoped = await computeReview(tmp, {
        base: 'HEAD~1',
        head: 'HEAD',
        package: '@app/ui',
      });
      expect(scoped.available).toBe(true);
      expect(scoped.verdict).not.toBe('block');
      expect(scoped.changedFiles.map((file) => file.relativePath)).toEqual([
        'packages/ui/src/view.ts',
      ]);
      expect(scoped.newCycles).toEqual([]);
      expect(scoped.newTaintFlows).toEqual([]);
      expect(scoped.newDataflowRisks).toEqual([]);
      expect((scoped.contractChanges ?? []).map((change) => change.file)).toEqual([
        'packages/ui/src/view.ts',
      ]);
      expect(scoped.graphEvidence?.changedFiles).toBe(1);
      expect(scoped.graphEvidence?.totalFunctions).toBe(2);
      expect(scoped.graphEvidence?.totalPackages).toBe(0);
      expect(scoped.graphEvidence?.topPackages).toEqual([]);
      expect(scoped.graphEvidence?.dataflowRisks).toBe(0);
      expect(
        scoped.summary.some(
          (line) =>
            line.includes('dataflow risk') ||
            line.includes('taint flow') ||
            line.includes('import cycle'),
        ),
      ).toBe(false);
    },
    120_000,
  );

  it(
    'suppresses default generated-code taint and dataflow review blockers but keeps custom risks',
    async () => {
      await setupRepo();
      await write('package.json', JSON.stringify({ name: 'x' }));
      await write(
        '.projscanrc.json',
        JSON.stringify({ taint: { sources: ['customSource'], sinks: ['customSink'] } }, null, 2),
      );
      await write(
        'src/__generated__/client.ts',
        `export function generatedClient() { return 1; }
`,
      );
      await git(['add', '.']);
      await git(['commit', '-q', '-m', 'init generated client']);

      await write(
        'src/__generated__/client.ts',
        `import { exec } from 'node:child_process';

export function generatedClient() {
  const command = process.env.GENERATED_CMD;
  exec(command ?? 'echo generated');
}
`,
      );
      await git(['add', '.']);
      await git(['commit', '-q', '-m', 'default generated flow']);

      const defaultGenerated = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
      expect(defaultGenerated.available).toBe(true);
      expect(defaultGenerated.newTaintFlows).toEqual([]);
      expect(defaultGenerated.newDataflowRisks).toEqual([]);
      expect(defaultGenerated.verdict).not.toBe('block');

      await write(
        'src/__generated__/client.ts',
        `declare function customSource(): string;
declare function customSink(value: string): void;

export function generatedClient() {
  const value = customSource();
  customSink(value);
}

export function readGenerated() {
  return customSource();
}

export function sendGenerated(value: string) {
  customSink(value);
}

export function generatedBridge() {
  const value = readGenerated();
  sendGenerated(value);
}
`,
      );
      await git(['add', '.']);
      await git(['commit', '-q', '-m', 'custom generated flow']);

      const customGenerated = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });
      expect(customGenerated.available).toBe(true);
      expect(customGenerated.newTaintFlows.some((flow) => flow.source === 'customSource')).toBe(
        true,
      );
      expect(customGenerated.newDataflowRisks.some((risk) => risk.source === 'customSource')).toBe(
        true,
      );
      expect(customGenerated.verdict).toBe('block');
    },
    120_000,
  );

});
