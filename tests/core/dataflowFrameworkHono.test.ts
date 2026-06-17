import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { computeDataflow } from '../../src/core/dataflow.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-dataflow-hono-'));
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

describe('computeDataflow Hono framework request sources', () => {
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

  it('treats documented Hono body parsers and multi-query helpers as framework request sources without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'hono-body-query.ts'),
      `import { Hono } from 'hono';

declare const db: { query(sql: string): unknown };
declare const cache: { query(key: string): unknown };
const app = new Hono();

app.post('/form', async (c) => {
  const form = await c.req.formData();
  return db.query(String(form.get('sql')));
});

app.post('/bytes', async (ctx) => {
  const bytes = await ctx.req.arrayBuffer();
  return db.query(String(bytes.byteLength));
});

app.post('/blob', async (context) => {
  const blob = await context.req.blob();
  return db.query(String(blob.size));
});

app.get('/tags', (c) => {
  const tags = c.req.queries('tags');
  return db.query(String(tags?.join(',')));
});

export async function helper(c: { req: {
  formData(): Promise<FormData>,
  arrayBuffer(): Promise<ArrayBuffer>,
  blob(): Promise<Blob>,
  queries(name: string): string[] | undefined
} }) {
  const form = await c.req.formData();
  const tags = c.req.queries('tags');
  return cache.query(String(form.get('key')) + String(tags?.join(',')));
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const honoRisks = report.risks.filter((risk) =>
      risk.files.includes('src/hono-body-query.ts'),
    );

    expect(honoRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'hono.req.formData', sink: 'query' }),
        expect.objectContaining({ source: 'hono.req.arrayBuffer', sink: 'query' }),
        expect.objectContaining({ source: 'hono.req.blob', sink: 'query' }),
        expect.objectContaining({ source: 'hono.req.queries', sink: 'query' }),
      ]),
    );
    expect(honoRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
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
