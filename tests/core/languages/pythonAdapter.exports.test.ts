import { describe, it, expect } from 'vitest';
import { pythonAdapter } from '../../../src/core/languages/pythonAdapter.js';
import type { AstExport } from '../../../src/core/ast.js';

async function exportsOf(src: string): Promise<AstExport[]> {
  const r = await pythonAdapter.parse('t.py', src);
  return r.exports;
}

describe('pythonAdapter exports extraction', () => {
  it('exports top-level def', async () => {
    const r = await exportsOf('def greet(name):\n    return name\n');
    expect(r).toEqual([{ name: 'greet', kind: 'function', typeOnly: false, line: 1 }]);
  });

  it('exports top-level async def', async () => {
    const r = await exportsOf('async def slow():\n    pass\n');
    expect(r).toEqual([{ name: 'slow', kind: 'function', typeOnly: false, line: 1 }]);
  });

  it('exports top-level class', async () => {
    const r = await exportsOf('class Greeter:\n    pass\n');
    expect(r).toEqual([{ name: 'Greeter', kind: 'class', typeOnly: false, line: 1 }]);
  });

  it('exports decorated function', async () => {
    const r = await exportsOf('@cached\ndef helper():\n    pass\n');
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('helper');
    expect(r[0].kind).toBe('function');
  });

  it('exports simple assignment', async () => {
    const r = await exportsOf('CONSTANT = 42\n');
    expect(r).toEqual([{ name: 'CONSTANT', kind: 'variable', typeOnly: false, line: 1 }]);
  });

  it('exports tuple-unpacking assignment', async () => {
    const r = await exportsOf('a, b = 1, 2\n');
    expect(r.map((e) => e.name).sort()).toEqual(['a', 'b']);
  });

  it('skips names starting with underscore', async () => {
    const r = await exportsOf('_private = 1\nPUBLIC = 2\n');
    expect(r.map((e) => e.name)).toEqual(['PUBLIC']);
  });

  it('skips class methods (not top-level)', async () => {
    const r = await exportsOf('class Greeter:\n    def hello(self):\n        pass\n');
    expect(r.map((e) => e.name)).toEqual(['Greeter']);
  });

  it('skips dunder method as export when no __all__', async () => {
    const r = await exportsOf('def __init_subclass__():\n    pass\n\ndef public():\n    pass\n');
    expect(r.map((e) => e.name)).toEqual(['public']);
  });

  it('honors __all__ to include underscored names', async () => {
    const r = await exportsOf("__all__ = ['_hidden', 'visible']\n\n_hidden = 1\nvisible = 2\nextra = 3\n");
    expect(r.map((e) => e.name).sort()).toEqual(['_hidden', 'visible']);
  });

  it('honors __all__ to exclude otherwise-public names', async () => {
    const r = await exportsOf("__all__ = ['kept']\n\ndef kept():\n    pass\n\ndef dropped():\n    pass\n");
    expect(r.map((e) => e.name)).toEqual(['kept']);
  });

  it('falls back to public-name rule when __all__ is not a literal list', async () => {
    const r = await exportsOf('__all__ = sorted(dir())\n\ndef public():\n    pass\n\n_private = 1\n');
    // Non-literal __all__ → treated as absent. The __all__ binding itself
    // starts with an underscore so the public-name rule drops it; same for
    // `_private`. Only `public` survives.
    expect(r.map((e) => e.name)).toEqual(['public']);
  });

  it('exports from-import rebindings (re-exports)', async () => {
    const r = await exportsOf('from .helper import thing\nfrom other import x as aliased\n');
    expect(r.map((e) => e.name).sort()).toEqual(['aliased', 'thing']);
  });

  it('records line numbers', async () => {
    const src = ['# header', '', 'def first():', '    pass', '', 'class Second:', '    pass', ''].join('\n');
    const r = await exportsOf(src);
    const byName = Object.fromEntries(r.map((e) => [e.name, e.line]));
    expect(byName['first']).toBe(3);
    expect(byName['Second']).toBe(6);
  });

  it('type-annotated assignment still counts as an export', async () => {
    const r = await exportsOf('NAME: int = 5\n');
    expect(r).toHaveLength(1);
    expect(r[0].name).toBe('NAME');
  });
});
