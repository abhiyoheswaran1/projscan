import { describe, it, expect } from 'vitest';
import { goAdapter } from '../../../src/core/languages/goAdapter.js';

async function fns(code: string) {
  const r = await goAdapter.parse('test.go', code);
  expect(r.ok).toBe(true);
  return r.functions;
}

describe('per-function CC (Go)', () => {
  it('top-level func is CC 1', async () => {
    const out = await fns(`package p\nfunc Foo() int { return 1 }\n`);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('Foo');
    expect(out[0].cyclomaticComplexity).toBe(1);
  });

  it('method named Receiver.Method', async () => {
    const out = await fns(`package p\ntype T struct{}\nfunc (t *T) Bar(x int) int { if x > 0 { return 1 }; return 0 }\n`);
    const bar = out.find((f) => f.name === 'T.Bar');
    expect(bar).toBeDefined();
    expect(bar?.cyclomaticComplexity).toBe(2);
  });

  it('switch case adds 1 per case (default does not count)', async () => {
    const out = await fns(`package p\nfunc F(x int) int {\n  switch x {\n  case 1: return 1\n  case 2: return 2\n  default: return 0\n  }\n}\n`);
    expect(out[0].cyclomaticComplexity).toBe(3);
  });

  it('&& and || each add 1', async () => {
    const out = await fns(`package p\nfunc F(a, b, c bool) bool { return a && b || c }\n`);
    expect(out[0].cyclomaticComplexity).toBe(3);
  });
});
