import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { computeDataflow } from '../../src/core/dataflow.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-dataflow-'));
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

describe('computeDataflow', () => {
  it('does not join generic parse/exec names across unrelated files', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'config.ts'),
      `import { parse } from './version.js';

export function safeParse(raw: string) {
  return parse(raw);
}
`,
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'version.ts'),
      `const RE = /^v?(\d+)\.(\d+)\.(\d+)$/;

export function parse(version: string) {
  return RE.exec(version);
}
`,
    );
    await fs.mkdir(path.join(tmp, 'scripts'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'scripts', 'smoke.mjs'),
      `export function exec(command) {
  return process.env.PATH ? command : '';
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.available).toBe(true);
    expect(
      report.risks.find(
        (risk) =>
          risk.kind === 'bridge' &&
          risk.bridgeFn === 'safeParse' &&
          risk.sourceFn === 'exec' &&
          risk.sinkFn === 'parse',
      ),
    ).toBeUndefined();
  });
});
