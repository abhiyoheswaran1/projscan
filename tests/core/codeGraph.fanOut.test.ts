import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fanout-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

describe('per-function fan-out (computed in buildCodeGraph)', () => {
  it('counts distinct internal callees from a function body', async () => {
    await write(
      'src/a.ts',
      `export function foo() {}\nexport function bar() {}\nexport function baz() {}\n`,
    );
    await write(
      'src/b.ts',
      `import { foo, bar, baz } from './a.js';
export function caller() {
  foo();
  foo(); // duplicate, should count once
  bar();
  baz();
  externalLib(); // not in graph; should not count
}
`,
    );
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const caller = graph.files.get('src/b.ts')!.functions!.find((f) => f.name === 'caller');
    expect(caller?.fanOut).toBe(3);
  });

  it('emits per-function callSites on the FunctionInfo', async () => {
    await write(
      'src/a.ts',
      `export function helper() {}
export function caller() {
  helper();
  helper(); // dedup
  Math.max(1, 2);
}
`,
    );
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const caller = graph.files.get('src/a.ts')!.functions!.find((f) => f.name === 'caller');
    expect(caller?.callSites).toBeDefined();
    expect(new Set(caller!.callSites)).toEqual(new Set(['helper', 'max']));
  });

  it('does not count self-recursion as fan-out', async () => {
    await write(
      'src/a.ts',
      `export function recurse() { recurse(); }\n`,
    );
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const fn = graph.files.get('src/a.ts')!.functions!.find((f) => f.name === 'recurse');
    expect(fn?.fanOut).toBe(0);
  });

  it('returns 0 for functions that call nothing', async () => {
    await write('src/a.ts', `export function empty() {}\n`);
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const fn = graph.files.get('src/a.ts')!.functions!.find((f) => f.name === 'empty');
    expect(fn?.fanOut).toBe(0);
  });
});
