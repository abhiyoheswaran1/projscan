import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { buildCodeGraph, importersOf } from '../../src/core/codeGraph.js';
import type { FileEntry } from '../../src/types.js';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'python-mixed');

async function listFixture(): Promise<FileEntry[]> {
  const out: FileEntry[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else {
        const stat = await fs.stat(full);
        const rel = path.relative(FIXTURE_ROOT, full).split(path.sep).join('/');
        out.push({
          relativePath: rel,
          absolutePath: full,
          extension: path.extname(rel).toLowerCase(),
          sizeBytes: stat.size,
          directory: path.dirname(rel) || '.',
        });
      }
    }
  }
  await walk(FIXTURE_ROOT);
  return out;
}

describe('codeGraph: mixed JS/Python repo', () => {
  it('assigns the right adapter per file', async () => {
    const graph = await buildCodeGraph(FIXTURE_ROOT, await listFixture());
    expect(graph.files.get('src/app.py')?.adapterId).toBe('python');
    expect(graph.files.get('src/helpers.py')?.adapterId).toBe('python');
    expect(graph.files.get('src/index.ts')?.adapterId).toBe('javascript');
    expect(graph.files.get('src/ts-helpers.ts')?.adapterId).toBe('javascript');
  });

  it('resolves Python relative imports only against other Python files', async () => {
    const graph = await buildCodeGraph(FIXTURE_ROOT, await listFixture());
    // src/app.py does `from .helpers import py_helper` → should hit src/helpers.py, not ts-helpers.
    expect(importersOf(graph, 'src/helpers.py')).toEqual(['src/app.py']);
    expect(importersOf(graph, 'src/ts-helpers.ts')).toEqual(['src/index.ts']);
  });

  it('symbol defs accumulate across languages without collision', async () => {
    const graph = await buildCodeGraph(FIXTURE_ROOT, await listFixture());
    // py_helper is defined in helpers.py AND re-exported in app.py
    expect([...(graph.symbolDefs.get('py_helper') ?? [])].sort()).toEqual([
      'src/app.py',
      'src/helpers.py',
    ]);
    expect([...(graph.symbolDefs.get('tsHelper') ?? [])]).toEqual(['src/ts-helpers.ts']);
  });
});
