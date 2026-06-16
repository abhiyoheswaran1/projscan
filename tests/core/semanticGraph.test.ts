import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { buildSemanticGraph } from '../../src/core/semanticGraph.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-semantic-graph-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture' }));
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function buildFixtureGraph() {
  const scan = await scanRepository(tmp);
  return await buildCodeGraph(tmp, scan.files);
}

describe('buildSemanticGraph', () => {
  it('projects the code graph into the stable v3 semantic graph contract', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'source.ts'),
      `export function readInput() {
  return process.env.CMD;
}
`,
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'sink.ts'),
      `import { exec } from 'child_process';

export function run(cmd: string | undefined) {
  exec(cmd ?? 'echo ok');
}
`,
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'app.ts'),
      `import { readInput } from './source.js';
import { run } from './sink.js';

export function handler() {
  const cmd = readInput();
  return run(cmd);
}
`,
    );

    const graph = await buildFixtureGraph();
    const report = buildSemanticGraph(graph);

    expect(report.schemaVersion).toBe(3);
    expect(report.nodes.some((node) => node.id === 'file:src/app.ts')).toBe(true);
    expect(report.nodes.some((node) => node.kind === 'function' && node.label === 'handler')).toBe(
      true,
    );
    expect(
      report.edges.some((edge) => edge.kind === 'defines' && edge.from === 'file:src/app.ts'),
    ).toBe(true);
    expect(report.edges.some((edge) => edge.kind === 'calls' && edge.label === 'run')).toBe(true);
    expect(report.metrics.totalFiles).toBe(3);
    expect(report.metrics.totalFunctions).toBeGreaterThanOrEqual(3);
    expect(report.truncated).toBe(false);
  });
});
