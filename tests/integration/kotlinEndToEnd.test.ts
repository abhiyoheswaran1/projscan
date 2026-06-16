import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'kotlin-small');

describe('Kotlin end-to-end (graph + visibility)', () => {
  it('scans the fixture and parses every .kt file', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const main = graph.files.get('src/main/kotlin/com/example/Main.kt');
    expect(main, 'Main.kt should be in the graph').toBeDefined();
    expect(main!.parseOk).toBe(true);
    const util = graph.files.get('src/main/kotlin/com/example/util/Util.kt');
    expect(util?.parseOk).toBe(true);
  });

  it('exposes only non-private declarations as exports', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const utilExports =
      graph.files
        .get('src/main/kotlin/com/example/util/Util.kt')
        ?.exports.map((e) => e.name)
        .sort() ?? [];
    expect(utilExports).toContain('greet');
    expect(utilExports).toContain('classify');
    expect(utilExports).toContain('PREFIX');
    expect(utilExports).not.toContain('privateHelper');
  });

  it('per-function CC reflects when arms (else not counted)', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const util = graph.files.get('src/main/kotlin/com/example/util/Util.kt');
    const classify = util?.functions?.find((f) => f.name === 'classify');
    expect(classify).toBeDefined();
    // 2 non-else arms (`0 ->` and `1, 2 ->`) + 1 else => CC 3.
    expect(classify!.cyclomaticComplexity).toBe(3);
  });
});
