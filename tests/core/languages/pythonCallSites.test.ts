import { describe, it, expect } from 'vitest';
import { pythonAdapter } from '../../../src/core/languages/pythonAdapter.js';

async function callSites(src: string): Promise<string[]> {
  const result = await pythonAdapter.parse('t.py', src);
  expect(result.ok).toBe(true);
  return [...result.callSites].sort();
}

describe('callSites (Python)', () => {
  it('empty file has no call sites', async () => {
    expect(await callSites('')).toEqual([]);
  });

  it('captures bare function calls', async () => {
    expect(await callSites('foo()\nbar()\n')).toEqual(['bar', 'foo']);
  });

  it('captures method calls by attribute name', async () => {
    expect(await callSites('obj.method()\n')).toEqual(['method']);
  });

  it('captures chained method calls (rightmost wins per call)', async () => {
    // a.b().c() — `b` and `c` are both calls.
    expect(await callSites('a.b().c()\n')).toEqual(['b', 'c']);
  });

  it('uniques duplicate calls', async () => {
    expect(await callSites('foo()\nfoo()\nfoo()\n')).toEqual(['foo']);
  });

  it('captures calls inside function bodies', async () => {
    const src = ['def outer():', '    inner()', '    helper.run()', ''].join('\n');
    expect(await callSites(src)).toEqual(['inner', 'run']);
  });

  it('captures calls inside list comprehensions', async () => {
    expect(await callSites('xs = [transform(x) for x in items]\n')).toEqual(['transform']);
  });

  it('skips subscript callees (no name to record)', async () => {
    // `funcs[0]()` — callee is a subscript; skip.
    expect(await callSites('funcs[0]()\n')).toEqual([]);
  });
});
