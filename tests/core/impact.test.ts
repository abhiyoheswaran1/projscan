import { describe, it, expect } from 'vitest';
import { computeImpact } from '../../src/core/impact.js';
import type { CodeGraph, GraphFile } from '../../src/core/codeGraph.js';

function file(
  relativePath: string,
  exportsList: string[] = [],
  importsList: string[] = [],
  callSites: string[] = [],
): GraphFile {
  return {
    relativePath,
    imports: importsList.map((source) => ({
      source,
      kind: 'static' as const,
      specifiers: [],
      typeOnly: false,
      line: 1,
    })),
    exports: exportsList.map((name) => ({ name, kind: 'function' as const, typeOnly: false, line: 1 })),
    callSites,
    lineCount: 0,
    cyclomaticComplexity: 1,
    mtimeMs: 0,
    parseOk: true,
    adapterId: 'javascript',
  };
}

/**
 * Build a fixture graph from a description of edges. `localImporters[X]` is
 * the set of files that import X. So for chain a -> b -> c (a imports b,
 * b imports c), localImporters[c] = {b}, localImporters[b] = {a}.
 */
function makeGraph(
  files: GraphFile[],
  edges: Array<[string, string]>,
  symbolDefs: Record<string, string[]> = {},
): CodeGraph {
  const localImporters = new Map<string, Set<string>>();
  for (const [importer, imported] of edges) {
    if (!localImporters.has(imported)) localImporters.set(imported, new Set());
    localImporters.get(imported)!.add(importer);
  }
  const symbolDefsMap = new Map<string, Set<string>>();
  for (const [name, defs] of Object.entries(symbolDefs)) {
    symbolDefsMap.set(name, new Set(defs));
  }
  return {
    files: new Map(files.map((f) => [f.relativePath, f])),
    packageImporters: new Map(),
    localImporters,
    symbolDefs: symbolDefsMap,
    scannedFiles: files.length,
  };
}

describe('computeImpact (file mode)', () => {
  it('returns unavailable for a file not in the graph', () => {
    const g = makeGraph([file('src/a.ts')], []);
    const r = computeImpact(g, { kind: 'file', value: 'src/missing.ts' });
    expect(r.available).toBe(false);
    expect(r.reason).toMatch(/not in the code graph/);
    expect(r.reachable).toEqual([]);
  });

  it('returns no reachable for a file with no importers', () => {
    const g = makeGraph([file('src/leaf.ts')], []);
    const r = computeImpact(g, { kind: 'file', value: 'src/leaf.ts' });
    expect(r.available).toBe(true);
    expect(r.reachable).toEqual([]);
    expect(r.totalReachable).toBe(0);
  });

  it('finds direct importers at distance 1', () => {
    // a imports b. b's reachable set = [a].
    const g = makeGraph([file('src/a.ts'), file('src/b.ts')], [['src/a.ts', 'src/b.ts']]);
    const r = computeImpact(g, { kind: 'file', value: 'src/b.ts' });
    expect(r.reachable).toEqual([{ file: 'src/a.ts', distance: 1 }]);
  });

  it('walks transitively (chain a -> b -> c)', () => {
    // a imports b, b imports c. c's blast radius = {b at 1, a at 2}.
    const g = makeGraph(
      [file('src/a.ts'), file('src/b.ts'), file('src/c.ts')],
      [
        ['src/a.ts', 'src/b.ts'],
        ['src/b.ts', 'src/c.ts'],
      ],
    );
    const r = computeImpact(g, { kind: 'file', value: 'src/c.ts' });
    expect(r.reachable).toEqual([
      { file: 'src/b.ts', distance: 1 },
      { file: 'src/a.ts', distance: 2 },
    ]);
  });

  it('handles cycles without infinite looping', () => {
    // a -> b -> a (cycle). b's reachable = [a]; a's reachable = [b].
    const g = makeGraph(
      [file('src/a.ts'), file('src/b.ts')],
      [
        ['src/a.ts', 'src/b.ts'],
        ['src/b.ts', 'src/a.ts'],
      ],
    );
    const ra = computeImpact(g, { kind: 'file', value: 'src/a.ts' });
    expect(ra.reachable).toEqual([{ file: 'src/b.ts', distance: 1 }]);
  });

  it('respects maxDistance and reports truncation', () => {
    // chain a -> b -> c -> d, query d with maxDistance=2.
    // Expected: c at 1, b at 2; a is at distance 3, omitted; truncated=true.
    const g = makeGraph(
      [file('src/a.ts'), file('src/b.ts'), file('src/c.ts'), file('src/d.ts')],
      [
        ['src/a.ts', 'src/b.ts'],
        ['src/b.ts', 'src/c.ts'],
        ['src/c.ts', 'src/d.ts'],
      ],
    );
    const r = computeImpact(g, { kind: 'file', value: 'src/d.ts' }, { maxDistance: 2 });
    expect(r.reachable).toEqual([
      { file: 'src/c.ts', distance: 1 },
      { file: 'src/b.ts', distance: 2 },
    ]);
    expect(r.truncated).toBe(true);
  });

  it('does not report truncated when graph is exhausted within maxDistance', () => {
    // chain a -> b. query b with maxDistance=10. truncated = false.
    const g = makeGraph(
      [file('src/a.ts'), file('src/b.ts')],
      [['src/a.ts', 'src/b.ts']],
    );
    const r = computeImpact(g, { kind: 'file', value: 'src/b.ts' });
    expect(r.truncated).toBe(false);
  });
});

describe('computeImpact (symbol mode)', () => {
  it('returns unavailable when the symbol is not defined or called', () => {
    const g = makeGraph([file('src/a.ts')], []);
    const r = computeImpact(g, { kind: 'symbol', value: 'nope' });
    expect(r.available).toBe(false);
  });

  it('lists definition files when only definitions exist', () => {
    const g = makeGraph(
      [file('src/a.ts', ['foo'])],
      [],
      { foo: ['src/a.ts'] },
    );
    const r = computeImpact(g, { kind: 'symbol', value: 'foo' });
    // Defined but not called - directCallers is empty, definitionFiles populated,
    // overall available because definitions exist.
    expect(r.definitionFiles).toEqual(['src/a.ts']);
    expect(r.directCallers).toEqual([]);
    expect(r.available).toBe(true);
    expect(r.reachable).toEqual([]);
  });

  it('finds direct callers at distance 1', () => {
    // a defines foo. b calls foo. b's transitive reachable from this query = [b@1].
    const g = makeGraph(
      [file('src/a.ts', ['foo']), file('src/b.ts', [], [], ['foo'])],
      [['src/b.ts', 'src/a.ts']],
      { foo: ['src/a.ts'] },
    );
    const r = computeImpact(g, { kind: 'symbol', value: 'foo' });
    expect(r.directCallers).toEqual(['src/b.ts']);
    expect(r.reachable).toContainEqual({ file: 'src/b.ts', distance: 1 });
  });

  it('walks transitive importers of the direct callers', () => {
    // a defines foo. b calls foo. c imports b. d imports c.
    // Reachable from foo: b@1, c@2, d@3.
    const g = makeGraph(
      [
        file('src/a.ts', ['foo']),
        file('src/b.ts', [], [], ['foo']),
        file('src/c.ts'),
        file('src/d.ts'),
      ],
      [
        ['src/b.ts', 'src/a.ts'],
        ['src/c.ts', 'src/b.ts'],
        ['src/d.ts', 'src/c.ts'],
      ],
      { foo: ['src/a.ts'] },
    );
    const r = computeImpact(g, { kind: 'symbol', value: 'foo' });
    const distances = new Map(r.reachable.map((n) => [n.file, n.distance]));
    expect(distances.get('src/b.ts')).toBe(1);
    expect(distances.get('src/c.ts')).toBe(2);
    expect(distances.get('src/d.ts')).toBe(3);
    // Definition file `a.ts` should NOT be in reachable.
    expect(distances.has('src/a.ts')).toBe(false);
  });

  it('definition file is excluded from reachable even if it imports a caller', () => {
    // Self-recursive: a defines foo and a also imports b which calls foo.
    const g = makeGraph(
      [file('src/a.ts', ['foo']), file('src/b.ts', [], [], ['foo'])],
      [
        ['src/b.ts', 'src/a.ts'],
        ['src/a.ts', 'src/b.ts'], // a imports b for some reason
      ],
      { foo: ['src/a.ts'] },
    );
    const r = computeImpact(g, { kind: 'symbol', value: 'foo' });
    const files = r.reachable.map((n) => n.file);
    expect(files).not.toContain('src/a.ts');
  });
});
