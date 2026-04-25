import { describe, it, expect } from 'vitest';
import { javaAdapter } from '../../../src/core/languages/javaAdapter.js';

describe('javaAdapter', () => {
  describe('parse', () => {
    it('returns ok:true for an empty file', async () => {
      const r = await javaAdapter.parse('Empty.java', '');
      expect(r.ok).toBe(true);
      expect(r.imports).toEqual([]);
      expect(r.exports).toEqual([]);
      expect(r.cyclomaticComplexity).toBe(1);
    });

    it('parses a hello world class', async () => {
      const src = [
        'package com.example;',
        '',
        'public class Hello {',
        '    public static void main(String[] args) {',
        '        System.out.println("hi");',
        '    }',
        '}',
        '',
      ].join('\n');
      const r = await javaAdapter.parse('Hello.java', src);
      expect(r.ok).toBe(true);
      const exportNames = r.exports.map((e) => e.name);
      expect(exportNames).toContain('Hello');
    });
  });

  describe('imports', () => {
    it('captures simple type imports', async () => {
      const src = [
        'package com.example;',
        'import java.util.List;',
        'import java.util.Map;',
        'public class A {}',
      ].join('\n');
      const r = await javaAdapter.parse('A.java', src);
      const sources = r.imports.map((i) => i.source).sort();
      expect(sources).toEqual(['java.util.List', 'java.util.Map']);
    });

    it('captures wildcard imports with .* suffix', async () => {
      const src = ['import java.util.*;', 'public class A {}'].join('\n');
      const r = await javaAdapter.parse('A.java', src);
      expect(r.imports.map((i) => i.source)).toEqual(['java.util.*']);
    });

    it('captures static imports', async () => {
      const src = [
        'import static java.lang.Math.PI;',
        'import static java.util.Arrays.asList;',
        'public class A {}',
      ].join('\n');
      const r = await javaAdapter.parse('A.java', src);
      const sources = r.imports.map((i) => i.source).sort();
      expect(sources).toEqual(['java.lang.Math.PI', 'java.util.Arrays.asList']);
    });
  });

  describe('exports (public visibility only)', () => {
    it('exports a public class', async () => {
      const src = 'public class Foo {}';
      const r = await javaAdapter.parse('Foo.java', src);
      expect(r.exports.map((e) => e.name)).toEqual(['Foo']);
      expect(r.exports[0].kind).toBe('class');
    });

    it('exports a public interface', async () => {
      const src = 'public interface Bar {}';
      const r = await javaAdapter.parse('Bar.java', src);
      expect(r.exports[0].kind).toBe('interface');
    });

    it('exports a public enum', async () => {
      const src = 'public enum Status { OPEN, CLOSED }';
      const r = await javaAdapter.parse('Status.java', src);
      expect(r.exports[0].kind).toBe('enum');
    });

    it('exports a public record (Java 14+)', async () => {
      const src = 'public record Point(int x, int y) {}';
      const r = await javaAdapter.parse('Point.java', src);
      expect(r.exports.map((e) => e.name)).toEqual(['Point']);
    });

    it('does NOT export package-private classes', async () => {
      const src = 'class Internal {}';
      const r = await javaAdapter.parse('Internal.java', src);
      expect(r.exports).toEqual([]);
    });

    it('does NOT export private classes', async () => {
      const src = 'private class Internal {}';
      const r = await javaAdapter.parse('Internal.java', src);
      expect(r.exports).toEqual([]);
    });
  });

  describe('cyclomatic complexity', () => {
    async function cc(src: string): Promise<number> {
      const r = await javaAdapter.parse('t.java', src);
      expect(r.ok).toBe(true);
      return r.cyclomaticComplexity;
    }

    it('CC=1 for an empty file', async () => {
      expect(await cc('')).toBe(1);
    });

    it('CC=1 for a class with no decisions', async () => {
      expect(await cc('public class A { void m() {} }')).toBe(1);
    });

    it('counts if', async () => {
      expect(await cc('public class A { void m() { if (x) {} } }')).toBe(2);
    });

    it('counts ternary', async () => {
      expect(await cc('public class A { int m(int x) { return x > 0 ? 1 : -1; } }')).toBe(2);
    });

    it('counts for / enhanced for / while', async () => {
      const src = 'public class A { void m(int[] xs) { for(int i=0;i<10;i++){} for(int x: xs){} while(x){} } }';
      expect(await cc(src)).toBe(4);
    });

    it('counts catch (not finally, not try)', async () => {
      const src = 'public class A { void m() { try { f(); } catch(Exception e) {} finally {} } }';
      expect(await cc(src)).toBe(2);
    });

    it('counts case but not default', async () => {
      const src = 'public class A { void m(int x) { switch(x) { case 1: break; case 2: break; default: break; } } }';
      // 2 case branches → 2 decisions → CC 3.
      expect(await cc(src)).toBe(3);
    });

    it('counts && and ||', async () => {
      const src = 'public class A { boolean m() { return a && b || c; } }';
      // 1 && + 1 || = 2 decisions → CC 3.
      expect(await cc(src)).toBe(3);
    });
  });

  describe('callSites', () => {
    it('captures method invocations', async () => {
      const src = 'public class A { void m() { foo(); bar.baz(); } }';
      const r = await javaAdapter.parse('A.java', src);
      const calls = [...r.callSites].sort();
      expect(calls).toContain('foo');
      expect(calls).toContain('baz');
    });

    it('captures constructor calls (object_creation_expression)', async () => {
      const src = 'public class A { void m() { Foo f = new Foo(); new com.x.Bar(); } }';
      const r = await javaAdapter.parse('A.java', src);
      const calls = [...r.callSites].sort();
      expect(calls).toContain('Foo');
      expect(calls).toContain('Bar');
    });
  });

  describe('toPackageName', () => {
    it('returns the package portion of a type import', () => {
      expect(javaAdapter.toPackageName('java.util.List')).toBe('java.util');
    });

    it('returns the full path for a wildcard import', () => {
      expect(javaAdapter.toPackageName('java.util.*')).toBe('java.util');
    });

    it('returns null for an empty source', () => {
      expect(javaAdapter.toPackageName('')).toBe(null);
    });
  });

  describe('resolveImport', () => {
    it('resolves a typed import to <root>/com/foo/Bar.java', () => {
      const graphFiles = new Map<string, { relativePath: string }>([
        ['src/main/java/com/foo/Bar.java', { relativePath: 'src/main/java/com/foo/Bar.java' }],
        ['src/main/java/com/foo/Baz.java', { relativePath: 'src/main/java/com/foo/Baz.java' }],
      ]);
      const resolved = javaAdapter.resolveImport(
        'src/main/java/com/foo/Caller.java',
        'com.foo.Bar',
        graphFiles,
        { packageRoots: ['src/main/java'] },
      );
      expect(resolved).toBe('src/main/java/com/foo/Bar.java');
    });

    it('returns null for stdlib imports (no source-root match)', () => {
      const graphFiles = new Map<string, { relativePath: string }>([
        ['src/main/java/com/foo/Caller.java', { relativePath: 'src/main/java/com/foo/Caller.java' }],
      ]);
      const resolved = javaAdapter.resolveImport(
        'src/main/java/com/foo/Caller.java',
        'java.util.List',
        graphFiles,
        { packageRoots: ['src/main/java'] },
      );
      expect(resolved).toBe(null);
    });

    it('wildcard import picks the first .java file under that package dir', () => {
      const graphFiles = new Map<string, { relativePath: string }>([
        ['src/main/java/com/foo/A.java', { relativePath: 'src/main/java/com/foo/A.java' }],
        ['src/main/java/com/foo/B.java', { relativePath: 'src/main/java/com/foo/B.java' }],
      ]);
      const resolved = javaAdapter.resolveImport(
        'src/main/java/Caller.java',
        'com.foo.*',
        graphFiles,
        { packageRoots: ['src/main/java'] },
      );
      expect(resolved).toBe('src/main/java/com/foo/A.java');
    });
  });
});
