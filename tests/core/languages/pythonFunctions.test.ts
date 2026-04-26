import { describe, it, expect } from 'vitest';
import { pythonAdapter } from '../../../src/core/languages/pythonAdapter.js';

async function fns(code: string) {
  const r = await pythonAdapter.parse('test.py', code);
  expect(r.ok).toBe(true);
  return r.functions;
}

describe('per-function CC (Python)', () => {
  it('top-level def is CC 1', async () => {
    const out = await fns(`def foo():\n    return 1\n`);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('foo');
    expect(out[0].cyclomaticComplexity).toBe(1);
  });

  it('def with one if/elif/else has CC 3', async () => {
    const out = await fns(`def foo(x):\n    if x:\n        return 1\n    elif x == 2:\n        return 2\n    else:\n        return 3\n`);
    expect(out[0].cyclomaticComplexity).toBe(3);
  });

  it('class method named Class.method', async () => {
    const out = await fns(`class A:\n    def m(self, x):\n        return x if x else 0\n`);
    const m = out.find((f) => f.name === 'A.m');
    expect(m).toBeDefined();
    expect(m?.cyclomaticComplexity).toBe(2);
  });

  it('nested def emits two entries', async () => {
    const out = await fns(`def outer(x):\n    def inner(y):\n        if y:\n            return 1\n        return 0\n    if x:\n        return inner(x)\n    return 0\n`);
    expect(out).toHaveLength(2);
    const outer = out.find((f) => f.name === 'outer');
    const inner = out.find((f) => f.name === 'inner');
    expect(outer?.cyclomaticComplexity).toBe(2);
    expect(inner?.cyclomaticComplexity).toBe(2);
  });
});
