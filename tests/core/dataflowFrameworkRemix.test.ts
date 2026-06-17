import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { computeDataflow } from '../../src/core/dataflow.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-dataflow-remix-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 'fixture' }));
  await fs.mkdir(path.join(tmp, 'app', 'routes'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function buildFixtureGraph() {
  const scan = await scanRepository(tmp);
  return await buildCodeGraph(tmp, scan.files);
}

describe('computeDataflow Remix framework request sources', () => {
  it('treats Remix action request body readers as framework request sources', async () => {
    await fs.writeFile(
      path.join(tmp, 'app', 'routes', 'search.tsx'),
      `declare const db: { query(sql: string): unknown };

export async function action({ request }: { request: Request }) {
  const body = await request.json();
  return db.query(body.sql);
}

export async function helper({ request }: { request: Request }) {
  const body = await request.json();
  return db.query(body.sql);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const remixRisks = report.risks.filter((risk) => risk.files.includes('app/routes/search.tsx'));

    expect(remixRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceFn: 'action',
          source: 'remix.request.json',
          sink: 'query',
        }),
      ]),
    );
    expect(remixRisks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('treats Remix request form text buffer url headers signal and params as route sources', async () => {
    await fs.writeFile(
      path.join(tmp, 'app', 'routes', 'account.$id.tsx'),
      `declare const db: { query(sql: string): unknown };

export async function action({ request }: { request: Request }) {
  const form = await request.formData();
  return db.query(String(form.get('sql')));
}

export async function loader({ params }: { params: { id: string } }) {
  return db.query(String(params.id));
}

export async function clientLoader({ request }: { request: Request }) {
  const tenant = request.headers.get('x-tenant');
  return db.query(String(tenant));
}

export async function clientAction({ request }: { request: Request }) {
  const url = request.url;
  return db.query(String(url));
}
`,
    );
    await fs.writeFile(
      path.join(tmp, 'app', 'routes', 'body.tsx'),
      `declare const db: { query(sql: string): unknown };

export async function action({ request }: { request: Request }) {
  const body = await request.text();
  return Boolean(db.query(body));
}

export async function loader({ request }: { request: Request }) {
  return db.query(String(request.signal.aborted));
}
`,
    );
    await fs.writeFile(
      path.join(tmp, 'app', 'routes', 'buffer.tsx'),
      `declare const db: { query(sql: string): unknown };

export async function action({ request }: { request: Request }) {
  const bytes = await request.arrayBuffer();
  return db.query(String(bytes.byteLength));
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const remixRisks = report.risks.filter((risk) => risk.source.startsWith('remix.'));

    expect(remixRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceFn: 'action', source: 'remix.request.formData' }),
        expect.objectContaining({ sourceFn: 'loader', source: 'remix.params' }),
        expect.objectContaining({ sourceFn: 'clientLoader', source: 'remix.request.headers' }),
        expect.objectContaining({ sourceFn: 'clientAction', source: 'remix.request.url' }),
        expect.objectContaining({ sourceFn: 'loader', source: 'remix.request.signal' }),
        expect.objectContaining({ sourceFn: 'action', source: 'remix.request.text' }),
        expect.objectContaining({ sourceFn: 'action', source: 'remix.request.arrayBuffer' }),
      ]),
    );
  });

  it('does not treat non-route Remix-shaped helpers as framework request sources', async () => {
    await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'src', 'action.ts'),
      `declare const db: { query(sql: string): unknown };

export async function action({ request, params }: { request: Request, params: { id: string } }) {
  const body = await request.json();
  return db.query(body.sql + params.id);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks.find((risk) => risk.source?.startsWith('remix.'))).toBeUndefined();
  });
});
