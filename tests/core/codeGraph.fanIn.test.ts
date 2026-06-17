import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { parseSource, type FunctionInfo } from '../../src/core/ast.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-fanin-'));
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function write(rel: string, content: string): Promise<void> {
  const full = path.join(tmp, rel);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, content, 'utf-8');
}

async function fns(rel: string): Promise<FunctionInfo[]> {
  const source = await fs.readFile(path.join(process.cwd(), rel), 'utf-8');
  const parsed = parseSource(rel, source);
  expect(parsed.ok).toBe(true);
  return parsed.functions;
}

describe('per-function fan-in (computed in buildCodeGraph)', () => {
  it('keeps fan metric computation out of the code graph orchestrator', async () => {
    const graphFns = await fns('src/core/codeGraph.ts');
    expect(graphFns.some((fn) => fn.name === 'computeFanIn')).toBe(false);
    expect(graphFns.some((fn) => fn.name === 'computeFanOut')).toBe(false);

    const fanFns = await fns('src/core/codeGraphFanMetrics.ts');
    const computeFanIn = fanFns.find((fn) => fn.name === 'computeFanIn');
    const computeFanOut = fanFns.find((fn) => fn.name === 'computeFanOut');
    const applyFanIn = fanFns.find((fn) => fn.name === 'applyFanIn');
    const countInternalFanOut = fanFns.find((fn) => fn.name === 'countInternalFanOut');

    expect(computeFanIn).toBeDefined();
    expect(computeFanIn!.cyclomaticComplexity).toBeLessThanOrEqual(3);
    expect(computeFanOut).toBeDefined();
    expect(computeFanOut!.cyclomaticComplexity).toBeLessThanOrEqual(3);
    expect(applyFanIn).toBeDefined();
    expect(applyFanIn!.cyclomaticComplexity).toBeLessThanOrEqual(5);
    expect(countInternalFanOut).toBeDefined();
    expect(countInternalFanOut!.cyclomaticComplexity).toBeLessThanOrEqual(5);
  });

  it('counts other files that call a function by name', async () => {
    // a defines foo, bar. b calls foo. c calls foo and bar.
    await write('src/a.ts', `export function foo() {}\nexport function bar() {}\n`);
    await write('src/b.ts', `import { foo } from './a.js';\nfoo();\n`);
    await write('src/c.ts', `import { foo, bar } from './a.js';\nfoo(); bar();\n`);
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const a = graph.files.get('src/a.ts');
    expect(a).toBeDefined();
    const foo = a!.functions!.find((f) => f.name === 'foo');
    const bar = a!.functions!.find((f) => f.name === 'bar');
    expect(foo?.fanIn).toBe(2); // b + c
    expect(bar?.fanIn).toBe(1); // c
  });

  it('does not count a self-call from within the defining file', async () => {
    await write('src/a.ts', `export function foo() { foo(); /* recursive self-call */ }\n`);
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const foo = graph.files.get('src/a.ts')!.functions!.find((f) => f.name === 'foo');
    expect(foo?.fanIn).toBe(0);
  });

  it('uses the bare name for class methods (Class.method matches bare callSite)', async () => {
    await write('src/a.ts', `export class A {\n  m() { return 1; }\n}\n`);
    await write('src/b.ts', `import { A } from './a.js';\nconst a = new A();\na.m();\n`);
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const m = graph.files.get('src/a.ts')!.functions!.find((f) => f.name === 'A.m');
    expect(m?.fanIn).toBe(1);
  });

  it('returns 0 for never-called functions', async () => {
    await write('src/a.ts', `export function alone() {}\n`);
    const scan = await scanRepository(tmp);
    const graph = await buildCodeGraph(tmp, scan.files);
    const alone = graph.files.get('src/a.ts')!.functions!.find((f) => f.name === 'alone');
    expect(alone?.fanIn).toBe(0);
  });
});
