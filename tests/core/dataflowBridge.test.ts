import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { computeDataflow } from '../../src/core/dataflow.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { computeTaint } from '../../src/core/taint.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-dataflow-bridge-'));
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

describe('computeDataflow bridge risks', () => {
  it('detects bridge functions that source and sink through callees', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'bridge.ts'),
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
    const graph = await buildFixtureGraph();

    expect(computeTaint(graph, { sources: [], sinks: [] }).flowCount).toBe(0);

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.available).toBe(true);
    expect(report.risks.some((risk) => risk.kind === 'bridge' && risk.bridgeFn === 'bridge')).toBe(
      true,
    );
    const bridge = report.risks.find(
      (risk) => risk.kind === 'bridge' && risk.bridgeFn === 'bridge',
    );
    expect(bridge).toMatchObject({
      sourceFn: 'readSecret',
      sinkFn: 'runDangerous',
      source: 'env',
      sink: 'exec',
      severity: 'error',
    });
    expect(bridge?.files).toEqual(['src/bridge.ts']);
  });
});
