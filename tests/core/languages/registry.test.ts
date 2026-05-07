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
    // .lua isn't supported as of 1.8; if it ever ships, swap this for
    // another genuinely-unsupported extension.
    expect(getAdapterFor('script.lua')).toBeUndefined();
  });

  it('returns the Swift adapter for .swift (1.8+)', () => {
    expect(getAdapterFor('Sources/App/Main.swift')?.id).toBe('swift');
  });

  it('returns the Kotlin adapter for .kt / .kts (1.7+)', () => {
    expect(getAdapterFor('src/main/kotlin/com/example/Main.kt')?.id).toBe('kotlin');
    expect(getAdapterFor('build.gradle.kts')?.id).toBe('kotlin');
  });

  it('returns the C++ adapter for .cpp / .cc / .h / .hpp (1.7+)', () => {
    expect(getAdapterFor('src/main.cpp')?.id).toBe('cpp');
    expect(getAdapterFor('src/util.cc')?.id).toBe('cpp');
    expect(getAdapterFor('include/foo.h')?.id).toBe('cpp');
    expect(getAdapterFor('include/foo.hpp')?.id).toBe('cpp');
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

  it('returns the Rust adapter for .rs', () => {
    expect(getAdapterFor('src/main.rs')?.id).toBe('rust');
  });

  it('returns the PHP adapter for .php', () => {
    expect(getAdapterFor('src/Models/User.php')?.id).toBe('php');
  });

  it('returns the C# adapter for .cs', () => {
    expect(getAdapterFor('Models/User.cs')?.id).toBe('csharp');
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
