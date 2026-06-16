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
        expect.objectContaining({
          sourceFn: 'PATCH',
          source: 'request.arrayBuffer',
          sink: 'query',
        }),
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

  it('treats Hono validated request data as a framework request source without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'hono-valid.ts'),
      `import { Hono } from 'hono';

declare const db: { query(sql: string): unknown };
declare const cache: { query(key: string): unknown };
const app = new Hono();

app.post('/search', (c) => {
  const body = c.req.valid('json') as { sql: string };
  return db.query(body.sql);
});

export function helper(c: { req: { valid(kind: string): { key: string } } }) {
  const body = c.req.valid('json');
  return cache.query(body.key);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const honoRisks = report.risks.filter((risk) => risk.files.includes('src/hono-valid.ts'));

    expect(honoRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'hono.req.valid', sink: 'query' }),
      ]),
    );
    expect(honoRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
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

    expect(
      report.risks.find((risk) => risk.sourceFn === 'searchCache' && risk.sink === 'query'),
    ).toBeUndefined();
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
      report.risks.some(
        (risk) =>
          risk.source === 'request.json' && risk.sink === 'query' && risk.sourceFn === 'POST',
      ),
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
        (risk) =>
          risk.source === 'express.req.body' &&
          risk.sink === 'query' &&
          risk.files.includes('src/server.ts'),
      ),
    ).toBe(true);
    expect(
      report.risks.find((risk) => risk.sourceFn === 'searchCache' && risk.sink === 'query'),
    ).toBeUndefined();
  });

  it('treats Express header accessor calls as framework request sources without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'express-header-get.ts'),
      `import express from 'express';

const app = express();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.get('/get', (req) => {
  const auth = req.get('authorization');
  return db.query(String(auth));
});

app.post('/header', (request) => {
  const tenant = request.header('x-tenant');
  return db.query(String(tenant));
});

export function helper(req: { get(name: string): string }) {
  return cache.query(req.get('x-cache-key'));
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const expressRisks = report.risks.filter((risk) =>
      risk.files.includes('src/express-header-get.ts'),
    );

    expect(expressRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'express.req.get', sink: 'query' }),
        expect.objectContaining({ source: 'express.req.header', sink: 'query' }),
      ]),
    );
    expect(expressRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('treats Express param accessor calls as framework request sources without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'express-param.ts'),
      `import express from 'express';

const app = express();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.get('/users/:id', (req) => {
  const id = req.param('id');
  return db.query(String(id));
});

export function helper(req: { param(name: string): string }) {
  return cache.query(req.param('cache-key'));
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const expressRisks = report.risks.filter((risk) => risk.files.includes('src/express-param.ts'));

    expect(expressRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'express.req.param', sink: 'query' }),
      ]),
    );
    expect(expressRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('treats Express request IP as a framework source without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'express-ip.ts'),
      `import express from 'express';

const app = express();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.get('/by-ip', (req) => {
  const ip = req.ip;
  return db.query(String(ip));
});

export function helper(req: { ip: string }) {
  return cache.query(req.ip);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const expressRisks = report.risks.filter((risk) => risk.files.includes('src/express-ip.ts'));

    expect(expressRisks).toEqual(
      expect.arrayContaining([expect.objectContaining({ source: 'express.req.ip', sink: 'query' })]),
    );
    expect(expressRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('treats Fastify request fields as framework sources without flagging lookalike helpers', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'fastify.ts'),
      `import Fastify from 'fastify';

const app = Fastify();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.post('/users', async (request, reply) => {
  const body = request.body as { sql: string };
  return db.query(body.sql);
});

export function helper(request: { body: { key: string } }) {
  return cache.query(request.body.key);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(
      report.risks.some(
        (risk) =>
          risk.source === 'fastify.request.body' &&
          risk.sink === 'query' &&
          risk.files.includes('src/fastify.ts'),
      ),
    ).toBe(true);
    expect(report.risks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('treats qualified Fastify request fields as sources without local-variable lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'fastify-qualified.ts'),
      `import Fastify from 'fastify';

const app = Fastify();
const db = { query(sql: string) { return sql; } };

app.get('/query', async (request) => {
  const term = request.query.term;
  return db.query(String(term));
});

app.get('/params', async (request) => {
  const id = request.params.id;
  return db.query(String(id));
});

app.get('/headers', async (request) => {
  const auth = request.headers.authorization;
  return db.query(String(auth));
});

app.get('/cookies', async (request) => {
  const sid = request.cookies.sid;
  return db.query(String(sid));
});
`,
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'fastify-local-query.ts'),
      `import Fastify from 'fastify';

const app = Fastify();
const db = { query(sql: string) { return sql; } };

app.get('/local', async (request) => {
  const query = 'select 1';
  return db.query(query);
});
`,
    );

    const graph = await buildFixtureGraph();
    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const qualifiedRisks = report.risks.filter((risk) =>
      risk.files.includes('src/fastify-qualified.ts'),
    );
    const localRisks = report.risks.filter((risk) =>
      risk.files.includes('src/fastify-local-query.ts'),
    );

    expect(qualifiedRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'fastify.request.query', sink: 'query' }),
        expect.objectContaining({ source: 'fastify.request.params', sink: 'query' }),
        expect.objectContaining({ source: 'fastify.request.headers', sink: 'query' }),
        expect.objectContaining({ source: 'fastify.request.cookies', sink: 'query' }),
      ]),
    );
    expect(localRisks.find((risk) => risk.source === 'fastify.request.query')).toBeUndefined();
  });

  it('treats Fastify route option handlers as framework request sources', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'fastify-route.ts'),
      `import Fastify from 'fastify';

const app = Fastify();
const db = { query(sql: string) { return sql; } };

app.route({
  method: 'POST',
  url: '/search',
  handler: async (request) => {
    const body = request.body as { sql: string };
    return db.query(body.sql);
  },
});
`,
    );

    const graph = await buildFixtureGraph();
    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source: 'fastify.request.body',
          sink: 'query',
          files: expect.arrayContaining(['src/fastify-route.ts']),
        }),
      ]),
    );
  });

  it('treats Fastify request IP as a framework source without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'fastify-ip.ts'),
      `import Fastify from 'fastify';

const app = Fastify();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.get('/by-ip', async (request) => {
  const ip = request.ip;
  return db.query(String(ip));
});

export function helper(request: { ip: string }) {
  return cache.query(request.ip);
}
`,
    );

    const graph = await buildFixtureGraph();
    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const fastifyRisks = report.risks.filter((risk) => risk.files.includes('src/fastify-ip.ts'));

    expect(fastifyRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'fastify.request.ip', sink: 'query' }),
      ]),
    );
    expect(fastifyRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('treats Fastify raw request URL and headers as framework sources without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'fastify-raw.ts'),
      `import Fastify from 'fastify';

const app = Fastify();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.get('/raw-url', async (request) => {
  const url = request.raw.url;
  return db.query(String(url));
});

app.get('/raw-headers', async (request) => {
  const host = request.raw.headers.host;
  return db.query(String(host));
});

export function helper(request: { raw: { url?: string, headers: { host?: string } } }) {
  return cache.query(String(request.raw.url));
}
`,
    );

    const graph = await buildFixtureGraph();
    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const fastifyRisks = report.risks.filter((risk) => risk.files.includes('src/fastify-raw.ts'));

    expect(fastifyRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'fastify.request.raw.url', sink: 'query' }),
        expect.objectContaining({ source: 'fastify.request.raw.headers', sink: 'query' }),
      ]),
    );
    expect(fastifyRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('treats Koa request fields as framework sources without flagging lookalike helpers', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'koa.ts'),
      `import Koa from 'koa';

const app = new Koa();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.use(async (ctx) => {
  const body = ctx.request.body as { sql: string };
  return db.query(body.sql);
});

export function helper(ctx: { request: { body: { key: string } } }) {
  return cache.query(ctx.request.body.key);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(
      report.risks.some(
        (risk) =>
          risk.source === 'koa.ctx.request.body' &&
          risk.sink === 'query' &&
          risk.files.includes('src/koa.ts'),
      ),
    ).toBe(true);
    expect(report.risks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('treats Koa query params and headers as framework request sources', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'koa-router.ts'),
      `import Koa from 'koa';
import Router from '@koa/router';

const app = new Koa();
const router = new Router();
const db = { query(sql: string) { return sql; } };

app.use((ctx) => {
  const term = ctx.query.term;
  return db.query(String(term));
});

router.get('/users/:id', (ctx) => {
  const id = ctx.params.id;
  return db.query(String(id));
});

router.post('/request-query', (ctx) => {
  const filter = ctx.request.query.filter;
  return db.query(String(filter));
});

router.put('/headers', (ctx) => {
  const auth = ctx.headers.authorization;
  return db.query(String(auth));
});

router.patch('/request-headers', (ctx) => {
  const requestAuth = ctx.request.headers.authorization;
  return db.query(String(requestAuth));
});
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const koaRisks = report.risks.filter((risk) => risk.files.includes('src/koa-router.ts'));

    expect(koaRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'koa.ctx.query', sink: 'query' }),
        expect.objectContaining({ source: 'koa.ctx.params', sink: 'query' }),
        expect.objectContaining({ source: 'koa.ctx.request.query', sink: 'query' }),
        expect.objectContaining({ source: 'koa.ctx.headers', sink: 'query' }),
        expect.objectContaining({ source: 'koa.ctx.request.headers', sink: 'query' }),
      ]),
    );
  });

  it('treats Koa header accessor calls as framework request sources without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'koa-header-get.ts'),
      `import Koa from 'koa';
import Router from '@koa/router';

const app = new Koa();
const router = new Router();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.use((ctx) => {
  const tenant = ctx.get('x-tenant');
  return db.query(String(tenant));
});

router.get('/request-get', (ctx) => {
  const auth = ctx.request.get('authorization');
  return db.query(String(auth));
});

export function helper(ctx: { get(name: string): string }) {
  return cache.query(ctx.get('x-cache-key'));
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const koaRisks = report.risks.filter((risk) => risk.files.includes('src/koa-header-get.ts'));

    expect(koaRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'koa.ctx.get', sink: 'query' }),
        expect.objectContaining({ source: 'koa.ctx.request.get', sink: 'query' }),
      ]),
    );
    expect(koaRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('treats Koa cookie accessor calls as framework request sources without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'koa-cookies.ts'),
      `import Koa from 'koa';
import Router from '@koa/router';

const app = new Koa();
const router = new Router();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.use((ctx) => {
  const sid = ctx.cookies.get('sid');
  return db.query(String(sid));
});

router.get('/cookie', (context) => {
  const tenant = context.cookies.get('tenant');
  return db.query(String(tenant));
});

export function helper(ctx: { cookies: { get(name: string): string } }) {
  return cache.query(ctx.cookies.get('x-cache-key'));
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const koaRisks = report.risks.filter((risk) => risk.files.includes('src/koa-cookies.ts'));

    expect(koaRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'koa.ctx.cookies.get', sink: 'query' }),
      ]),
    );
    expect(koaRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('treats Koa request IP fields as framework sources without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'koa-ip.ts'),
      `import Koa from 'koa';
import Router from '@koa/router';

const app = new Koa();
const router = new Router();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.use((ctx) => {
  const ip = ctx.ip;
  return db.query(String(ip));
});

router.get('/request-ip', (context) => {
  const requestIp = context.request.ip;
  return db.query(String(requestIp));
});

export function helper(ctx: { ip: string, request: { ip: string } }) {
  return cache.query(ctx.ip + ctx.request.ip);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const koaRisks = report.risks.filter((risk) => risk.files.includes('src/koa-ip.ts'));

    expect(koaRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'koa.ctx.ip', sink: 'query' }),
        expect.objectContaining({ source: 'koa.ctx.request.ip', sink: 'query' }),
      ]),
    );
    expect(koaRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('does not treat Koa response-body writes as request body sources', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'koa-response.ts'),
      `import Koa from 'koa';

const app = new Koa();
const db = { query(sql: string) { return sql; } };

app.use((ctx) => {
  ctx.body = { ok: true };
  return db.query('select 1');
});
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(
      report.risks.find(
        (risk) =>
          risk.sourceFn.includes('app.use') &&
          risk.source === 'koa.ctx.request.body' &&
          risk.sink === 'query',
      ),
    ).toBeUndefined();
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
          risk.sourceFn === 'POST' && risk.source === 'request.json' && risk.sink === 'query',
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
