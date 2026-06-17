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

describe('computeDataflow Next and Hono framework request sources', () => {
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

  it('treats Next route request.url as a framework request source without flagging helpers', async () => {
    await fs.mkdir(path.join(tmp, 'app', 'api', 'lookup'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'app', 'api', 'lookup', 'route.ts'),
      `declare const db: { query(sql: string): unknown };

export async function GET(request: Request) {
  const href = request.url;
  return db.query(href);
}

export function helper(request: { url: string }) {
  return db.query(request.url);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceFn: 'GET', source: 'request.url', sink: 'query' }),
      ]),
    );
    expect(
      report.risks.find(
        (risk) => risk.sourceFn === 'helper' && risk.source === 'request.url',
      ),
    ).toBeUndefined();
  });

  it('treats Next route nextUrl search params as framework request sources without flagging helpers', async () => {
    await fs.mkdir(path.join(tmp, 'app', 'api', 'search-params'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'app', 'api', 'search-params', 'route.ts'),
      `declare const db: { query(sql: string): unknown };

export async function GET(request: Request & { nextUrl: URL }) {
  const term = request.nextUrl.searchParams.get('q');
  return db.query(String(term));
}

export function helper(request: { nextUrl: { searchParams: URLSearchParams } }) {
  return db.query(String(request.nextUrl.searchParams.get('q')));
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceFn: 'GET',
          source: 'request.nextUrl.searchParams',
          sink: 'query',
        }),
      ]),
    );
    expect(
      report.risks.find(
        (risk) => risk.sourceFn === 'helper' && risk.source === 'request.nextUrl.searchParams',
      ),
    ).toBeUndefined();
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

  it('treats Hono request URL and path properties as framework sources without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'hono-url.ts'),
      `import { Hono } from 'hono';

declare const db: { query(sql: string): unknown };
declare const cache: { query(key: string): unknown };
const app = new Hono();

app.get('/url', (c) => {
  const url = c.req.url;
  return db.query(String(url));
});

app.get('/path', (context) => {
  const path = context.req.path;
  return db.query(String(path));
});

export function helper(c: { req: { url: string, path: string } }) {
  return cache.query(c.req.url + c.req.path);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const honoRisks = report.risks.filter((risk) => risk.files.includes('src/hono-url.ts'));

    expect(honoRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'hono.req.url', sink: 'query' }),
        expect.objectContaining({ source: 'hono.req.path', sink: 'query' }),
      ]),
    );
    expect(honoRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

});
