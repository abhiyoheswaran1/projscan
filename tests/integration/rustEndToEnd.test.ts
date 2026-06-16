import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';
import { computeCoupling } from '../../src/core/couplingAnalyzer.js';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'rust-small');

describe('Rust end-to-end (graph + coupling)', () => {
  it('builds a graph that resolves intra-crate use paths to local files', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);

    const main = graph.files.get('src/main.rs');
    expect(main, 'src/main.rs should be in the graph').toBeDefined();
    expect(main!.parseOk).toBe(true);

    // src/util.rs should be referenced by src/main.rs via the `crate::util::greet` import.
    const utilImporters = graph.localImporters.get('src/util.rs');
    expect(utilImporters && [...utilImporters]).toContain('src/main.rs');
  });

  it('exposes only pub items as exports', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const utilExports =
      graph.files
        .get('src/util.rs')
        ?.exports.map((e) => e.name)
        .sort() ?? [];
    expect(utilExports).toEqual(['PREFIX', 'classify', 'greet']);
    // private_helper is not pub and should NOT appear.
    expect(utilExports).not.toContain('private_helper');
  });

  it('coupling: util.rs has fanIn 1 (main.rs imports it)', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const report = computeCoupling(graph);
    const util = report.files.find((f) => f.relativePath === 'src/util.rs');
    expect(util?.fanIn).toBe(1);
  });

  it('per-function CC reflects match arms (wildcard not counted)', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const util = graph.files.get('src/util.rs');
    const classify = util?.functions?.find((f) => f.name === 'classify');
    expect(classify).toBeDefined();
    // 2 non-wildcard arms (`0 =>` and `1 | 2 =>`) + 1 wildcard => CC 3
    expect(classify!.cyclomaticComplexity).toBe(3);
  });
});
