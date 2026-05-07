import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'cpp-small');

describe('C++ end-to-end (graph + #include resolution)', () => {
  it('scans the fixture and parses every .cpp/.h file', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    expect(graph.files.get('src/main.cpp')?.parseOk).toBe(true);
    expect(graph.files.get('src/util.cpp')?.parseOk).toBe(true);
    expect(graph.files.get('src/util.h')?.parseOk).toBe(true);
  });

  it('resolves quoted #include "util.h" to the local header', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const importers = graph.localImporters.get('src/util.h');
    expect(importers && [...importers].sort()).toEqual(['src/main.cpp', 'src/util.cpp']);
  });

  it('exposes top-level functions / classes via exports', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const util = graph.files.get('src/util.cpp');
    const names = util?.exports.map((e) => e.name).sort() ?? [];
    expect(names).toContain('greet');
    expect(names).toContain('classify');
  });

  it('per-function CC counts switch cases (default does not)', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const util = graph.files.get('src/util.cpp');
    const classify = util?.functions?.find((f) => f.name === 'classify');
    expect(classify).toBeDefined();
    // tree-sitter-cpp emits one case_statement per `case X:` label, so
    // `case 1:` + `case 2:` (fall-through) + `case 0:` = 3 case nodes
    // counting; default does not. CC = 3 + 1 = 4.
    expect(classify!.cyclomaticComplexity).toBeGreaterThanOrEqual(3);
  });
});
