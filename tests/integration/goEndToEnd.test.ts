import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { computeCoupling } from '../../src/core/couplingAnalyzer.js';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'go-small');

describe('Go end-to-end (graph + coupling)', () => {
  it('builds a graph that resolves intra-module imports to local files', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);

    const main = graph.files.get('main.go');
    expect(main, 'main.go should be in the graph').toBeDefined();
    expect(main!.parseOk).toBe(true);

    // util.go should be referenced by main.go via the module-prefixed import.
    const utilImporters = graph.localImporters.get('internal/util/util.go');
    expect(utilImporters && [...utilImporters]).toContain('main.go');
  });

  it('exposes only capitalized identifiers as exports', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const utilExports = graph.files.get('internal/util/util.go')?.exports.map((e) => e.name) ?? [];
    expect(utilExports.sort()).toEqual(['Greet', 'Prefix']);
  });

  it('coupling: util.go has fanIn 1 (main.go imports it)', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const report = computeCoupling(graph);
    const util = report.files.find((f) => f.relativePath === 'internal/util/util.go');
    expect(util?.fanIn).toBe(1);
  });
});
