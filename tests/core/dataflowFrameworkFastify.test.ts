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

describe('computeDataflow Fastify framework request sources', () => {
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

  it('treats Fastify request host fields as framework sources without helper lookalikes', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'fastify-host.ts'),
      `import Fastify from 'fastify';

const app = Fastify();
const db = { query(sql: string) { return sql; } };
const cache = { query(key: string) { return key; } };

app.get('/by-host', async (request) => {
  const host = request.host;
  return db.query(String(host));
});

app.get('/by-hostname', async (request) => {
  const hostname = request.hostname;
  return db.query(String(hostname));
});

export function helper(request: { host: string, hostname: string }) {
  return cache.query(request.host + request.hostname);
}
`,
    );

    const graph = await buildFixtureGraph();
    const report = computeDataflow(graph, { sources: [], sinks: [] });
    const fastifyRisks = report.risks.filter((risk) => risk.files.includes('src/fastify-host.ts'));

    expect(fastifyRisks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ source: 'fastify.request.host', sink: 'query' }),
        expect.objectContaining({ source: 'fastify.request.hostname', sink: 'query' }),
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

});
