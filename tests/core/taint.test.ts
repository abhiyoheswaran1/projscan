import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { computeTaint } from '../../src/core/taint.js';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-taint-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 't' }));
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

async function buildGraph() {
  const scan = await scanRepository(tmp);
  return await buildCodeGraph(tmp, scan.files);
}

describe('computeTaint', () => {
  it('detects same-function flow (source + sink in one body)', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'a.ts'),
      `import { exec } from 'child_process';

export function run() {
  const cmd = process.env.MY_CMD;
  exec(cmd ?? 'echo hi');
}
`,
    );
    const graph = await buildGraph();
    const report = computeTaint(graph, { sources: [], sinks: [] });
    expect(report.available).toBe(true);
    expect(report.flowCount).toBeGreaterThan(0);
    const flow = report.flows.find((f) => f.sinkFn === 'run');
    expect(flow).toBeDefined();
    expect(flow!.sourceFn).toBe('run');
    expect(flow!.path).toEqual(['run']);
  });

  it('detects multi-hop flow (source → middleware → sink)', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'b.ts'),
      `import { spawn } from 'child_process';

export function reader() {
  const v = process.env.X;
  return middle(v);
}

export function middle(v: string | undefined) {
  return runIt(v);
}

export function runIt(v: string | undefined) {
  spawn(v ?? 'echo');
}
`,
    );
    const graph = await buildGraph();
    const report = computeTaint(graph, { sources: [], sinks: [] });
    const flow = report.flows.find((f) => f.sourceFn === 'reader');
    expect(flow).toBeDefined();
    expect(flow!.sinkFn).toBe('runIt');
    expect(flow!.path).toEqual(['reader', 'middle', 'runIt']);
  });

  it('reports no flows when source and sink are unconnected', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'c.ts'),
      `export function reader() {
  return process.env.X;
}

export function writer() {
  // unrelated
  return 1;
}
`,
    );
    const graph = await buildGraph();
    const report = computeTaint(graph, { sources: [], sinks: [] });
    expect(report.flowCount).toBe(0);
  });

  it('honors user-declared additional sources', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'd.ts'),
      `import { spawn } from 'child_process';

export function readSecret() {
  const x = customSecretReader();
  spawn(x);
}

export function customSecretReader() { return 'leak'; }
`,
    );
    const graph = await buildGraph();
    // Without declaring customSecretReader as a source, no flow.
    const empty = computeTaint(graph, { sources: [], sinks: [] });
    expect(empty.flowCount).toBe(0);
    // With it declared, flow surfaces.
    const declared = computeTaint(graph, {
      sources: ['customSecretReader'],
      sinks: [],
    });
    expect(declared.flowCount).toBeGreaterThan(0);
  });

  it('honors user-declared additional sinks', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'e.ts'),
      `export function leakIt() {
  const v = process.env.X;
  customDangerousSink(v);
}

export function customDangerousSink(v: string | undefined) { return v; }
`,
    );
    const graph = await buildGraph();
    const report = computeTaint(graph, {
      sources: [],
      sinks: ['customDangerousSink'],
    });
    expect(report.flowCount).toBeGreaterThan(0);
  });

  it('detects Express handler request body into a database query', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'server.ts'),
      `import express from 'express';

const app = express();
const db = { query(sql: string) { return sql; } };

app.post('/users', (req, res) => {
  const sql = req.body.sql;
  db.query(sql);
  res.json({ ok: true });
});
`,
    );
    const graph = await buildGraph();

    const report = computeTaint(graph, { sources: [], sinks: [] });

    expect(
      report.flows.some((flow) => flow.source === 'express.req.body' && flow.sink === 'query'),
    ).toBe(true);
  });

  it('does not treat ordinary req-shaped helpers as Express taint sources', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'helpers.ts'),
      `const db = { query(sql: string) { return sql; } };

export function saveSearch(req: { body: { sql: string } }) {
  return db.query(req.body.sql);
}
`,
    );
    const graph = await buildGraph();

    const report = computeTaint(graph, { sources: [], sinks: [] });

    expect(report.flows.find((flow) => flow.source === 'express.req.body')).toBeUndefined();
    expect(report.flows.find((flow) => flow.sourceFn === 'saveSearch')).toBeUndefined();
  });

  it('keeps imported database query helpers as taint sinks', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'db.ts'),
      'export function query(sql: string) { return sql; }\n',
    );
    await fs.writeFile(
      path.join(tmp, 'src', 'server.ts'),
      `import express from 'express';
import { query } from './db';

const app = express();

app.post('/users', (req, res) => {
  const sql = req.body.sql;
  query(sql);
  res.json({ ok: true });
});
`,
    );
    const graph = await buildGraph();

    const report = computeTaint(graph, { sources: [], sinks: [] });

    expect(
      report.flows.some((flow) => flow.source === 'express.req.body' && flow.sink === 'query'),
    ).toBe(true);
  });

  it('keeps destructured database query aliases as taint sinks', async () => {
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
    const graph = await buildGraph();

    const report = computeTaint(graph, { sources: [], sinks: [] });

    expect(
      report.flows.some((flow) => flow.source === 'express.req.body' && flow.sink === 'query'),
    ).toBe(true);
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
    const graph = await buildGraph();

    const report = computeTaint(graph, { sources: [], sinks: [] });

    expect(
      report.flows.find((flow) => flow.sourceFn === 'searchCache' && flow.sink === 'query'),
    ).toBeUndefined();
  });

  it('returns available:false when no functions have callSites', async () => {
    // Empty-ish project with no .ts files in /src.
    const graph = await buildGraph();
    const report = computeTaint(graph, { sources: [], sinks: [] });
    expect(report.available).toBe(false);
    expect(report.reason).toMatch(/callSites/);
  });

  it('caps depth at MAX_DEPTH (long-chain truncation reported)', async () => {
    // 18-level call chain — MAX_DEPTH (1.8+) is 12, so the deepest sink
    // at level 18 should NOT be reported AND the report should mark the
    // source as truncated.
    let src = `import { exec } from 'child_process';\n\n`;
    for (let i = 0; i < 18; i++) {
      const calls = i === 17 ? `exec('x');` : `f${i + 1}();`;
      src += `export function f${i}() {${i === 0 ? ' const v = process.env.X;' : ''} ${calls} }\n`;
    }
    await fs.writeFile(path.join(tmp, 'src', 'chain.ts'), src);
    const graph = await buildGraph();
    const report = computeTaint(graph, { sources: [], sinks: [] });
    // No flow should reach the depth-18 sink — depth cap stops at 12.
    const reaching = report.flows.find((f) => f.sourceFn === 'f0');
    expect(reaching).toBeUndefined();
    // 1.8+ — surface the truncation explicitly so callers know flows
    // beyond MAX_DEPTH may exist.
    expect(report.truncated).toBe(true);
    expect(report.truncatedSources).toContain('f0');
    expect(report.maxDepth).toBe(12);
  });

  it('reaches a sink at the new MAX_DEPTH=12 boundary', async () => {
    // 12-level chain — should now report the f0→f11 flow (was unreachable
    // when MAX_DEPTH was 8 in the 1.7 line).
    let src = `import { exec } from 'child_process';\n\n`;
    for (let i = 0; i < 12; i++) {
      const calls = i === 11 ? `exec('x');` : `f${i + 1}();`;
      src += `export function f${i}() {${i === 0 ? ' const v = process.env.X;' : ''} ${calls} }\n`;
    }
    await fs.writeFile(path.join(tmp, 'src', 'chain.ts'), src);
    const graph = await buildGraph();
    const report = computeTaint(graph, { sources: [], sinks: [] });
    const reaching = report.flows.find((f) => f.sourceFn === 'f0' && f.sinkFn === 'f11');
    expect(reaching).toBeDefined();
  });

  it('caps the BFS frontier per step and surfaces the source as truncated (1.10+)', () => {
    // Construct a wide-fan-out graph directly: one source function calls
    // a bare-name `helper`, and 6000 same-named `helper` functions exist
    // in the graph. Each BFS step would otherwise resolve every bare-name
    // callee to every same-named candidate, exploding the frontier. With
    // MAX_FRONTIER_PER_STEP = 5000, the BFS aborts after pushing 5000
    // candidates and the source is surfaced in `truncatedSources`.
    const files = new Map<string, import('../../src/core/codeGraph.js').GraphFile>();
    files.set('entry.ts', {
      relativePath: 'entry.ts',
      imports: [],
      exports: [],
      callSites: ['helper'],
      lineCount: 1,
      cyclomaticComplexity: 1,
      mtimeMs: 0,
      parseOk: true,
      functions: [
        {
          name: 'entry',
          line: 1,
          endLine: 1,
          cyclomaticComplexity: 1,
          callSites: ['helper'],
          references: ['env'],
        },
      ],
    });
    const N = 6000;
    for (let i = 0; i < N; i++) {
      files.set(`h${i}.ts`, {
        relativePath: `h${i}.ts`,
        imports: [],
        exports: [],
        callSites: [],
        lineCount: 1,
        cyclomaticComplexity: 1,
        mtimeMs: 0,
        parseOk: true,
        functions: [
          {
            name: 'helper',
            line: 1,
            endLine: 1,
            cyclomaticComplexity: 1,
            callSites: [],
            references: [],
          },
        ],
      });
    }
    const graph = {
      files,
      packageImporters: new Map(),
      localImporters: new Map(),
      symbolDefs: new Map(),
      scannedFiles: files.size,
    };
    const report = computeTaint(graph, { sources: [], sinks: [] });
    expect(report.available).toBe(true);
    expect(report.truncated).toBe(true);
    expect(report.truncatedSources).toContain('entry');
  });

  it('does not treat RegExp.exec as a default child_process sink', async () => {
    await fs.writeFile(
      path.join(tmp, 'src', 'regex.ts'),
      `const RE = /x/;

export function cli() {
  return parse(process.argv[2] ?? '');
}

export function parse(value: string) {
  return RE.exec(value);
}
`,
    );
    const graph = await buildGraph();
    const report = computeTaint(graph, { sources: [], sinks: [] });
    expect(report.flows).toEqual([]);
  });
});
