import { describe, it, expect } from 'vitest';
import { goAdapter } from '../../../src/core/languages/goAdapter.js';

async function callSites(src: string): Promise<string[]> {
  const result = await goAdapter.parse('t.go', src);
  expect(result.ok).toBe(true);
  return [...result.callSites].sort();
}

describe('callSites (Go)', () => {
  it('empty file has no call sites', async () => {
    expect(await callSites('package p\n')).toEqual([]);
  });

  it('captures bare function calls', async () => {
    const src = 'package p\nfunc run() { foo(); bar() }\n';
    expect(await callSites(src)).toEqual(['bar', 'foo']);
  });

  it('captures package-qualified calls (selector_expression)', async () => {
    const src = 'package p\nimport "fmt"\nfunc run() { fmt.Println("hi") }\n';
    expect(await callSites(src)).toEqual(['Println']);
  });

  it('captures method calls on receivers', async () => {
    const src = 'package p\nfunc run(b *Builder) { b.Build() }\n';
    expect(await callSites(src)).toEqual(['Build']);
  });

  it('captures chained calls', async () => {
    const src = 'package p\nfunc run() { a().b().c() }\n';
    expect(await callSites(src)).toEqual(['a', 'b', 'c']);
  });

  it('uniques duplicate calls', async () => {
    const src = 'package p\nfunc run() { foo(); foo(); foo() }\n';
    expect(await callSites(src)).toEqual(['foo']);
  });
});
