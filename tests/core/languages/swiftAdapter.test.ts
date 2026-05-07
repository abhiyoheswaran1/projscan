import { describe, it, expect } from 'vitest';
import { swiftAdapter } from '../../../src/core/languages/swiftAdapter.js';

describe('swiftAdapter.parse', () => {
  it('parses a trivial Swift file', async () => {
    const r = await swiftAdapter.parse('main.swift', `print("hi")\n`);
    expect(r.ok).toBe(true);
    expect(r.lineCount).toBe(2);
  });

  it('handles parse errors gracefully (tree-sitter recovery)', async () => {
    const r = await swiftAdapter.parse('broken.swift', `func oops( {}\n`);
    expect(r.ok).toBe(true);
  });
});

describe('swiftAdapter.imports', () => {
  it('extracts a simple import', async () => {
    const r = await swiftAdapter.parse('a.swift', `import Foundation\nfunc main() {}\n`);
    expect(r.imports.map((i) => i.source)).toEqual(['Foundation']);
  });

  it('extracts dotted submodule imports', async () => {
    const r = await swiftAdapter.parse('a.swift', `import UIKit.UIView\n`);
    expect(r.imports[0].source).toBe('UIKit.UIView');
  });

  it('extracts kind-qualified imports (import struct Foo.Bar)', async () => {
    const r = await swiftAdapter.parse('a.swift', `import struct Foo.Bar\n`);
    expect(r.imports[0].source).toBe('Foo.Bar');
  });

  it('handles attributed imports (@testable)', async () => {
    const r = await swiftAdapter.parse('a.swift', `@testable import MyModule\n`);
    expect(r.imports[0].source).toBe('MyModule');
  });
});

describe('swiftAdapter.exports', () => {
  it('captures top-level func / class / struct / protocol / enum', async () => {
    const src = `func sayHi() {}
class Widget {}
struct Point { var x: Int = 0 }
protocol Drawable { func draw() }
enum Color { case red, green, blue }
private func hidden() {}
`;
    const r = await swiftAdapter.parse('a.swift', src);
    const names = r.exports.map((e) => e.name);
    expect(names).toContain('sayHi');
    expect(names).toContain('Widget');
    expect(names).toContain('Point');
    expect(names).toContain('Drawable');
    expect(names).toContain('Color');
    expect(names).not.toContain('hidden');
  });

  it('captures typealias as type', async () => {
    const r = await swiftAdapter.parse('a.swift', `typealias UserId = Int\n`);
    const e = r.exports.find((x) => x.name === 'UserId');
    expect(e?.kind).toBe('type');
  });
});

describe('swiftAdapter cyclomatic complexity', () => {
  async function cc(code: string): Promise<number> {
    const r = await swiftAdapter.parse('test.swift', code);
    expect(r.ok).toBe(true);
    return r.cyclomaticComplexity;
  }

  it('empty file is CC=1', async () => {
    expect(await cc('')).toBe(1);
  });

  it('if adds 1', async () => {
    expect(await cc(`func f(x: Int) { if x > 0 { } }`)).toBe(2);
  });

  it('guard adds 1', async () => {
    expect(await cc(`func f(x: Int?) {
  guard let _ = x else { return }
}`)).toBe(2);
  });

  it('for and while each add 1', async () => {
    expect(
      await cc(`func f() {
  for _ in 0..<10 {}
  var i = 0
  while i < 10 { i += 1 }
}`),
    ).toBe(3);
  });
});

describe('swiftAdapter per-function CC', () => {
  it('emits one entry per top-level function', async () => {
    const r = await swiftAdapter.parse(
      'a.swift',
      `func one() {}
func two(_ x: Int) -> Int { if x > 0 { return 1 } else { return 0 } }
`,
    );
    expect(r.functions.length).toBeGreaterThanOrEqual(2);
    const map = new Map(r.functions.map((f) => [f.name, f.cyclomaticComplexity]));
    expect(map.get('one')).toBe(1);
    expect(map.get('two')).toBe(2);
  });

  it('names methods inside class as Type.method', async () => {
    const r = await swiftAdapter.parse(
      'a.swift',
      `class Widget {
  func make() -> Widget { return self }
  func name() -> String { return "w" }
}
`,
    );
    const names = r.functions.map((f) => f.name).sort();
    expect(names).toContain('Widget.make');
    expect(names).toContain('Widget.name');
  });
});

describe('swiftAdapter call sites', () => {
  it('captures function calls and dedupes', async () => {
    const r = await swiftAdapter.parse(
      'a.swift',
      `func main() {
  greet()
  greet()
  process(42)
}
`,
    );
    expect(new Set(r.callSites)).toEqual(new Set(['greet', 'process']));
  });
});

describe('swiftAdapter package name routing', () => {
  it('classifies external paths via toPackageName', () => {
    expect(swiftAdapter.toPackageName('Foundation')).toBe('Foundation');
    expect(swiftAdapter.toPackageName('UIKit.UIView')).toBe('UIKit');
  });
});
