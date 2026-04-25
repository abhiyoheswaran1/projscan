import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadCachedGraph, saveCachedGraph, invalidateCache } from '../../src/core/indexCache.js';
import type { CodeGraph } from '../../src/core/codeGraph.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-cache-'));
}

function fixtureGraph(): CodeGraph {
  const files = new Map();
  files.set('src/a.ts', {
    relativePath: 'src/a.ts',
    imports: [{ source: 'react', kind: 'static', specifiers: ['default'], typeOnly: false, line: 1 }],
    exports: [{ name: 'foo', kind: 'function', typeOnly: false, line: 3 }],
    callSites: ['foo'],
    lineCount: 10,
    cyclomaticComplexity: 7,
    mtimeMs: 12345,
    parseOk: true,
  });
  return {
    files,
    packageImporters: new Map([['react', new Set(['src/a.ts'])]]),
    localImporters: new Map(),
    symbolDefs: new Map([['foo', new Set(['src/a.ts'])]]),
    scannedFiles: 1,
  };
}

describe('indexCache', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('returns undefined when no cache exists', async () => {
    const g = await loadCachedGraph(tmp);
    expect(g).toBeUndefined();
  });

  it('round-trips a graph', async () => {
    await saveCachedGraph(tmp, fixtureGraph());
    const loaded = await loadCachedGraph(tmp);
    expect(loaded).toBeDefined();
    expect(loaded!.files.size).toBe(1);
    const entry = loaded!.files.get('src/a.ts');
    expect(entry?.exports[0].name).toBe('foo');
    expect(entry?.mtimeMs).toBe(12345);
    expect(entry?.cyclomaticComplexity).toBe(7);
  });

  it('rejects a v2 cache (post-0.11 CC requires rebuild)', async () => {
    const dir = path.join(tmp, '.projscan-cache');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(
      path.join(dir, 'graph.json'),
      JSON.stringify({
        version: 2,
        rootPath: tmp,
        files: [
          {
            relativePath: 'src/a.ts',
            imports: [],
            exports: [],
            callSites: [],
            lineCount: 10,
            mtimeMs: 0,
            parseOk: true,
            adapterId: 'javascript',
          },
        ],
        createdAt: '2026-04-01T00:00:00.000Z',
      }),
    );
    const loaded = await loadCachedGraph(tmp);
    expect(loaded).toBeUndefined();
  });

  it('writes a .gitignore so the cache is not committed', async () => {
    await saveCachedGraph(tmp, fixtureGraph());
    const gi = await fs.readFile(path.join(tmp, '.projscan-cache', '.gitignore'), 'utf-8');
    expect(gi).toBe('*\n');
  });

  it('invalidates the cache file', async () => {
    await saveCachedGraph(tmp, fixtureGraph());
    await invalidateCache(tmp);
    const loaded = await loadCachedGraph(tmp);
    expect(loaded).toBeUndefined();
  });

  it('ignores caches with mismatched version', async () => {
    const dir = path.join(tmp, '.projscan-cache');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'graph.json'), JSON.stringify({ version: 999, files: [] }));
    const loaded = await loadCachedGraph(tmp);
    expect(loaded).toBeUndefined();
  });
});
