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
    const bridge = report.risks.find((risk) => risk.kind === 'bridge' && risk.bridgeFn === 'bridge');
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

    const verbose = computeDataflow(graph, { sources: [], sinks: [] }, { includeBroadFileIo: true });
    expect(
      verbose.risks.some(
        (risk) => risk.source === 'readFile' && risk.sink === 'writeFile' && risk.sourceFn === 'rewrite',
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


  it('treats Next route request.json as a framework request source', async () => {
    await fs.mkdir(path.join(tmp, 'app', 'api', 'search'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'app', 'api', 'search', 'route.ts'),
      `declare const db: { query(sql: string): unknown };

export async function POST(request: Request) {
  const body = await request.json();
  return db.query(body.sql);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(
      report.risks.some(
        (risk) =>
          risk.sourceFn === 'POST' &&
          risk.sinkFn === 'POST' &&
          risk.source === 'request.json' &&
          risk.sink === 'query',
      ),
    ).toBe(true);
  });

  it('treats Next route request.formData request.text and request.arrayBuffer as framework request sources', async () => {
    await fs.mkdir(path.join(tmp, 'app', 'api', 'upload'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'app', 'api', 'upload', 'route.ts'),
      `declare const db: { query(sql: string): unknown };

export async function POST(request: Request) {
  const form = await request.formData();
  return db.query(String(form.get('sql')));
}

export async function PUT(request: Request) {
  const raw = await request.text();
  return db.query(raw);
}

export async function PATCH(request: Request) {
  const bytes = await request.arrayBuffer();
  return db.query(String(bytes.byteLength));
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceFn: 'POST', source: 'request.formData', sink: 'query' }),
        expect.objectContaining({ sourceFn: 'PUT', source: 'request.text', sink: 'query' }),
        expect.objectContaining({ sourceFn: 'PATCH', source: 'request.arrayBuffer', sink: 'query' }),
      ]),
    );
  });

  it('treats Hono route context request JSON as a framework request source', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'hono.ts'),
      `import { Hono } from 'hono';

declare const db: { query(sql: string): unknown };
const app = new Hono();

app.post('/search', async (c) => {
  const body = await c.req.json();
  return db.query(body.sql);
});
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(
      report.risks.some(
        (risk) =>
          risk.source === 'hono.req.json' &&
          risk.sink === 'query' &&
          risk.files.includes('src/hono.ts'),
      ),
    ).toBe(true);
  });

  it('does not treat ordinary Hono-shaped helpers as route request sources', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'hono-helper.ts'),
      `declare const db: { query(sql: string): unknown };

export async function helper(c: { req: { json(): Promise<{ sql: string }> } }) {
  const body = await c.req.json();
  return db.query(body.sql);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks.find((risk) => risk.source === 'hono.req.json')).toBeUndefined();
    expect(report.risks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('does not treat ordinary req-shaped helpers as Express request sources', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'helpers.ts'),
      `const db = { query(sql: string) { return sql; } };

export function saveSearch(req: { body: { sql: string } }) {
  return db.query(req.body.sql);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks.find((risk) => risk.source === 'express.req.body')).toBeUndefined();
    expect(report.risks.find((risk) => risk.sourceFn === 'saveSearch')).toBeUndefined();
  });

  it('does not let DB imports make cache query helpers look like DB sinks', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'cache.ts'),
      `import { Pool } from 'pg';

const cache = { query(key: string) { return key; } };
const pool = new Pool();

export function searchCache() {
  const key = process.env.CACHE_KEY;
  return cache.query(key ?? 'fallback');
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks.find((risk) => risk.sourceFn === 'searchCache' && risk.sink === 'query')).toBeUndefined();
  });

  it('keeps imported database query helpers as default sinks', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'db.ts'),
      'export function query(sql: string) { return sql; }\n',
    );
    await fs.mkdir(path.join(tmp, 'app', 'api', 'search'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'app', 'api', 'search', 'route.ts'),
      `import { query } from '../../../src/db';

export async function POST(request: Request) {
  const body = await request.json();
  return query(body.sql);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(
      report.risks.some((risk) => risk.source === 'request.json' && risk.sink === 'query' && risk.sourceFn === 'POST'),
    ).toBe(true);
  });

  it('keeps destructured database query aliases as default sinks', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'server.ts'),
      `import express from 'express';

const app = express();
const pool = { query(sql: string) { return sql; } };

app.post('/users', (req, res) => {
  const { query } = pool;
  const sql = req.body.sql;
  query(sql);
  res.json({ ok: true });
});
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(
      report.risks.some((risk) => risk.source === 'express.req.body' && risk.sink === 'query'),
    ).toBe(true);
  });

  it('detects Express request body into a database query without flagging non-database query helpers', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'server.ts'),
      `import express from 'express';

const app = express();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.post('/users', (req, res) => {
  const sql = req.body.sql;
  db.query(sql);
  res.json({ ok: true });
});

export function searchCache(req: { body: { key: string } }) {
  return cache.query(req.body.key);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(
      report.risks.some(
        (risk) => risk.source === 'express.req.body' && risk.sink === 'query' && risk.files.includes('src/server.ts'),
      ),
    ).toBe(true);
    expect(report.risks.find((risk) => risk.sourceFn === 'searchCache' && risk.sink === 'query')).toBeUndefined();
  });

  it('does not treat route response helpers as request body sources', async () => {
    await fs.mkdir(path.join(tmp, 'app', 'api', 'search'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'app', 'api', 'search', 'route.ts'),
      `declare const db: { query(sql: string): unknown };

export async function POST() {
  const response = Response.json({ ok: true });
  db.query('select 1');
  return response;
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(
      report.risks.find(
        (risk) =>
          risk.sourceFn === 'POST' &&
          risk.source === 'request.json' &&
          risk.sink === 'query',
      ),
    ).toBeUndefined();
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

    const withGenerated = computeDataflow(graph, { sources: [], sinks: [] }, { includeGenerated: true });
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
