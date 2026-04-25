import { describe, it, expect } from 'vitest';
import { parseSource } from '../../src/core/ast.js';

function cc(code: string, file = 'src/test.ts'): number {
  const result = parseSource(file, code);
  expect(result.ok).toBe(true);
  return result.cyclomaticComplexity;
}

describe('cyclomatic complexity (JS/TS)', () => {
  it('empty file is CC=1', () => {
    expect(cc('')).toBe(1);
  });

  it('import-only file is CC=1', () => {
    expect(cc(`import x from 'react';\nexport const y = x;`)).toBe(1);
  });

  it('single if adds 1', () => {
    expect(cc(`if (x) { y(); }`)).toBe(2);
  });

  it('if/else if/else: 2 decisions = CC 3 (else does not count)', () => {
    expect(cc(`if (a) {} else if (b) {} else {}`)).toBe(3);
  });

  it('switch with 4 cases (3 case + 1 default) = CC 4 (default does not count)', () => {
    expect(
      cc(`switch (x) { case 1: break; case 2: break; case 3: break; default: break; }`),
    ).toBe(4);
  });

  it('logical && chain — each operator adds 1', () => {
    // `a && b && c` has two LogicalExpression nodes -> +2; CC=3.
    expect(cc(`const r = a && b && c;`)).toBe(3);
  });

  it('logical || and ?? both count', () => {
    // JS forbids mixing || and ?? without parens — wrap to keep the parser happy.
    expect(cc(`const r = (a || b) ?? c;`)).toBe(3);
  });

  it('ternary adds 1', () => {
    expect(cc(`const r = a ? b : c;`)).toBe(2);
  });

  it('for / for-in / for-of each add 1', () => {
    expect(cc(`for (let i=0;i<n;i++) {}`)).toBe(2);
    expect(cc(`for (const k in o) {}`)).toBe(2);
    expect(cc(`for (const v of a) {}`)).toBe(2);
  });

  it('while + do-while each add 1', () => {
    expect(cc(`while (x) { y(); }`)).toBe(2);
    expect(cc(`do { y(); } while (x);`)).toBe(2);
  });

  it('try/catch — only catch adds 1', () => {
    expect(cc(`try { f(); } catch (e) { g(); }`)).toBe(2);
  });

  it('optional chaining does NOT count', () => {
    expect(cc(`const r = a?.b?.c;`)).toBe(1);
  });

  it('nested loops add up', () => {
    expect(cc(`for (let i=0;i<n;i++) { for (let j=0;j<m;j++) { x(); } }`)).toBe(3);
  });

  it('module + functions: complexity sums across the whole file', () => {
    const code = `
      function a(x) { if (x) return 1; return 0; }
      function b(x) { for (const y of x) { if (y) f(); } }
    `;
    // a: 1 if = +1; b: 1 for + 1 if = +2. Total decisions=3 -> CC=4.
    expect(cc(code)).toBe(4);
  });
});
