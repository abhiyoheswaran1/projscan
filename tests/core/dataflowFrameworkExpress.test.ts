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

describe('computeDataflow Express framework request sources', () => {
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

  it('treats Express originalUrl as a request source without local-variable lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'express-original-url.ts'),
      `import express from 'express';

const app = express();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.get('/lookup', (req) => {
  const raw = req.originalUrl;
  return db.query(raw);
});

app.get('/safe', (req) => {
  const originalUrl = 'select 1';
  return db.query(originalUrl);
});

export function helper(req: { originalUrl: string }) {
  return cache.query(req.originalUrl);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const expressRisks = report.risks.filter((risk) =>
      risk.files.includes('src/express-original-url.ts'),
    );
    const originalUrlRisks = expressRisks.filter(
      (risk) => risk.source === 'express.req.originalUrl',
    );

    expect(originalUrlRisks).toEqual([
      expect.objectContaining({ source: 'express.req.originalUrl', sink: 'query' }),
    ]);
    expect(originalUrlRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('treats Express request URL and path fields as sources without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'express-url-path.ts'),
      `import express from 'express';

const app = express();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.get('/lookup', (req) => {
  const raw = req.url;
  return db.query(raw);
});

app.get('/path', (request) => {
  const requestPath = request.path;
  return db.query(String(requestPath));
});

export function helper(req: { url: string, path: string }) {
  return cache.query(req.url + req.path);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const expressRisks = report.risks.filter((risk) =>
      risk.files.includes('src/express-url-path.ts'),
    );

    expect(expressRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'express.req.url', sink: 'query' }),
        expect.objectContaining({ source: 'express.req.path', sink: 'query' }),
      ]),
    );
    expect(expressRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

});
