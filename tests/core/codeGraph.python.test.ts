import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { buildCodeGraph, exportsOf, importersOf, filesImportingPackage } from '../../src/core/codeGraph.js';
import type { FileEntry } from '../../src/types.js';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'python-small');

async function listFixture(): Promise<FileEntry[]> {
  const all: FileEntry[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        await walk(full);
      } else {
        const stat = await fs.stat(full);
        const rel = path.relative(FIXTURE_ROOT, full).split(path.sep).join('/');
        all.push({
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
  return all;
}

describe('buildCodeGraph on the python-small fixture', () => {
  it('parses all Python files', async () => {
    const files = await listFixture();
    const graph = await buildCodeGraph(FIXTURE_ROOT, files);
    for (const expected of [
      'pkg/__init__.py',
      'pkg/core.py',
      'pkg/utils.py',
      'pkg/sub/__init__.py',
      'pkg/sub/deep.py',
      'tests/test_core.py',
    ]) {
      expect(graph.files.has(expected), `missing ${expected}`).toBe(true);
      expect(graph.files.get(expected)!.parseOk).toBe(true);
      expect(graph.files.get(expected)!.adapterId).toBe('python');
    }
  });

  it('extracts exports per file', async () => {
    const files = await listFixture();
    const graph = await buildCodeGraph(FIXTURE_ROOT, files);
    const coreExports = exportsOf(graph, 'pkg/core.py').map((e) => e.name).sort();
    // Exports include `from .utils import PREFIX` and `from .sub.deep import deep_helper`
    // as re-exports, plus the top-level def and assignment. `_internal` filtered.
    expect(coreExports).toEqual(['PREFIX', 'VERSION', 'deep_helper', 'greet']);

    const utilExports = exportsOf(graph, 'pkg/utils.py').map((e) => e.name).sort();
    expect(utilExports).toEqual(['PREFIX', 'format_line']);

    const deepExports = exportsOf(graph, 'pkg/sub/deep.py').map((e) => e.name);
    expect(deepExports).toEqual(['deep_helper']);

    // __init__ honors __all__
    const initExports = exportsOf(graph, 'pkg/__init__.py').map((e) => e.name).sort();
    expect(initExports).toEqual(['PREFIX', 'greet']);
  });

  it('resolves relative imports to correct files (localImporters)', async () => {
    const files = await listFixture();
    const graph = await buildCodeGraph(FIXTURE_ROOT, files);

    // pkg/core.py imports `.utils` and `.sub.deep` → both should appear as importers of those files.
    expect(importersOf(graph, 'pkg/utils.py')).toContain('pkg/core.py');
    expect(importersOf(graph, 'pkg/sub/deep.py')).toContain('pkg/core.py');

    // pkg/__init__.py imports `.core` and `.utils`.
    expect(importersOf(graph, 'pkg/core.py')).toContain('pkg/__init__.py');
    expect(importersOf(graph, 'pkg/utils.py')).toContain('pkg/__init__.py');
  });

  it('resolves absolute `from pkg.core import ...` via inferred package root', async () => {
    const files = await listFixture();
    const graph = await buildCodeGraph(FIXTURE_ROOT, files);
    // tests/test_core.py imports `pkg.core` absolutely. pkg's __init__.py is
    // at the repo root, so "." is the package root and pkg.core → pkg/core.py.
    expect(importersOf(graph, 'pkg/core.py')).toContain('tests/test_core.py');
  });

  it('registers third-party packages (requests, os)', async () => {
    const files = await listFixture();
    const graph = await buildCodeGraph(FIXTURE_ROOT, files);
    expect(filesImportingPackage(graph, 'os')).toContain('pkg/utils.py');
  });

  it('symbolDefs contains Python function/class names', async () => {
    const files = await listFixture();
    const graph = await buildCodeGraph(FIXTURE_ROOT, files);
    expect([...graph.symbolDefs.get('greet') ?? []]).toContain('pkg/core.py');
    expect([...graph.symbolDefs.get('deep_helper') ?? []]).toContain('pkg/sub/deep.py');
    // Private names NOT indexed.
    expect(graph.symbolDefs.has('_internal')).toBe(false);
  });
});
