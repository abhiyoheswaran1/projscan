import { describe, it, expect } from 'vitest';
import { rubyAdapter } from '../../../src/core/languages/rubyAdapter.js';

async function fns(code: string) {
  const r = await rubyAdapter.parse('test.rb', code);
  expect(r.ok).toBe(true);
  return r.functions;
}

describe('per-function CC (Ruby)', () => {
  it('top-level def is CC 1', async () => {
    const out = await fns(`def foo\n  1\nend\n`);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('foo');
    expect(out[0].cyclomaticComplexity).toBe(1);
  });

  it('class method named Class.method', async () => {
    const out = await fns(`class A\n  def m(x)\n    if x then 1 else 0 end\n  end\nend\n`);
    const m = out.find((f) => f.name === 'A.m');
    expect(m).toBeDefined();
    expect(m?.cyclomaticComplexity).toBe(2);
  });

  it('case + when counts each when (case itself does not)', async () => {
    const out = await fns(`def foo(x)\n  case x\n  when 1 then 1\n  when 2 then 2\n  else 0\n  end\nend\n`);
    expect(out[0].cyclomaticComplexity).toBe(3);
  });

  it('rescue adds 1', async () => {
    const out = await fns(`def foo\n  begin\n    risky\n  rescue => e\n    nil\n  end\nend\n`);
    expect(out[0].cyclomaticComplexity).toBe(2);
  });
});
