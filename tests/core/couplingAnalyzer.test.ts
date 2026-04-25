import { describe, it, expect } from 'vitest';
import { computeCoupling, filterCoupling } from '../../src/core/couplingAnalyzer.js';
import type { CodeGraph, GraphFile } from '../../src/core/codeGraph.js';
import type { WorkspaceInfo } from '../../src/types.js';

function file(relativePath: string, importing: string[] = []): GraphFile {
  return {
    relativePath,
    imports: importing.map((source) => ({
      source,
      kind: 'static' as const,
      specifiers: [],
      typeOnly: false,
      line: 1,
    })),
    exports: [],
    callSites: [],
    lineCount: 0,
    cyclomaticComplexity: 1,
    mtimeMs: 0,
    parseOk: true,
    adapterId: 'javascript',
  };
}

/** Build a graph from a list of (file, files-it-imports) pairs. */
function graph(edges: Array<[string, string[]]>): CodeGraph {
  const files = new Map<string, GraphFile>();
  const localImporters = new Map<string, Set<string>>();
  for (const [path, imports] of edges) {
    files.set(path, file(path, imports));
  }
  // Reverse-index for localImporters.
  for (const [importer, imports] of edges) {
    for (const imported of imports) {
      if (!localImporters.has(imported)) localImporters.set(imported, new Set());
      localImporters.get(imported)!.add(importer);
    }
  }
  return {
    files,
    packageImporters: new Map(),
    localImporters,
    symbolDefs: new Map(),
    scannedFiles: files.size,
  };
}

describe('computeCoupling: fan-in / fan-out / instability', () => {
  it('isolated file has 0/0 and instability 0', () => {
    const r = computeCoupling(graph([['a.ts', []]]));
    const f = r.files.find((x) => x.relativePath === 'a.ts')!;
    expect(f.fanIn).toBe(0);
    expect(f.fanOut).toBe(0);
    expect(f.instability).toBe(0);
  });

  it('a -> b: a has fanOut 1, b has fanIn 1', () => {
    const r = computeCoupling(graph([
      ['a.ts', ['b.ts']],
      ['b.ts', []],
    ]));
    const a = r.files.find((x) => x.relativePath === 'a.ts')!;
    const b = r.files.find((x) => x.relativePath === 'b.ts')!;
    expect(a.fanOut).toBe(1);
    expect(a.fanIn).toBe(0);
    expect(b.fanIn).toBe(1);
    expect(b.fanOut).toBe(0);
    // a is fully unstable (depends but no one depends on it); b is fully stable.
    expect(a.instability).toBe(1);
    expect(b.instability).toBe(0);
  });

  it('balanced in/out gives instability ~0.5', () => {
    const r = computeCoupling(graph([
      ['x.ts', ['y.ts']],
      ['z.ts', ['x.ts']],
      ['y.ts', []],
    ]));
    const x = r.files.find((f) => f.relativePath === 'x.ts')!;
    expect(x.fanIn).toBe(1);
    expect(x.fanOut).toBe(1);
    expect(x.instability).toBe(0.5);
  });

  it('returns 0 cycles on a DAG', () => {
    const r = computeCoupling(graph([
      ['a.ts', ['b.ts', 'c.ts']],
      ['b.ts', ['c.ts']],
      ['c.ts', []],
    ]));
    expect(r.cycles).toEqual([]);
    expect(r.totalCycles).toBe(0);
  });
});

describe('computeCoupling: cycle detection (Tarjan SCC)', () => {
  it('detects a 2-file cycle a <-> b', () => {
    const r = computeCoupling(graph([
      ['a.ts', ['b.ts']],
      ['b.ts', ['a.ts']],
    ]));
    expect(r.cycles).toHaveLength(1);
    expect(r.cycles[0].size).toBe(2);
    expect(r.cycles[0].files.sort()).toEqual(['a.ts', 'b.ts']);
  });

  it('detects a 3-file cycle a -> b -> c -> a', () => {
    const r = computeCoupling(graph([
      ['a.ts', ['b.ts']],
      ['b.ts', ['c.ts']],
      ['c.ts', ['a.ts']],
    ]));
    expect(r.cycles).toHaveLength(1);
    expect(r.cycles[0].size).toBe(3);
    expect(r.cycles[0].files.sort()).toEqual(['a.ts', 'b.ts', 'c.ts']);
  });

  it('detects two disjoint cycles', () => {
    const r = computeCoupling(graph([
      ['a.ts', ['b.ts']],
      ['b.ts', ['a.ts']],
      ['c.ts', ['d.ts']],
      ['d.ts', ['c.ts']],
    ]));
    expect(r.cycles).toHaveLength(2);
    expect(r.totalCycles).toBe(2);
  });

  it('ignores self-loops (single-node SCCs)', () => {
    // a -> a is technically a cycle but excluded from the "size >= 2" filter.
    const r = computeCoupling(graph([['a.ts', ['a.ts']]]));
    expect(r.cycles).toEqual([]);
  });

  it('ignores acyclic edges adjacent to a cycle', () => {
    // a -> b -> c -> b (cycle b<->c only). a is not in the cycle.
    const r = computeCoupling(graph([
      ['a.ts', ['b.ts']],
      ['b.ts', ['c.ts']],
      ['c.ts', ['b.ts']],
    ]));
    expect(r.cycles).toHaveLength(1);
    expect(r.cycles[0].files.sort()).toEqual(['b.ts', 'c.ts']);
  });
});

describe('cross-package edges', () => {
  const ws: WorkspaceInfo = {
    kind: 'npm',
    packages: [
      { name: 'root', relativePath: '', isRoot: true },
      { name: 'pkg-a', relativePath: 'packages/a', isRoot: false },
      { name: 'pkg-b', relativePath: 'packages/b', isRoot: false },
    ],
  };

  it('flags edges that cross workspace package boundaries', () => {
    const g = graph([
      ['packages/a/src/x.ts', ['packages/b/src/y.ts']],
      ['packages/b/src/y.ts', []],
      // intra-package edge — should NOT be flagged.
      ['packages/a/src/x2.ts', ['packages/a/src/x.ts']],
    ]);
    const r = computeCoupling(g, ws);
    expect(r.crossPackageEdges).toHaveLength(1);
    expect(r.crossPackageEdges[0]).toEqual({
      from: { file: 'packages/a/src/x.ts', package: 'pkg-a' },
      to: { file: 'packages/b/src/y.ts', package: 'pkg-b' },
    });
    expect(r.totalCrossPackageEdges).toBe(1);
  });

  it('returns no cross-package edges when no workspaces are passed', () => {
    const g = graph([
      ['packages/a/x.ts', ['packages/b/y.ts']],
      ['packages/b/y.ts', []],
    ]);
    const r = computeCoupling(g);
    expect(r.crossPackageEdges).toEqual([]);
    expect(r.totalCrossPackageEdges).toBe(0);
  });

  it('returns no cross-package edges when only one non-root package exists', () => {
    const single: WorkspaceInfo = {
      kind: 'none',
      packages: [{ name: 'only', relativePath: '', isRoot: true }],
    };
    const g = graph([
      ['a.ts', ['b.ts']],
      ['b.ts', []],
    ]);
    const r = computeCoupling(g, single);
    expect(r.crossPackageEdges).toEqual([]);
  });
});

describe('filterCoupling', () => {
  const g = graph([
    ['hub.ts', []],
    ['leaf1.ts', ['hub.ts']],
    ['leaf2.ts', ['hub.ts']],
    ['cycA.ts', ['cycB.ts']],
    ['cycB.ts', ['cycA.ts']],
  ]);
  const report = computeCoupling(g);

  it('cycles_only returns only files in cycles', () => {
    const filtered = filterCoupling(report, 'cycles_only');
    expect(filtered.map((f) => f.relativePath).sort()).toEqual(['cycA.ts', 'cycB.ts']);
  });

  it('high_fan_in puts the most-imported file first', () => {
    const filtered = filterCoupling(report, 'high_fan_in');
    expect(filtered[0].relativePath).toBe('hub.ts');
    expect(filtered[0].fanIn).toBe(2);
  });

  it('all matches input file count', () => {
    expect(filterCoupling(report, 'all')).toHaveLength(report.totalFiles);
  });
});
