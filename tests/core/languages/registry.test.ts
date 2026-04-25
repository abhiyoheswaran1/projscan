import { describe, it, expect } from 'vitest';
import { getAdapterFor, isAdapterParseable, listAdapters } from '../../../src/core/languages/registry.js';

describe('language registry', () => {
  it('returns the JavaScript adapter for JS/TS extensions', () => {
    for (const ext of ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts']) {
      const adapter = getAdapterFor(`src/x${ext}`);
      expect(adapter, `for ${ext}`).toBeDefined();
      expect(adapter!.id).toBe('javascript');
    }
  });

  it('returns undefined for unknown extensions', () => {
    expect(getAdapterFor('README.md')).toBeUndefined();
    expect(getAdapterFor('Makefile')).toBeUndefined();
    expect(getAdapterFor('a.rs')).toBeUndefined();
  });

  it('returns the Go adapter for .go', () => {
    expect(getAdapterFor('cmd/main.go')?.id).toBe('go');
  });

  it('returns the Java adapter for .java', () => {
    expect(getAdapterFor('src/main/java/com/foo/Bar.java')?.id).toBe('java');
  });

  it('returns the Ruby adapter for .rb', () => {
    expect(getAdapterFor('lib/foo.rb')?.id).toBe('ruby');
  });

  it('is case-insensitive on extension', () => {
    expect(getAdapterFor('src/a.TS')?.id).toBe('javascript');
    expect(getAdapterFor('src/a.TSX')?.id).toBe('javascript');
  });

  it('isAdapterParseable mirrors adapter lookup', () => {
    expect(isAdapterParseable('src/a.ts')).toBe(true);
    expect(isAdapterParseable('README.md')).toBe(false);
  });

  it('listAdapters includes the JavaScript adapter', () => {
    const ids = listAdapters().map((a) => a.id);
    expect(ids).toContain('javascript');
  });

  it('never returns an adapter whose extension set excludes the queried extension', () => {
    const adapter = getAdapterFor('src/a.ts');
    expect(adapter?.extensions.has('.ts')).toBe(true);
  });
});
