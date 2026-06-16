import { describe, it, expect } from 'vitest';
import { parseSource } from '../../src/core/ast.js';
import type { FunctionInfo } from '../../src/core/ast.js';

function fns(code: string, file = 'src/test.ts'): FunctionInfo[] {
  const r = parseSource(file, code);
  expect(r.ok).toBe(true);
  return r.functions;
}

describe('FunctionInfo.references (1.6+)', () => {
  it('captures rightmost identifier of a member-expression read', () => {
    const out = fns(`function f() { const cmd = process.env.MY_CMD; return cmd; }`);
    expect(out).toHaveLength(1);
    // process.env.MY_CMD: rightmost-of-each-link → MY_CMD, env
    expect(out[0].references).toEqual(expect.arrayContaining(['env', 'MY_CMD']));
    expect(out[0].memberReferences).toEqual(expect.arrayContaining(['process.env.MY_CMD']));
    expect(out[0].callSites ?? []).not.toContain('env');
    expect(out[0].callSites ?? []).not.toContain('MY_CMD');
  });

  it('does NOT add member-expression read names to callSites', () => {
    // Regression: a bug that put `env` into callSites instead of references
    // would still let the same-function taint test pass, but break other
    // consumers (e.g. impact analysis) that read callSites.
    const out = fns(`function f() { return req.body.userId; }`);
    expect(out).toHaveLength(1);
    expect(out[0].callSites ?? []).toEqual([]);
    expect(out[0].references).toEqual(expect.arrayContaining(['body', 'userId']));
  });

  it('skips MemberExpressions in callee position (those go to callSites)', () => {
    const out = fns(`function f() { obj.method(); arr.push(1); }`);
    expect(out).toHaveLength(1);
    // method and push are CALLED, so they belong to callSites, not references.
    expect(out[0].callSites).toEqual(expect.arrayContaining(['method', 'push']));
    expect(out[0].references ?? []).not.toContain('method');
    expect(out[0].references ?? []).not.toContain('push');
  });

  it('captures sub-MemberExpression reads even when the outer is a callee', () => {
    // For `req.body.userId.toString()`, callSites should include `toString`
    // and references should include `body` and `userId` (the sub-chain that
    // is read, not called). Without this, taint would miss `req.body`-shaped
    // sources hidden behind a method call.
    const out = fns(`function f() { return req.body.userId.toString(); }`);
    expect(out).toHaveLength(1);
    expect(out[0].callSites).toEqual(expect.arrayContaining(['toString']));
    expect(out[0].references).toEqual(expect.arrayContaining(['body', 'userId']));
  });

  it('deduplicates repeated reads', () => {
    const out = fns(`function f() {
  const a = process.env.X;
  const b = process.env.Y;
  return a + b;
}`);
    expect(out).toHaveLength(1);
    const refs = out[0].references ?? [];
    // env appears twice in source, once in references.
    expect(refs.filter((r) => r === 'env')).toHaveLength(1);
  });

  it('does not capture computed-property accesses (a[i])', () => {
    const out = fns(`function f(items, i) { return items[i]; }`);
    expect(out).toHaveLength(1);
    // No capturable rightmost identifier; references should be empty
    // for this body.
    expect(out[0].references ?? []).toEqual([]);
  });

  it('per-function isolation: nested functions get their own references', () => {
    // The outer reads process.env; the inner reads req.body. Each function
    // should report its OWN reads, not the union.
    const out = fns(`function outer() {
  const a = process.env.X;
  function inner() {
    return req.body;
  }
  return a + inner();
}`);
    const outer = out.find((f) => f.name === 'outer');
    const inner = out.find((f) => f.name === 'inner');
    expect(outer).toBeDefined();
    expect(inner).toBeDefined();
    // outer reads env / X but NOT body.
    expect(outer!.references).toEqual(expect.arrayContaining(['env', 'X']));
    expect(outer!.references ?? []).not.toContain('body');
    // inner reads body but NOT env.
    expect(inner!.references).toEqual(expect.arrayContaining(['body']));
    expect(inner!.references ?? []).not.toContain('env');
  });

  it('tracks direct calls and destructured member aliases separately from member calls', () => {
    const out = fns(`function f() {
  const { query: runQuery } = pool;
  runQuery('select 1');
  cache.query('value');
}`);
    expect(out).toHaveLength(1);
    expect(out[0].callSites).toEqual(expect.arrayContaining(['runQuery', 'query']));
    expect(out[0].directCallSites).toEqual(['runQuery']);
    expect(out[0].memberCallSites).toEqual(['cache.query']);
    expect(out[0].memberAliases).toEqual(['runQuery=pool.query']);
  });

  it('captures reads inside arrow callbacks (the taint default-source case)', () => {
    // The most common real-world pattern: a route handler reads
    // process.env inside an inline arrow.
    const out = fns(`app.get('/x', (req, res) => {
  const v = process.env.SECRET;
  res.send(v);
});`);
    const arrow = out.find((f) => f.name === '<anonymous>');
    expect(arrow).toBeDefined();
    expect(arrow!.references).toEqual(expect.arrayContaining(['env', 'SECRET']));
  });
});
