import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { computeDataflow } from '../../src/core/dataflow.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-dataflow-framework-'));
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

describe('computeDataflow Koa framework request sources', () => {
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

  it('treats Koa request URL and path aliases as framework sources without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'koa-url.ts'),
      `import Koa from 'koa';
import Router from '@koa/router';

const app = new Koa();
const router = new Router();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.use((ctx) => {
  const url = ctx.url;
  return db.query(String(url));
});

router.get('/original', (context) => {
  const original = context.originalUrl;
  return db.query(String(original));
});

router.get('/path', (ctx) => {
  const path = ctx.path;
  return db.query(String(path));
});

router.get('/request-url', (context) => {
  const requestUrl = context.request.url;
  return db.query(String(requestUrl));
});

router.get('/request-original', (context) => {
  const requestOriginal = context.request.originalUrl;
  return db.query(String(requestOriginal));
});

router.get('/request-path', (ctx) => {
  const requestPath = ctx.request.path;
  return db.query(String(requestPath));
});

export function helper(ctx: { url: string, originalUrl: string, path: string, request: { url: string, originalUrl: string, path: string } }) {
  return cache.query(ctx.url + ctx.originalUrl + ctx.path + ctx.request.url + ctx.request.originalUrl + ctx.request.path);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const koaRisks = report.risks.filter((risk) => risk.files.includes('src/koa-url.ts'));

    expect(koaRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'koa.ctx.url', sink: 'query' }),
        expect.objectContaining({ source: 'koa.ctx.originalUrl', sink: 'query' }),
        expect.objectContaining({ source: 'koa.ctx.path', sink: 'query' }),
        expect.objectContaining({ source: 'koa.ctx.request.url', sink: 'query' }),
        expect.objectContaining({ source: 'koa.ctx.request.originalUrl', sink: 'query' }),
        expect.objectContaining({ source: 'koa.ctx.request.path', sink: 'query' }),
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
});
