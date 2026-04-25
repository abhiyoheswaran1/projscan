import { describe, it, expect } from 'vitest';
import { diffGraphs } from '../../src/core/prDiff.js';
import type { CodeGraph, GraphFile } from '../../src/core/codeGraph.js';

function file(
  relativePath: string,
  exportsList: string[],
  importsList: string[],
  callSites: string[] = [],
  cc = 1,
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
    cyclomaticComplexity: cc,
    mtimeMs: 0,
    parseOk: true,
    adapterId: 'javascript',
  };
}

function makeGraph(files: GraphFile[], localImporters: Map<string, Set<string>> = new Map()): CodeGraph {
  return {
    files: new Map(files.map((f) => [f.relativePath, f])),
    packageImporters: new Map(),
    localImporters,
    symbolDefs: new Map(),
    scannedFiles: files.length,
  };
}

describe('diffGraphs', () => {
  it('detects added files', () => {
    const base = makeGraph([file('a.ts', ['x'], [])]);
    const head = makeGraph([file('a.ts', ['x'], []), file('b.ts', ['y'], [])]);
    const r = diffGraphs('base', 'aaa', 'HEAD', 'bbb', base, head);
    expect(r.filesAdded).toEqual(['b.ts']);
    expect(r.filesRemoved).toEqual([]);
    expect(r.filesModified).toEqual([]);
    expect(r.totalFilesChanged).toBe(1);
  });

  it('detects removed files', () => {
    const base = makeGraph([file('a.ts', ['x'], []), file('b.ts', ['y'], [])]);
    const head = makeGraph([file('a.ts', ['x'], [])]);
    const r = diffGraphs('base', 'aaa', 'HEAD', 'bbb', base, head);
    expect(r.filesRemoved).toEqual(['b.ts']);
  });

  it('detects export additions and removals', () => {
    const base = makeGraph([file('a.ts', ['old'], [])]);
    const head = makeGraph([file('a.ts', ['new'], [])]);
    const r = diffGraphs('base', null, 'HEAD', null, base, head);
    expect(r.filesModified).toHaveLength(1);
    expect(r.filesModified[0].exportsAdded).toEqual(['new']);
    expect(r.filesModified[0].exportsRemoved).toEqual(['old']);
  });

  it('detects import additions and removals', () => {
    const base = makeGraph([file('a.ts', [], ['react'])]);
    const head = makeGraph([file('a.ts', [], ['react', 'lodash'])]);
    const r = diffGraphs('base', null, 'HEAD', null, base, head);
    expect(r.filesModified[0].importsAdded).toEqual(['lodash']);
    expect(r.filesModified[0].importsRemoved).toEqual([]);
  });

  it('reports CC delta', () => {
    const base = makeGraph([file('a.ts', ['x'], [], [], 5)]);
    const head = makeGraph([file('a.ts', ['x'], [], [], 12)]);
    const r = diffGraphs('base', null, 'HEAD', null, base, head);
    expect(r.filesModified[0].cyclomaticDelta).toBe(7);
  });

  it('reports fan-in delta', () => {
    // a.ts has fan-in 1 in base (b.ts -> a.ts), fan-in 2 in head (b.ts + c.ts).
    const base = makeGraph(
      [file('a.ts', ['x'], []), file('b.ts', [], ['./a'])],
      new Map([['a.ts', new Set(['b.ts'])]]),
    );
    const head = makeGraph(
      [file('a.ts', ['x'], []), file('b.ts', [], ['./a']), file('c.ts', [], ['./a'])],
      new Map([['a.ts', new Set(['b.ts', 'c.ts'])]]),
    );
    const r = diffGraphs('base', null, 'HEAD', null, base, head);
    const aDiff = r.filesModified.find((m) => m.relativePath === 'a.ts');
    expect(aDiff?.fanInDelta).toBe(1);
  });

  it('skips files with no structural change', () => {
    const a = file('a.ts', ['x'], ['react'], ['fn'], 3);
    const r = diffGraphs('base', null, 'HEAD', null, makeGraph([a]), makeGraph([a]));
    expect(r.totalFilesChanged).toBe(0);
    expect(r.filesModified).toEqual([]);
  });
});
