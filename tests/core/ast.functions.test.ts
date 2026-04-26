import { describe, it, expect } from 'vitest';
import { parseSource } from '../../src/core/ast.js';
import type { FunctionInfo } from '../../src/core/ast.js';

function fns(code: string, file = 'src/test.ts'): FunctionInfo[] {
  const r = parseSource(file, code);
  expect(r.ok).toBe(true);
  return r.functions;
}

describe('per-function CC (JS/TS)', () => {
  it('empty file has no functions', () => {
    expect(fns('')).toEqual([]);
  });

  it('top-level function declaration is captured with CC 1', () => {
    const out = fns(`function foo() { return 1; }`);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('foo');
    expect(out[0].cyclomaticComplexity).toBe(1);
    expect(out[0].line).toBe(1);
  });

  it('function with one if has CC 2', () => {
    const out = fns(`function foo(x) { if (x) return 1; return 0; }`);
    expect(out).toHaveLength(1);
    expect(out[0].cyclomaticComplexity).toBe(2);
  });

  it('arrow assigned to const is named after the binding', () => {
    const out = fns(`const foo = (x) => x ? 1 : 0;`);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('foo');
    expect(out[0].cyclomaticComplexity).toBe(2);
  });

  it('class method is named Class.method', () => {
    const out = fns(`class A { m(x) { return x ? 1 : 0; } }`);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('A.m');
    expect(out[0].cyclomaticComplexity).toBe(2);
  });

  it('nested functions emit separate entries; outer CC excludes inner decisions', () => {
    const out = fns(`function outer(x) {
      if (x) return 1;
      function inner(y) {
        if (y) return 2;
        return 3;
      }
      return inner(x);
    }`);
    expect(out).toHaveLength(2);
    const outer = out.find((f) => f.name === 'outer');
    const inner = out.find((f) => f.name === 'inner');
    expect(outer?.cyclomaticComplexity).toBe(2);
    expect(inner?.cyclomaticComplexity).toBe(2);
  });

  it('export default function gets name "default" when anonymous', () => {
    const out = fns(`export default function() { return 1; }`);
    expect(out).toHaveLength(1);
    expect(out[0].name).toBe('default');
  });

  it('endLine is tracked', () => {
    const out = fns(`function foo() {\n  return 1;\n}`);
    expect(out[0].line).toBe(1);
    expect(out[0].endLine).toBe(3);
  });
});
