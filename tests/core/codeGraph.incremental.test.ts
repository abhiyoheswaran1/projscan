import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildCodeGraph, incrementallyUpdateGraph } from '../../src/core/codeGraph.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-incr-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

describe('incrementallyUpdateGraph', () => {
  it('picks up a new file added after the initial build', async () => {
    await write('src/a.ts', `export function foo() {}\n`);
    let scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    expect(graph.files.has('src/a.ts')).toBe(true);
    expect(graph.files.has('src/b.ts')).toBe(false);

    // Add b.ts that imports a.ts
    await write('src/b.ts', `import { foo } from './a.js';\nfoo();\n`);
    await incrementallyUpdateGraph(graph, tmp, ['src/b.ts']);
    expect(graph.files.has('src/b.ts')).toBe(true);
    // Edge should be reflected in localImporters.
    const importersOfA = graph.localImporters.get('src/a.ts');
    expect(importersOfA?.has('src/b.ts')).toBe(true);
  });

  it('updates exports and call sites when a file is edited', async () => {
    await write('src/a.ts', `export function foo() {}\n`);
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const fooDefs = graph.symbolDefs.get('foo');
    expect(fooDefs?.has('src/a.ts')).toBe(true);

    // Rename foo to bar.
    await write('src/a.ts', `export function bar() {}\n`);
    await incrementallyUpdateGraph(graph, tmp, ['src/a.ts']);
    expect(graph.symbolDefs.get('foo')).toBeUndefined();
    expect(graph.symbolDefs.get('bar')?.has('src/a.ts')).toBe(true);
  });

  it('drops a deleted file from the graph + indexes', async () => {
    await write('src/a.ts', `export function foo() {}\n`);
    await write('src/b.ts', `import { foo } from './a.js';\nfoo();\n`);
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    expect(graph.localImporters.get('src/a.ts')?.has('src/b.ts')).toBe(true);

    // Delete b.ts.
    await fs.rm(path.join(tmp, 'src/b.ts'));
    await incrementallyUpdateGraph(graph, tmp, ['src/b.ts']);
    expect(graph.files.has('src/b.ts')).toBe(false);
    expect(graph.localImporters.get('src/a.ts')?.has('src/b.ts')).toBeFalsy();
  });

  it('recomputes per-function fan-in after an edit', async () => {
    await write('src/a.ts', `export function foo() {}\n`);
    await write('src/b.ts', `import { foo } from './a.js';\nfoo();\n`);
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const fooFn = graph.files.get('src/a.ts')!.functions!.find((f) => f.name === 'foo');
    expect(fooFn?.fanIn).toBe(1);

    // b.ts stops calling foo.
    await write('src/b.ts', `export const x = 1;\n`);
    await incrementallyUpdateGraph(graph, tmp, ['src/b.ts']);
    const fooFnAfter = graph.files.get('src/a.ts')!.functions!.find((f) => f.name === 'foo');
    expect(fooFnAfter?.fanIn).toBe(0);
  });

  it('returns the same graph reference (in-place update)', async () => {
    await write('src/a.ts', `export const a = 1;\n`);
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const result = await incrementallyUpdateGraph(graph, tmp, []);
    expect(result).toBe(graph);
  });
});
