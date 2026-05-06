import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { computeTaint } from '../../src/core/taint.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-taint-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 't' }));
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function buildGraph() {
  const scan = await scanRepository(tmp);
  return await buildCodeGraph(tmp, scan.files);
}

describe('computeTaint', () => {
  it('detects same-function flow (source + sink in one body)', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'a.ts'),
      `import { exec } from 'child_process';

export function run() {
  const cmd = process.env.MY_CMD;
  exec(cmd ?? 'echo hi');
}
`,
    );
    const graph = await buildGraph();
    const report = computeTaint(graph, { sources: [], sinks: [] });
    expect(report.available).toBe(true);
    expect(report.flowCount).toBeGreaterThan(0);
    const flow = report.flows.find((f) => f.sinkFn === 'run');
    expect(flow).toBeDefined();
    expect(flow!.sourceFn).toBe('run');
    expect(flow!.path).toEqual(['run']);
  });

  it('detects multi-hop flow (source → middleware → sink)', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'b.ts'),
      `import { spawn } from 'child_process';

export function reader() {
  const v = process.env.X;
  return middle(v);
}

export function middle(v: string | undefined) {
  return runIt(v);
}

export function runIt(v: string | undefined) {
  spawn(v ?? 'echo');
}
`,
    );
    const graph = await buildGraph();
    const report = computeTaint(graph, { sources: [], sinks: [] });
    const flow = report.flows.find((f) => f.sourceFn === 'reader');
    expect(flow).toBeDefined();
    expect(flow!.sinkFn).toBe('runIt');
    expect(flow!.path).toEqual(['reader', 'middle', 'runIt']);
  });

  it('reports no flows when source and sink are unconnected', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'c.ts'),
      `export function reader() {
  return process.env.X;
}

export function writer() {
  // unrelated
  return 1;
}
`,
    );
    const graph = await buildGraph();
    const report = computeTaint(graph, { sources: [], sinks: [] });
    expect(report.flowCount).toBe(0);
  });

  it('honors user-declared additional sources', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'd.ts'),
      `import { spawn } from 'child_process';

export function readSecret() {
  const x = customSecretReader();
  spawn(x);
}

export function customSecretReader() { return 'leak'; }
`,
    );
    const graph = await buildGraph();
    // Without declaring customSecretReader as a source, no flow.
    const empty = computeTaint(graph, { sources: [], sinks: [] });
    expect(empty.flowCount).toBe(0);
    // With it declared, flow surfaces.
    const declared = computeTaint(graph, {
      sources: ['customSecretReader'],
      sinks: [],
    });
    expect(declared.flowCount).toBeGreaterThan(0);
  });

  it('honors user-declared additional sinks', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'e.ts'),
      `export function leakIt() {
  const v = process.env.X;
  customDangerousSink(v);
}

export function customDangerousSink(v: string | undefined) { return v; }
`,
    );
    const graph = await buildGraph();
    const report = computeTaint(graph, {
      sources: [],
      sinks: ['customDangerousSink'],
    });
    expect(report.flowCount).toBeGreaterThan(0);
  });

  it('returns available:false when no functions have callSites', async () => {
    // Empty-ish project with no .ts files in /src.
    const graph = await buildGraph();
    const report = computeTaint(graph, { sources: [], sinks: [] });
    expect(report.available).toBe(false);
    expect(report.reason).toMatch(/callSites/);
  });

  it('caps depth at MAX_DEPTH (long-chain doesn\'t blow up)', async () => {
    // 12-level call chain. MAX_DEPTH is 8, so the deepest sink at level 12
    // should NOT be reported.
    let src = `import { exec } from 'child_process';\n\n`;
    for (let i = 0; i < 12; i++) {
      const calls = i === 11 ? `exec('x');` : `f${i + 1}();`;
      src += `export function f${i}() {${i === 0 ? ' const v = process.env.X;' : ''} ${calls} }\n`;
    }
    await fs.writeFile(path.join(tmp, 'src', 'chain.ts'), src);
    const graph = await buildGraph();
    const report = computeTaint(graph, { sources: [], sinks: [] });
    // No flow should reach the depth-12 sink — depth cap stops at 8.
    const reaching = report.flows.find((f) => f.sourceFn === 'f0');
    expect(reaching).toBeUndefined();
  });
});
