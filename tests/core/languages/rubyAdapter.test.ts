import { describe, it, expect } from 'vitest';
import { rubyAdapter } from '../../../src/core/languages/rubyAdapter.js';

describe('rubyAdapter', () => {
  describe('parse', () => {
    it('returns ok:true for an empty file', async () => {
      const r = await rubyAdapter.parse('empty.rb', '');
      expect(r.ok).toBe(true);
      expect(r.imports).toEqual([]);
      expect(r.exports).toEqual([]);
      expect(r.cyclomaticComplexity).toBe(1);
    });

    it('parses a tiny class', async () => {
      const src = "class Hello\n  def greet\n    puts 'hi'\n  end\nend\n";
      const r = await rubyAdapter.parse('hello.rb', src);
      expect(r.ok).toBe(true);
      expect(r.exports.map((e) => e.name)).toContain('Hello');
    });
  });

  describe('imports', () => {
    it('captures require', async () => {
      const r = await rubyAdapter.parse('t.rb', "require 'json'\n");
      expect(r.imports.map((i) => i.source)).toEqual(['json']);
    });

    it('captures require_relative', async () => {
      const r = await rubyAdapter.parse('t.rb', "require_relative 'helpers/util'\n");
      expect(r.imports.map((i) => i.source)).toEqual(['helpers/util']);
    });

    it('captures load', async () => {
      const r = await rubyAdapter.parse('t.rb', "load 'config.rb'\n");
      expect(r.imports.map((i) => i.source)).toEqual(['config.rb']);
    });

    it('captures autoload (path is the second argument)', async () => {
      const r = await rubyAdapter.parse('t.rb', "autoload :Foo, 'lib/foo'\n");
      expect(r.imports.map((i) => i.source)).toEqual(['lib/foo']);
    });

    it('does NOT capture random method calls', async () => {
      const r = await rubyAdapter.parse('t.rb', "puts('hello')\n");
      expect(r.imports).toEqual([]);
    });
  });

  describe('exports', () => {
    it('exports top-level class', async () => {
      const r = await rubyAdapter.parse('t.rb', 'class Foo\nend\n');
      expect(r.exports.map((e) => e.name)).toEqual(['Foo']);
      expect(r.exports[0].kind).toBe('class');
    });

    it('exports top-level module', async () => {
      const r = await rubyAdapter.parse('t.rb', 'module M\nend\n');
      expect(r.exports.map((e) => e.name)).toEqual(['M']);
    });

    it('exports top-level def', async () => {
      const r = await rubyAdapter.parse('t.rb', "def helper\n  'hi'\nend\n");
      expect(r.exports.map((e) => e.name)).toEqual(['helper']);
      expect(r.exports[0].kind).toBe('function');
    });

    it('does NOT export defs nested inside classes', async () => {
      const src = "class Foo\n  def bar\n  end\nend\n";
      const r = await rubyAdapter.parse('t.rb', src);
      expect(r.exports.map((e) => e.name)).toEqual(['Foo']);
    });
  });

  describe('cyclomatic complexity', () => {
    async function cc(src: string): Promise<number> {
      const r = await rubyAdapter.parse('t.rb', src);
      expect(r.ok).toBe(true);
      return r.cyclomaticComplexity;
    }

    it('CC=1 for an empty file', async () => {
      expect(await cc('')).toBe(1);
    });

    it('counts if', async () => {
      expect(await cc("if x\n  puts 'y'\nend\n")).toBe(2);
    });

    it('counts unless', async () => {
      expect(await cc("unless x\n  puts 'y'\nend\n")).toBe(2);
    });

    it('counts elsif (each adds 1; else does not)', async () => {
      const src = "if a\n  1\nelsif b\n  2\nelsif c\n  3\nelse\n  4\nend\n";
      // 1 if + 2 elsif = 3 decisions → CC 4.
      expect(await cc(src)).toBe(4);
    });

    it('counts while/until/for', async () => {
      const src = "while x do\nend\nuntil y do\nend\nfor i in xs do\nend\n";
      expect(await cc(src)).toBe(4);
    });

    it('counts when in case (case itself does not count)', async () => {
      const src = "case x\nwhen 1 then 'one'\nwhen 2 then 'two'\nend\n";
      // 2 when = 2 decisions → CC 3.
      expect(await cc(src)).toBe(3);
    });

    it('counts rescue', async () => {
      const src = "begin\n  f\nrescue StandardError\n  'oops'\nend\n";
      expect(await cc(src)).toBe(2);
    });

    it('counts && and ||', async () => {
      expect(await cc('r = a && b\n')).toBe(2);
      expect(await cc('r = a || b || c\n')).toBe(3);
    });

    it('counts ternary', async () => {
      expect(await cc("r = x > 0 ? 'pos' : 'neg'\n")).toBe(2);
    });
  });

  describe('callSites', () => {
    it('captures bare method calls', async () => {
      const r = await rubyAdapter.parse('t.rb', "foo()\nbar()\n");
      const calls = [...r.callSites].sort();
      expect(calls).toContain('foo');
      expect(calls).toContain('bar');
    });

    it('captures receiver method calls', async () => {
      const r = await rubyAdapter.parse('t.rb', "obj.method_name\n");
      expect(r.callSites).toContain('method_name');
    });

    it('does NOT include require/require_relative as call sites', async () => {
      const r = await rubyAdapter.parse('t.rb', "require 'json'\nrequire_relative 'sib'\nfoo()\n");
      expect(r.callSites).not.toContain('require');
      expect(r.callSites).not.toContain('require_relative');
      expect(r.callSites).toContain('foo');
    });
  });

  describe('toPackageName', () => {
    it('returns the gem name', () => {
      expect(rubyAdapter.toPackageName('json')).toBe('json');
    });

    it('returns the first segment of a slashed path', () => {
      expect(rubyAdapter.toPackageName('active_support/core_ext')).toBe('active_support');
    });

    it('returns null for relative imports', () => {
      expect(rubyAdapter.toPackageName('./helper')).toBe(null);
      expect(rubyAdapter.toPackageName('../helper')).toBe(null);
    });
  });

  describe('resolveImport', () => {
    it('resolves require_relative to a sibling file', () => {
      const graphFiles = new Map<string, { relativePath: string }>([
        ['lib/foo.rb', { relativePath: 'lib/foo.rb' }],
        ['lib/helper.rb', { relativePath: 'lib/helper.rb' }],
      ]);
      const resolved = rubyAdapter.resolveImport(
        'lib/foo.rb',
        './helper',
        graphFiles,
        { packageRoots: ['lib'] },
      );
      expect(resolved).toBe('lib/helper.rb');
    });

    it('resolves a require to lib/<path>.rb', () => {
      const graphFiles = new Map<string, { relativePath: string }>([
        ['lib/mygem/util.rb', { relativePath: 'lib/mygem/util.rb' }],
      ]);
      const resolved = rubyAdapter.resolveImport(
        'lib/mygem/main.rb',
        'mygem/util',
        graphFiles,
        { packageRoots: ['lib'] },
      );
      expect(resolved).toBe('lib/mygem/util.rb');
    });

    it('returns null for stdlib / gem requires (no source-root match)', () => {
      const graphFiles = new Map<string, { relativePath: string }>([
        ['lib/foo.rb', { relativePath: 'lib/foo.rb' }],
      ]);
      const resolved = rubyAdapter.resolveImport(
        'lib/foo.rb',
        'json',
        graphFiles,
        { packageRoots: ['lib'] },
      );
      expect(resolved).toBe(null);
    });
  });
});
