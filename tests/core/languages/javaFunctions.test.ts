import { describe, it, expect } from 'vitest';
import { javaAdapter } from '../../../src/core/languages/javaAdapter.js';

async function fns(code: string) {
  const r = await javaAdapter.parse('Test.java', code);
  expect(r.ok).toBe(true);
  return r.functions;
}

describe('per-function CC (Java)', () => {
  it('method named Class.method', async () => {
    const out = await fns(`public class A { int foo() { return 1; } }`);
    const foo = out.find((f) => f.name === 'A.foo');
    expect(foo).toBeDefined();
    expect(foo?.cyclomaticComplexity).toBe(1);
  });

  it('if + ternary + && counted', async () => {
    const out = await fns(
      `public class A { int foo(int x) { if (x > 0 && x < 10) { return x > 5 ? 1 : 0; } return 0; } }`,
    );
    const foo = out.find((f) => f.name === 'A.foo');
    // if: +1, &&: +1, ternary: +1 → CC 4
    expect(foo?.cyclomaticComplexity).toBe(4);
  });

  it('constructor named Class.<init>', async () => {
    const out = await fns(`public class A { public A() { } }`);
    expect(out.some((f) => f.name === 'A.<init>')).toBe(true);
  });

  it('switch case (without default) counts each label', async () => {
    const out = await fns(
      `public class A { int foo(int x) { switch(x) { case 1: return 1; case 2: return 2; default: return 0; } } }`,
    );
    const foo = out.find((f) => f.name === 'A.foo');
    expect(foo?.cyclomaticComplexity).toBe(3);
  });
});
