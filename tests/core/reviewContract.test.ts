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

describe('computeReview contract changes', () => {
  it('reports exported symbol contract changes', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', main: 'dist/api.js' }));
    await write('src/api.ts', `export function oldApi() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    for (let i = 2; i <= 6; i++) {
      await write('src/api.ts', `export function oldApi() { return ${i}; }\n`);
      await git(['add', '.']);
      await git(['commit', '-q', '-m', `churn api ${i}`]);
    }

    await write('src/api.ts', `export function newApi() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'replace api']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.contractChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'export-renamed',
          file: 'src/api.ts',
          symbol: 'newApi',
          before: 'oldApi',
          after: 'newApi',
          confidence: 'high',
        }),
      ]),
    );
    expect(r.contractChanges?.[0].why).toMatch(/downstream/i);
    expect(r.summary.some((line) => line.toLowerCase().includes('manual release sign-off'))).toBe(
      false,
    );
  });

  it('does not report internal helper exports as public contract changes', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', main: './dist/index.js' }));
    await write('src/index.ts', `export function publicApi() { return 1; }\n`);
    await write('src/core/helper.ts', `export function existingHelper() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/core/helper.ts',
      `export function existingHelper() { return 1; }
export function newHelper() { return 2; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add internal helper']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.contractChanges ?? []).toEqual([]);
  });

  it('reports exports added in files re-exported by package entrypoints', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', main: './dist/index.js' }));
    await write('src/index.ts', `export * from './api.js';\n`);
    await write('src/api.ts', `export function oldApi() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/api.ts',
      `export function oldApi() { return 1; }
export function newApi() { return 2; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add reexported api']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.contractChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'export-added',
          file: 'src/api.ts',
          symbol: 'newApi',
          confidence: 'high',
        }),
      ]),
    );
  });

  it('does not report contract changes for neutral public re-export grouping', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', main: './dist/index.js' }));
    await write(
      'src/index.ts',
      `export function oldApi() { return 1; }
export function anotherApi() { return 2; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write('src/index.ts', `export * from './publicCore.js';\n`);
    await write(
      'src/publicCore.ts',
      `export function oldApi() { return 1; }
export function anotherApi() { return 2; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'group public exports']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.contractChanges ?? []).toEqual([]);
  });

  it('reports exports added in source files for declaration entrypoints', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', types: 'dist/index.d.ts' }));
    await write('src/index.ts', `export function oldApi() { return 1; }\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write(
      'src/index.ts',
      `export function oldApi() { return 1; }
export function newApi() { return 2; }
`,
    );
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'add declaration api']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.contractChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'export-added',
          file: 'src/index.ts',
          symbol: 'newApi',
          confidence: 'high',
        }),
      ]),
    );
  });

  it('reports package entrypoint contract changes', async () => {
    await setupRepo();
    await write('package.json', JSON.stringify({ name: 'x', main: './old.js' }, null, 2));
    await write('old.js', `export const value = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'init']);

    await write('package.json', JSON.stringify({ name: 'x', main: './new.js' }, null, 2));
    await write('new.js', `export const value = 1;\n`);
    await git(['add', '.']);
    await git(['commit', '-q', '-m', 'move entrypoint']);

    const r = await computeReview(tmp, { base: 'HEAD~1', head: 'HEAD' });

    expect(r.available).toBe(true);
    expect(r.contractChanges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'entrypoint-changed',
          file: 'package.json',
          symbol: 'main',
          before: './old.js',
          after: './new.js',
          confidence: 'high',
        }),
      ]),
    );
  });
});
