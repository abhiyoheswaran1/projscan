import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { computeDataflow } from '../../src/core/dataflow.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-dataflow-sveltekit-'));
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

describe('computeDataflow SvelteKit framework request sources', () => {
  it('treats SvelteKit +server request event sources as framework sources', async () => {
    await fs.mkdir(path.join(tmp, 'src', 'routes', 'api', '[id]'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'src', 'routes', 'api', '[id]', '+server.ts'),
      `declare const db: { query(sql: string): unknown };

export async function POST({ request }) {
  const body = await request.json();
  return db.query(body.sql);
}

export async function GET({ params }) {
  return db.query(String(params.id));
}

export async function PUT({ url }) {
  const tenant = url.searchParams.get('tenant');
  return db.query(String(tenant));
}

export async function PATCH({ cookies }) {
  const sid = cookies.get('sid');
  return db.query(String(sid));
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const svelteRisks = report.risks.filter((risk) =>
      risk.files.includes('src/routes/api/[id]/+server.ts'),
    );

    expect(svelteRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceFn: 'POST', source: 'sveltekit.request.json' }),
        expect.objectContaining({ sourceFn: 'GET', source: 'sveltekit.params' }),
        expect.objectContaining({ sourceFn: 'PUT', source: 'sveltekit.url.searchParams' }),
        expect.objectContaining({ sourceFn: 'PATCH', source: 'sveltekit.cookies.get' }),
      ]),
    );
  });

  it('treats SvelteKit server load and hooks RequestEvent usage as framework sources', async () => {
    await fs.mkdir(path.join(tmp, 'src', 'routes', 'account'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'src', 'routes', 'account', '+page.server.ts'),
      `declare const db: { query(sql: string): unknown };

export async function load({ url }) {
  return db.query(url.pathname);
}
`,
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'hooks.server.ts'),
      `declare const db: { query(sql: string): unknown };

export async function handle({ event, resolve }) {
  const body = await event.request.text();
  db.query(body);
  return resolve(event);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceFn: 'load',
          source: 'sveltekit.url.pathname',
          files: expect.arrayContaining(['src/routes/account/+page.server.ts']),
        }),
        expect.objectContaining({
          sourceFn: 'handle',
          source: 'sveltekit.request.text',
          files: expect.arrayContaining(['src/hooks.server.ts']),
        }),
      ]),
    );
  });

  it('treats SvelteKit request.url usage as a framework source', async () => {
    await fs.mkdir(path.join(tmp, 'src', 'routes', 'api', 'search'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'src', 'routes', 'api', 'search', '+server.ts'),
      `declare const db: { query(sql: string): unknown };
export async function GET({ request }) { return db.query(request.url); }
`,
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'hooks.server.ts'),
      `declare const db: { query(sql: string): unknown };
export async function handle({ event, resolve }) {
  db.query(event.request.url);
  return resolve(event);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceFn: 'GET', source: 'sveltekit.request.url',
          files: expect.arrayContaining(['src/routes/api/search/+server.ts']),
        }),
        expect.objectContaining({
          sourceFn: 'handle', source: 'sveltekit.request.url',
          files: expect.arrayContaining(['src/hooks.server.ts']),
        }),
      ]),
    );
  });

  it('does not treat non-route helpers or response builders as SvelteKit request sources', async () => {
    await fs.mkdir(path.join(tmp, 'src', 'lib'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'src', 'lib', 'helpers.ts'),
      `declare const db: { query(sql: string): unknown };

export async function POST({ request, params, url, cookies }) {
  const body = await request.json();
  return db.query(body.sql + params.id + url.searchParams.get('q') + cookies.get('sid'));
}
`,
    );
    await fs.mkdir(path.join(tmp, 'src', 'routes', 'api', 'safe'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'src', 'routes', 'api', 'safe', '+server.ts'),
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

    expect(report.risks.find((risk) => risk.source?.startsWith('sveltekit.'))).toBeUndefined();
    expect(report.risks.find((risk) => risk.sourceFn === 'POST')).toBeUndefined();
  });
});
