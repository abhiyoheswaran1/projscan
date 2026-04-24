import { describe, it, expect } from 'vitest';
import { pythonAdapter } from '../../../src/core/languages/pythonAdapter.js';
import type { AstImport } from '../../../src/core/ast.js';

async function imports(src: string): Promise<AstImport[]> {
  const r = await pythonAdapter.parse('t.py', src);
  return r.imports;
}

describe('pythonAdapter imports extraction', () => {
  it('captures simple import', async () => {
    const r = await imports('import os\n');
    expect(r).toEqual([{ source: 'os', kind: 'static', specifiers: [], typeOnly: false, line: 1 }]);
  });

  it('captures dotted import', async () => {
    const r = await imports('import os.path\n');
    expect(r).toEqual([{ source: 'os.path', kind: 'static', specifiers: [], typeOnly: false, line: 1 }]);
  });

  it('captures aliased import (alias is discarded)', async () => {
    const r = await imports('import numpy as np\n');
    expect(r).toEqual([{ source: 'numpy', kind: 'static', specifiers: [], typeOnly: false, line: 1 }]);
  });

  it('captures multi-module single import', async () => {
    const r = await imports('import a, b\n');
    expect(r.map((i) => i.source).sort()).toEqual(['a', 'b']);
  });

  it('captures from-import with single name', async () => {
    const r = await imports('from pathlib import Path\n');
    expect(r).toEqual([{ source: 'pathlib', kind: 'static', specifiers: ['Path'], typeOnly: false, line: 1 }]);
  });

  it('captures from-import with multiple names and aliases', async () => {
    const r = await imports('from x import a, b as c, d\n');
    expect(r).toHaveLength(1);
    expect(r[0].source).toBe('x');
    expect(r[0].specifiers.sort()).toEqual(['a', 'b', 'd']);
  });

  it('captures from-import star', async () => {
    const r = await imports('from x import *\n');
    expect(r).toEqual([{ source: 'x', kind: 'static', specifiers: ['*'], typeOnly: false, line: 1 }]);
  });

  it('captures relative import (one dot)', async () => {
    const r = await imports('from . import sibling\n');
    expect(r[0].source).toBe('.');
    expect(r[0].specifiers).toEqual(['sibling']);
  });

  it('captures relative import (two dots, no module)', async () => {
    const r = await imports('from .. import parent\n');
    expect(r[0].source).toBe('..');
    expect(r[0].specifiers).toEqual(['parent']);
  });

  it('captures relative import with module segment', async () => {
    const r = await imports('from .sub.mod import thing\n');
    expect(r[0].source).toBe('.sub.mod');
    expect(r[0].specifiers).toEqual(['thing']);
  });

  it('skips __future__ imports', async () => {
    const r = await imports('from __future__ import annotations\n');
    expect(r).toEqual([]);
  });

  it('captures imports inside try/except blocks (conditional ImportError pattern)', async () => {
    const src = 'try:\n    import orjson\nexcept ImportError:\n    import json as orjson\n';
    const r = await imports(src);
    expect(r.map((i) => i.source).sort()).toEqual(['json', 'orjson']);
  });

  it('records correct line numbers', async () => {
    const src = '# header\nimport a\n\nfrom b import c\n';
    const r = await imports(src);
    const byName: Record<string, number> = {};
    for (const i of r) byName[i.source] = i.line;
    expect(byName['a']).toBe(2);
    expect(byName['b']).toBe(4);
  });

  it('ignores imports inside function bodies', async () => {
    const src = 'def f():\n    import hidden\n';
    const r = await imports(src);
    expect(r).toEqual([]);
  });
});
