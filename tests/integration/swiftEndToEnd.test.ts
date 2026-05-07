import { describe, it, expect } from 'vitest';
import path from 'node:path';
import { scanRepository } from '../../src/core/repositoryScanner.js';
import { buildCodeGraph } from '../../src/core/codeGraph.js';

const FIXTURE_ROOT = path.resolve(__dirname, '..', 'fixtures', 'swift-small');

describe('Swift end-to-end (graph + visibility)', () => {
  it('scans the fixture and parses every .swift file', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    expect(graph.files.get('Sources/SwiftSmall/main.swift')?.parseOk).toBe(true);
    expect(graph.files.get('Sources/SwiftSmall/Util.swift')?.parseOk).toBe(true);
  });

  it('exposes only non-private declarations as exports', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const utilExports = graph.files
      .get('Sources/SwiftSmall/Util.swift')
      ?.exports.map((e) => e.name)
      .sort() ?? [];
    expect(utilExports).toContain('greet');
    expect(utilExports).toContain('classify');
    expect(utilExports).toContain('PREFIX');
    expect(utilExports).not.toContain('privateHelper');
  });

  it('per-function CC reflects switch cases (default not counted)', async () => {
    const scan = await scanRepository(FIXTURE_ROOT);
    const graph = await buildCodeGraph(FIXTURE_ROOT, scan.files);
    const util = graph.files.get('Sources/SwiftSmall/Util.swift');
    const classify = util?.functions?.find((f) => f.name === 'classify');
    expect(classify).toBeDefined();
    // 2 non-default arms (case 0, case 1, 2) + 1 default => CC 3.
    expect(classify!.cyclomaticComplexity).toBe(3);
  });
});
