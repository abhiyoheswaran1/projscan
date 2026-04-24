import { describe, it, expect } from 'vitest';
import path from 'node:path';
import fs from 'node:fs/promises';
import { buildCodeGraph, importersOf } from '../../src/core/codeGraph.js';
import type { FileEntry } from '../../src/types.js';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'python-namespace-pkg');

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

/**
 * PEP 420 regression: ns_pkg/sub/mod_a.py and ns_pkg/other/mod_b.py exist
 * but neither ns_pkg/ nor its children have __init__.py. mod_b imports
 * `from ns_pkg.sub.mod_a import helper_a`; projscan must resolve that to
 * the real file even though no __init__.py marker is present.
 */
describe('codeGraph: PEP 420 namespace packages', () => {
  it('resolves absolute import across a package tree with no __init__.py files', async () => {
    const graph = await buildCodeGraph(FIXTURE_ROOT, await listFixture());
    expect(graph.files.has('ns_pkg/sub/mod_a.py')).toBe(true);
    expect(graph.files.has('ns_pkg/other/mod_b.py')).toBe(true);
    expect(importersOf(graph, 'ns_pkg/sub/mod_a.py')).toContain('ns_pkg/other/mod_b.py');
  });
});
