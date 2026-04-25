import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { loadCachedGraph, saveCachedGraph } from '../../src/core/indexCache.js';
import type { CodeGraph, GraphFile } from '../../src/core/codeGraph.js';

async function makeTempDir(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), 'projscan-pycache-'));
}

function pythonEntry(): GraphFile {
  return {
    relativePath: 'pkg/core.py',
    imports: [
      { source: 'pkg.utils', kind: 'static', specifiers: ['PREFIX'], typeOnly: false, line: 1 },
    ],
    exports: [{ name: 'greet', kind: 'function', typeOnly: false, line: 5 }],
    callSites: [],
    lineCount: 10,
    cyclomaticComplexity: 1,
    mtimeMs: 42_000,
    parseOk: true,
    adapterId: 'python',
  };
}

function jsEntry(): GraphFile {
  return {
    relativePath: 'src/index.ts',
    imports: [{ source: 'react', kind: 'static', specifiers: ['default'], typeOnly: false, line: 1 }],
    exports: [{ name: 'App', kind: 'function', typeOnly: false, line: 3 }],
    callSites: [],
    lineCount: 8,
    cyclomaticComplexity: 1,
    mtimeMs: 13_000,
    parseOk: true,
    adapterId: 'javascript',
  };
}

function mixedGraph(): CodeGraph {
  const files = new Map<string, GraphFile>();
  files.set('pkg/core.py', pythonEntry());
  files.set('src/index.ts', jsEntry());
  return {
    files,
    packageImporters: new Map(),
    localImporters: new Map(),
    symbolDefs: new Map(),
    scannedFiles: 2,
  };
}

describe('indexCache: Python + mixed-language round-trip', () => {
  let tmp: string;
  beforeEach(async () => {
    tmp = await makeTempDir();
  });
  afterEach(async () => {
    await fs.rm(tmp, { recursive: true, force: true });
  });

  it('round-trips a Python graph entry with adapterId intact', async () => {
    const g: CodeGraph = {
      files: new Map([['pkg/core.py', pythonEntry()]]),
      packageImporters: new Map(),
      localImporters: new Map(),
      symbolDefs: new Map(),
      scannedFiles: 1,
    };
    await saveCachedGraph(tmp, g);
    const loaded = await loadCachedGraph(tmp);
    const entry = loaded!.files.get('pkg/core.py');
    expect(entry?.adapterId).toBe('python');
    expect(entry?.exports[0].name).toBe('greet');
    expect(entry?.imports[0].source).toBe('pkg.utils');
  });

  it('preserves both JS and Python entries in a mixed-language cache', async () => {
    await saveCachedGraph(tmp, mixedGraph());
    const loaded = await loadCachedGraph(tmp);
    expect(loaded!.files.size).toBe(2);
    expect(loaded!.files.get('pkg/core.py')?.adapterId).toBe('python');
    expect(loaded!.files.get('src/index.ts')?.adapterId).toBe('javascript');
  });

  it('rejects a v1 cache on load (forces rebuild after adapter-refactor upgrade)', async () => {
    const dir = path.join(tmp, '.projscan-cache');
    await fs.mkdir(dir, { recursive: true });
    // Pre-0.10 payload: no adapterId, version 1.
    await fs.writeFile(
      path.join(dir, 'graph.json'),
      JSON.stringify({
        version: 1,
        rootPath: tmp,
        files: [
          {
            relativePath: 'src/a.ts',
            imports: [],
            exports: [],
            callSites: [],
            lineCount: 0,
            mtimeMs: 0,
            parseOk: true,
          },
        ],
        createdAt: '2026-04-01T00:00:00.000Z',
      }),
    );
    const loaded = await loadCachedGraph(tmp);
    expect(loaded).toBeUndefined();
  });

  it('re-save after version bump is readable (end-to-end upgrade path)', async () => {
    const dir = path.join(tmp, '.projscan-cache');
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'graph.json'), JSON.stringify({ version: 1, files: [] }));
    // v1 rejected → rebuild → save v2 → load v2.
    expect(await loadCachedGraph(tmp)).toBeUndefined();
    await saveCachedGraph(tmp, mixedGraph());
    const loaded = await loadCachedGraph(tmp);
    expect(loaded).toBeDefined();
    expect(loaded!.files.size).toBe(2);
  });
});
