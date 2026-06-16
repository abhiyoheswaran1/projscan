import { describe, it, expect } from 'vitest';
import { kotlinAdapter } from '../../../src/core/languages/kotlinAdapter.js';

describe('kotlinAdapter.parse', () => {
  it('parses a trivial Kotlin file', async () => {
    const r = await kotlinAdapter.parse('main.kt', `fun main() {}\n`);
    expect(r.ok).toBe(true);
    expect(r.lineCount).toBe(2);
  });

  it('handles parse errors gracefully (tree-sitter recovery)', async () => {
    const r = await kotlinAdapter.parse('broken.kt', `fun oops( {}\n`);
    expect(r.ok).toBe(true);
  });
});

describe('kotlinAdapter.imports', () => {
  it('extracts a simple import', async () => {
    const r = await kotlinAdapter.parse('a.kt', `import com.example.Foo\nfun main() {}\n`);
    expect(r.imports.map((i) => i.source)).toEqual(['com.example.Foo']);
  });

  it('extracts a wildcard import', async () => {
    const r = await kotlinAdapter.parse('a.kt', `import com.example.*\nfun main() {}\n`);
    expect(r.imports[0].source).toBe('com.example.*');
  });

  it('handles aliased imports', async () => {
    const r = await kotlinAdapter.parse('a.kt', `import com.example.Foo as MyFoo\nfun main() {}\n`);
    expect(r.imports).toHaveLength(1);
    expect(r.imports[0].source).toBe('com.example.Foo');
    expect(r.imports[0].specifiers).toEqual(['MyFoo']);
  });
});

describe('kotlinAdapter.exports (visibility-based)', () => {
  it('captures public fun but not private fun', async () => {
    const r = await kotlinAdapter.parse('a.kt', `fun publicFn() {}\nprivate fun privateFn() {}\n`);
    const names = r.exports.map((e) => e.name);
    expect(names).toContain('publicFn');
    expect(names).not.toContain('privateFn');
  });

  it('captures class / interface / enum class with the right kinds', async () => {
    const src = `class Widget { val name = "" }
interface Drawable { fun draw() }
enum class Color { RED, GREEN, BLUE }
private class Hidden
`;
    const r = await kotlinAdapter.parse('a.kt', src);
    const byName = new Map(r.exports.map((e) => [e.name, e.kind]));
    expect(byName.get('Widget')).toBe('class');
    expect(byName.get('Drawable')).toBe('interface');
    expect(byName.get('Color')).toBe('enum');
    expect(byName.has('Hidden')).toBe(false);
  });

  it('captures object declarations as classes', async () => {
    const r = await kotlinAdapter.parse('a.kt', `object Singleton { fun get() = 1 }\n`);
    expect(r.exports.find((e) => e.name === 'Singleton')?.kind).toBe('class');
  });
});

describe('kotlinAdapter cyclomatic complexity', () => {
  async function cc(code: string): Promise<number> {
    const r = await kotlinAdapter.parse('test.kt', code);
    expect(r.ok).toBe(true);
    return r.cyclomaticComplexity;
  }

  it('empty file is CC=1', async () => {
    expect(await cc('')).toBe(1);
  });

  it('if adds 1', async () => {
    expect(await cc(`fun f(x: Int) { if (x > 0) { } }`)).toBe(2);
  });

  it('for and while each add 1', async () => {
    expect(
      await cc(`fun f() {
  for (i in 0..10) {}
  var j = 0
  while (j < 10) { j += 1 }
}`),
    ).toBe(3);
  });
});

describe('kotlinAdapter per-function CC', () => {
  it('emits one entry per function with the right CC', async () => {
    const r = await kotlinAdapter.parse(
      'a.kt',
      `fun one() {}
fun two(x: Int): Int = if (x > 0) 1 else 0
`,
    );
    expect(r.functions.length).toBeGreaterThanOrEqual(2);
    const map = new Map(r.functions.map((f) => [f.name, f.cyclomaticComplexity]));
    expect(map.get('one')).toBe(1);
    expect(map.get('two')).toBe(2);
  });

  it('names methods inside class as Type.method', async () => {
    const r = await kotlinAdapter.parse(
      'a.kt',
      `class Widget {
  fun make(): Widget = this
  fun name(): String = "w"
}
`,
    );
    const names = r.functions.map((f) => f.name).sort();
    expect(names).toContain('Widget.make');
    expect(names).toContain('Widget.name');
  });
});

describe('kotlinAdapter call sites', () => {
  it('captures bare function calls and dedupes', async () => {
    const r = await kotlinAdapter.parse(
      'a.kt',
      `fun main() {
  greet()
  greet()
  process(42)
}
`,
    );
    expect(new Set(r.callSites)).toEqual(new Set(['greet', 'process']));
  });
});

describe('kotlinAdapter package name routing', () => {
  it('classifies external paths via toPackageName', () => {
    expect(kotlinAdapter.toPackageName('java.util.List')).toBe('java');
    expect(kotlinAdapter.toPackageName('kotlinx.coroutines.flow')).toBe('kotlinx');
  });

  it('returns null for empty input', () => {
    expect(kotlinAdapter.toPackageName('')).toBeNull();
  });
});
