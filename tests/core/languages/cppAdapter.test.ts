import { describe, it, expect } from 'vitest';
import { cppAdapter } from '../../../src/core/languages/cppAdapter.js';

describe('cppAdapter.parse', () => {
  it('parses a trivial C++ file', async () => {
    const r = await cppAdapter.parse('main.cpp', `int main() { return 0; }\n`);
    expect(r.ok).toBe(true);
    expect(r.lineCount).toBe(2);
  });

  it('handles parse errors gracefully (tree-sitter recovery)', async () => {
    const r = await cppAdapter.parse('broken.cpp', `int oops( { return 0; }\n`);
    expect(r.ok).toBe(true);
  });
});

describe('cppAdapter.imports (#include)', () => {
  it('extracts a quoted include', async () => {
    const r = await cppAdapter.parse('a.cpp', `#include "foo.h"\nint main() {}\n`);
    expect(r.imports.map((i) => i.source)).toEqual(['foo.h']);
  });

  it('extracts a system include', async () => {
    const r = await cppAdapter.parse('a.cpp', `#include <vector>\nint main() {}\n`);
    expect(r.imports[0].source).toBe('vector');
  });

  it('extracts multiple includes in order', async () => {
    const r = await cppAdapter.parse(
      'a.cpp',
      `#include <string>\n#include "util/helper.h"\nint main() {}\n`,
    );
    expect(r.imports.map((i) => i.source)).toEqual(['string', 'util/helper.h']);
  });
});

describe('cppAdapter.exports', () => {
  it('captures top-level function definitions', async () => {
    const r = await cppAdapter.parse(
      'a.cpp',
      `void greet() {}\nint compute(int x) { return x; }\n`,
    );
    const names = r.exports.filter((e) => e.kind === 'function').map((e) => e.name);
    expect(names).toContain('greet');
    expect(names).toContain('compute');
  });

  it('captures top-level class / struct / enum', async () => {
    const r = await cppAdapter.parse(
      'a.cpp',
      `class Widget { public: int n; };\nstruct Point { int x; int y; };\nenum Color { Red, Green };\n`,
    );
    const byName = new Map(r.exports.map((e) => [e.name, e.kind]));
    expect(byName.get('Widget')).toBe('class');
    expect(byName.get('Point')).toBe('class');
    expect(byName.get('Color')).toBe('enum');
  });

  it('captures using-aliases as type', async () => {
    const r = await cppAdapter.parse('a.cpp', `using IntPair = std::pair<int,int>;\n`);
    const e = r.exports.find((x) => x.name === 'IntPair');
    expect(e?.kind).toBe('type');
  });
});

describe('cppAdapter cyclomatic complexity', () => {
  async function cc(code: string): Promise<number> {
    const r = await cppAdapter.parse('test.cpp', code);
    expect(r.ok).toBe(true);
    return r.cyclomaticComplexity;
  }

  it('empty file is CC=1', async () => {
    expect(await cc('')).toBe(1);
  });

  it('if adds 1', async () => {
    expect(await cc(`int f(int x) { if (x > 0) { return 1; } return 0; }`)).toBe(2);
  });

  it('for and while each add 1', async () => {
    expect(
      await cc(`int f() {
  for (int i = 0; i < 10; ++i) {}
  int j = 0;
  while (j < 10) { ++j; }
  return 0;
}`),
    ).toBe(3);
  });

  it('switch cases each count, default does not', async () => {
    // 2 case + default => CC 3
    expect(
      await cc(`int f(int x) {
  switch (x) {
    case 1: return 1;
    case 2: return 2;
    default: return 0;
  }
}`),
    ).toBe(3);
  });
});

describe('cppAdapter per-function CC', () => {
  it('emits one entry per top-level function', async () => {
    const r = await cppAdapter.parse(
      'a.cpp',
      `int one() { return 1; }
int two(int x) { if (x > 0) return 1; else return 0; }
`,
    );
    expect(r.functions.length).toBeGreaterThanOrEqual(2);
    const map = new Map(r.functions.map((f) => [f.name, f.cyclomaticComplexity]));
    expect(map.get('one')).toBe(1);
    expect(map.get('two')).toBe(2);
  });

  it('names methods inside class as Type.method', async () => {
    const r = await cppAdapter.parse(
      'a.cpp',
      `class Widget {
public:
  void make() {}
  int name() { return 0; }
};
`,
    );
    const names = r.functions.map((f) => f.name).sort();
    expect(names).toContain('Widget.make');
    expect(names).toContain('Widget.name');
  });

  it('names out-of-line methods as Class.method', async () => {
    const r = await cppAdapter.parse(
      'a.cpp',
      `class Widget { public: void make(); };
void Widget::make() {}
`,
    );
    expect(r.functions.some((f) => f.name === 'Widget.make')).toBe(true);
  });
});

describe('cppAdapter call sites', () => {
  it('captures function calls and dedupes', async () => {
    const r = await cppAdapter.parse(
      'a.cpp',
      `void main() {
  greet();
  greet();
  process(42);
}
`,
    );
    expect(new Set(r.callSites)).toEqual(new Set(['greet', 'process']));
  });
});

describe('cppAdapter package name routing', () => {
  it('classifies external paths via toPackageName', () => {
    expect(cppAdapter.toPackageName('vector')).toBe('vector');
    expect(cppAdapter.toPackageName('boost/optional.hpp')).toBe('boost');
  });

  it('returns null for relative paths', () => {
    expect(cppAdapter.toPackageName('./foo.h')).toBeNull();
    expect(cppAdapter.toPackageName('../bar/baz.h')).toBeNull();
  });
});
