import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { semanticGraphTool } from '../../src/mcp/tools/semanticGraph.js';

vi.setConfig({ testTimeout: 60000 });

let tmp: string;

beforeEach(async () => {
  tmp = await fs.mkdtemp(path.join(os.tmpdir(), 'projscan-semgraph-query-'));
  await fs.writeFile(path.join(tmp, 'package.json'), JSON.stringify({ name: 't', type: 'module' }));
  await fs.mkdir(path.join(tmp, 'src'), { recursive: true });
  await fs.writeFile(path.join(tmp, 'src', 'util.ts'), `export function helper() { return 1; }\n`);
  await fs.writeFile(
    path.join(tmp, 'src', 'app.ts'),
    `import { helper } from './util.js';\nexport function main() { return helper(); }\n`,
  );
});

afterEach(async () => {
  await fs.rm(tmp, { recursive: true, force: true });
});

describe('projscan_semantic_graph query mode (folds in the old graph tool)', () => {
  it('returns the full semantic graph when no query is given', async () => {
    const out = (await semanticGraphTool.handler({}, tmp)) as { nodes?: unknown[]; schemaVersion?: number };
    expect(Array.isArray(out.nodes)).toBe(true);
  });

  it('answers a targeted importers query when query is given', async () => {
    const out = (await semanticGraphTool.handler(
      { query: { direction: 'importers', file: 'src/util.ts' } },
      tmp,
    )) as { importers: string[] };
    expect(out.importers.some((f) => /app/.test(f))).toBe(true);
  });

  it('answers a symbol_defs query', async () => {
    const out = (await semanticGraphTool.handler(
      { query: { direction: 'symbol_defs', symbol: 'helper' } },
      tmp,
    )) as { definedIn: string[] };
    expect(out.definedIn.some((f) => /util/.test(f))).toBe(true);
  });
});
