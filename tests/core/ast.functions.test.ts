import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseSource } from '../../src/core/ast.js';
import type { FunctionInfo } from '../../src/core/ast.js';

function fns(code: string, file = 'src/test.ts'): FunctionInfo[] {
  const r = parseSource(file, code);
  expect(r.ok).toBe(true);
  return r.functions;
}

describe('per-function CC (JS/TS)', () => {
  it('keeps parseSource orchestration below the hotspot review budget', () => {
    const source = readFileSync(join(process.cwd(), 'src/core/ast.ts'), 'utf8');
    const out = fns(source, 'src/core/ast.ts');
    const parser = out.find((fn) => fn.name === 'parseSource');

    expect(parser).toBeDefined();
    expect(parser!.cyclomaticComplexity).toBeLessThanOrEqual(8);
  });

  it('keeps high-complexity AST traversal logic out of anonymous callbacks', () => {
    const source = readFileSync(join(process.cwd(), 'src/core/ast.ts'), 'utf8');
    const out = fns(source, 'src/core/ast.ts');
    const anonymousHotspots = out.filter(
      (fn) => fn.name === '<anonymous>' && fn.cyclomaticComplexity >= 15,
    );

    expect(anonymousHotspots).toEqual([]);
  });

  it('keeps member-expression helpers out of the AST orchestrator hotspot', () => {
    const astSource = readFileSync(join(process.cwd(), 'src/core/ast.ts'), 'utf8');
    const astFns = fns(astSource, 'src/core/ast.ts');
    expect(astFns.some((fn) => fn.name === 'collectMemberReadIdents')).toBe(false);
    expect(astFns.some((fn) => fn.name === 'babelQualifiedMemberName')).toBe(false);

    const memberSource = readFileSync(join(process.cwd(), 'src/core/astMembers.ts'), 'utf8');
    const memberFns = fns(memberSource, 'src/core/astMembers.ts');
    const helpers = ['collectMemberReadIdents', 'babelQualifiedMemberName'];

    for (const helper of helpers) {
      const fn = memberFns.find((candidate) => candidate.name === helper);
      expect(fn).toBeDefined();
      expect(fn!.cyclomaticComplexity).toBeLessThanOrEqual(5);
    }
  });

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

  it('counts switch cases logical operators and conditionals as decision points', () => {
    const out = fns(`function foo(x) {
      switch (x.kind) {
        case 'a':
          return x.a && x.b ? 1 : 2;
        default:
          return x.c ?? 0;
      }
    }`);

    expect(out).toHaveLength(1);
    expect(out[0].cyclomaticComplexity).toBe(5);
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

  it('private and string-literal methods keep useful names', () => {
    const out = fns(`class A { #secret() { return 1; } }
const obj = { "go-now"() { return 2; } };`);
    expect(out.map((fn) => fn.name)).toEqual(expect.arrayContaining(['A.#secret', 'go-now']));
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
