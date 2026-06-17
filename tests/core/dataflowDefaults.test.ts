import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { computeDataflow } from '../../src/core/dataflow.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-dataflow-defaults-'));
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

describe('computeDataflow default risk filters', () => {
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

    expect(
      report.risks.find((risk) => risk.source === 'env' && risk.sink === 'spawn'),
    ).toBeUndefined();
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
