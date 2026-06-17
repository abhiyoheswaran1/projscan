import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { computeDataflow } from '../../src/core/dataflow.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-dataflow-next-'));
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

describe('computeDataflow Next framework request sources', () => {
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

  it('treats Next route nextUrl pathname as a framework request source without flagging helpers', async () => {
    await fs.mkdir(path.join(tmp, 'app', 'api', 'pathname'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'app', 'api', 'pathname', 'route.ts'),
      `declare const db: { query(sql: string): unknown };

export async function GET(request: Request & { nextUrl: URL }) {
  const pathname = request.nextUrl.pathname;
  return db.query(String(pathname));
}

export function helper(request: { nextUrl: { pathname: string } }) {
  return db.query(request.nextUrl.pathname);
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          sourceFn: 'GET',
          source: 'request.nextUrl.pathname',
          sink: 'query',
        }),
      ]),
    );
    expect(
      report.risks.find(
        (risk) => risk.sourceFn === 'helper' && risk.source === 'request.nextUrl.pathname',
      ),
    ).toBeUndefined();
  });

  it('treats Next route request headers and cookies as framework request sources without flagging helpers', async () => {
    await fs.mkdir(path.join(tmp, 'app', 'api', 'identity'), { recursive: true });
    await fs.writeFile(
      path.join(tmp, 'app', 'api', 'identity', 'route.ts'),
      `import type { NextRequest } from 'next/server';

declare const db: { query(sql: string): unknown };
declare const cache: { query(key: string): unknown };

export async function GET(request: NextRequest) {
  const tenant = request.headers.get('x-tenant');
  return db.query(String(tenant));
}

export async function POST(request: NextRequest) {
  const headers = request.headers;
  return db.query(String(headers.get('authorization')));
}

export async function PUT(request: NextRequest) {
  const session = request.cookies.get('session');
  return db.query(String(session?.value));
}

export async function PATCH(request: NextRequest) {
  const cohorts = request.cookies.getAll('cohort');
  return db.query(String(cohorts.map((cookie) => cookie.value).join(',')));
}

export function helper(request: {
  headers: Headers,
  cookies: { get(name: string): { value: string } | undefined, getAll(name: string): Array<{ value: string }> }
}) {
  return cache.query(
    String(request.headers.get('x-cache-key')) +
      String(request.cookies.get('cache')?.value) +
      String(request.cookies.getAll('cache').length),
  );
}
`,
    );
    const graph = await buildFixtureGraph();

    const report = computeDataflow(graph, { sources: [], sinks: [] });

    expect(report.risks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sourceFn: 'GET', source: 'request.headers', sink: 'query' }),
        expect.objectContaining({ sourceFn: 'POST', source: 'request.headers', sink: 'query' }),
        expect.objectContaining({ sourceFn: 'PUT', source: 'request.cookies', sink: 'query' }),
        expect.objectContaining({ sourceFn: 'PATCH', source: 'request.cookies', sink: 'query' }),
      ]),
    );
    expect(report.risks.find((risk) => risk.sourceFn === 'helper')).toBeUndefined();
  });
});
