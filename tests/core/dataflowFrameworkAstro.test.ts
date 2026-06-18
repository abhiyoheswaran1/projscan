import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { computeDataflow } from '../../src/core/dataflow.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-dataflow-astro-'));
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

describe('computeDataflow Astro endpoint request sources', () => {
  it('treats Astro endpoint request and params usage as framework sources', async () => {
    await fs.mkdir(path.join(tmp, 'src', 'pages', 'api', '[id]'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'src', 'pages', 'api', '[id]', 'search.ts'),
      `import type { APIRoute } from 'astro';
declare const db: { query(sql: string): unknown };

export const POST: APIRoute = async ({ request }) => {
  const body = await request.json();
  return db.query(body.sql);
};

export function GET({ request }) {
  return db.query(request.url);
}

export function PUT({ request }) {
  const tenant = request.headers.get('x-tenant');
  return db.query(String(tenant));
}

export function DELETE({ params }) {
  return db.query(String(params.id));
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const astroRisks = report.risks.filter((risk) =>
      risk.files.includes('src/pages/api/[id]/search.ts'),
    );

    expect(astroRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceFn: 'POST', source: 'astro.request.json' }),
        expect.objectContaining({ sourceFn: 'GET', source: 'astro.request.url' }),
        expect.objectContaining({ sourceFn: 'PUT', source: 'astro.request.headers' }),
        expect.objectContaining({ sourceFn: 'DELETE', source: 'astro.params' }),
      ]),
    );
  });

  it('does not treat non-endpoint helpers as Astro request sources', async () => {
    await fs.mkdir(path.join(tmp, 'src', 'lib'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'src', 'lib', 'helpers.ts'),
      `declare const db: { query(sql: string): unknown };

export async function POST({ request, params }) {
  const body = await request.json();
  return db.query(body.sql + params.id);
}
`,
    );
    await fs.mkdir(path.join(tmp, 'src', 'pages', 'api'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'src', 'pages', 'api', 'helpers.ts'),
      `declare const db: { query(sql: string): unknown };

export async function helper({ request, params }) {
  const body = await request.json();
  return db.query(body.sql + params.id);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks.find((risk) => risk.source?.startsWith('astro.'))).toBeUndefined();
    expect(report.risks.find((risk) => risk.sourceFn === 'POST')).toBeUndefined();
    expect(report.risks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });

  it('treats Astro APIContext request and params usage as framework sources', async () => {
    await fs.mkdir(path.join(tmp, 'src', 'pages', 'api', 'context'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'src', 'pages', 'api', 'context', '[slug].ts'),
      `declare const db: { query(sql: string): unknown };

export async function PATCH(context) {
  const body = await context.request.text();
  return db.query(body);
}

export function GET(context) {
  return db.query(String(context.params.slug));
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const astroRisks = report.risks.filter((risk) =>
      risk.files.includes('src/pages/api/context/[slug].ts'),
    );

    expect(astroRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceFn: 'PATCH', source: 'astro.request.text' }),
        expect.objectContaining({ sourceFn: 'GET', source: 'astro.params' }),
      ]),
    );
  });
});
