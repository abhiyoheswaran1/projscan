import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { computeDataflow } from '../../src/core/dataflow.js';
import { computeTaint } from '../../src/core/taint.js';
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

  it('suppresses broad default file IO risks unless explicitly requested', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'cache.ts'),
      `import fs from 'node:fs/promises';

export async function rewrite() {
  const raw = await fs.readFile('input.txt', 'utf-8');
  await fs.writeFile('output.txt', raw, 'utf-8');
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    expect(report.risks).toEqual([]);

    const verbose = computeDataflow(
      graph,
      { sources: [], sinks: [] },
      { includeBroadFileIo: true },
    );
    expect(
      verbose.risks.some(
        (risk) =>
          risk.source === 'readFile' && risk.sink === 'writeFile' && risk.sourceFn === 'rewrite',
      ),
    ).toBe(true);
  });

  it('keeps default readFile flows into custom sinks visible without broad file IO opt-in', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'exfiltrate.ts'),
      `import fs from 'node:fs/promises';

declare function sendRemote(value: string): void;

export async function sendSecret() {
  const raw = await fs.readFile('secret.txt', 'utf-8');
  sendRemote(raw);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: ['sendRemote'] });

    expect(
      report.risks.some(
        (risk) =>
          risk.sourceFn === 'sendSecret' &&
          risk.sinkFn === 'sendSecret' &&
          risk.source === 'readFile' &&
          risk.sink === 'sendRemote',
      ),
    ).toBe(true);
  });

  it('suppresses generated-code risks by default with an explicit opt-in', async () => {
    await fs.mkdir(path.join(tmp, 'src', '__generated__'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'src', '__generated__', 'client.ts'),
      `import { exec } from 'node:child_process';

export function generatedClient() {
  const command = process.env.GENERATED_CMD;
  exec(command ?? 'echo generated');
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    expect(report.risks).toEqual([]);

    const withGenerated = computeDataflow(
      graph,
      { sources: [], sinks: [] },
      { includeGenerated: true },
    );
    expect(withGenerated.risks.some((risk) => risk.sourceFn === 'generatedClient')).toBe(true);
  });

  it('does not treat RegExp.exec as a child_process exec sink', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'regex.ts'),
      `export function parseVersion() {
  const raw = process.env.VERSION;
  return /^v?\\d+$/.exec(raw ?? '');
}
`,
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'shell.ts'),
      `import { exec } from 'node:child_process';

export function runShell() {
  const command = process.env.CMD;
  exec(command ?? 'echo ok');
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks.find((risk) => risk.sourceFn === 'parseVersion')).toBeUndefined();
    expect(
      report.risks.some(
        (risk) => risk.sourceFn === 'runShell' && risk.source === 'env' && risk.sink === 'exec',
      ),
    ).toBe(true);
  });

  it('does not treat child-process env passthrough as an env command flow', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'git.ts'),
      `import { spawn } from 'node:child_process';

export function log(rootPath: string) {
  spawn('git', ['log', '--oneline'], { cwd: rootPath, env: process.env });
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks.find((risk) => risk.source === 'env' && risk.sink === 'spawn')).toBeUndefined();
  });

  it('excludes test-file risks by default with an explicit opt-in', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'runner.test.ts'),
      `import { exec } from 'node:child_process';

export function testRunner() {
  const command = process.env.CMD;
  exec(command ?? 'echo ok');
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    expect(report.risks).toEqual([]);

    const withTests = computeDataflow(graph, { sources: [], sinks: [] }, { includeTests: true });
    expect(withTests.risks.some((risk) => risk.sourceFn === 'testRunner')).toBe(true);
  });
});
