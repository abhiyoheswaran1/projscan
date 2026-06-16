import { describe, it, expect } from 'vitest';
import { rustAdapter } from '../../../src/core/languages/rustAdapter.js';

describe('rustAdapter.parse', () => {
  it('parses a trivial Rust file', async () => {
    const r = await rustAdapter.parse('main.rs', 'fn main() {}\n');
    expect(r.ok).toBe(true);
    expect(r.lineCount).toBe(2);
  });

  it('handles parse errors gracefully (tree-sitter recovery)', async () => {
    const r = await rustAdapter.parse('broken.rs', 'fn oops( {}\n');
    expect(r.ok).toBe(true);
  });
});

describe('rustAdapter.imports', () => {
  it('extracts a simple use', async () => {
    const r = await rustAdapter.parse('a.rs', `use std::fs;\nfn main() {}\n`);
    expect(r.imports.map((i) => i.source)).toEqual(['std::fs']);
  });

  it('expands a brace list into multiple imports', async () => {
    const r = await rustAdapter.parse(
      'a.rs',
      `use std::collections::{HashMap, HashSet, BTreeMap};\nfn main() {}\n`,
    );
    const sources = r.imports.map((i) => i.source).sort();
    expect(sources).toEqual([
      'std::collections::BTreeMap',
      'std::collections::HashMap',
      'std::collections::HashSet',
    ]);
  });

  it('handles aliased imports (use ... as ...)', async () => {
    const r = await rustAdapter.parse(
      'a.rs',
      `use std::collections::HashMap as Map;\nfn main() {}\n`,
    );
    expect(r.imports).toHaveLength(1);
    expect(r.imports[0].source).toBe('std::collections::HashMap');
    expect(r.imports[0].specifiers).toEqual(['Map']);
  });

  it('captures crate:: / self:: / super:: paths', async () => {
    const r = await rustAdapter.parse(
      'a.rs',
      `use crate::foo::Bar;\nuse self::sibling::Baz;\nuse super::parent::Qux;\nfn main() {}\n`,
    );
    const sources = r.imports.map((i) => i.source).sort();
    expect(sources).toEqual(['crate::foo::Bar', 'self::sibling::Baz', 'super::parent::Qux']);
  });

  it('marks pub use as a re-export', async () => {
    const r = await rustAdapter.parse('a.rs', `pub use foo::bar::Baz;\nfn main() {}\n`);
    expect(r.imports).toHaveLength(1);
    expect(r.imports[0].source).toBe('foo::bar::Baz');
    expect(r.imports[0].kind).toBe('reexport');
  });

  it('handles a glob import', async () => {
    const r = await rustAdapter.parse('a.rs', `use foo::bar::*;\nfn main() {}\n`);
    expect(r.imports[0].source).toBe('foo::bar::*');
  });
});

describe('rustAdapter.exports (visibility-based)', () => {
  it('captures pub fn but not bare fn', async () => {
    const r = await rustAdapter.parse('a.rs', `pub fn public() {}\nfn private() {}\n`);
    const names = r.exports.map((e) => e.name);
    expect(names).toContain('public');
    expect(names).not.toContain('private');
  });

  it('captures pub struct / enum / trait with the right kinds', async () => {
    const src = `pub struct Widget { name: String }
pub enum Color { Red, Green, Blue }
pub trait Drawable { fn draw(&self); }
struct Hidden;
`;
    const r = await rustAdapter.parse('a.rs', src);
    const byName = new Map(r.exports.map((e) => [e.name, e.kind]));
    expect(byName.get('Widget')).toBe('class');
    expect(byName.get('Color')).toBe('enum');
    expect(byName.get('Drawable')).toBe('interface');
    expect(byName.has('Hidden')).toBe(false);
  });

  it('captures pub(crate) as public', async () => {
    const r = await rustAdapter.parse('a.rs', `pub(crate) fn crate_visible() {}\n`);
    expect(r.exports.map((e) => e.name)).toEqual(['crate_visible']);
  });

  it('captures pub const and pub static', async () => {
    const r = await rustAdapter.parse(
      'a.rs',
      `pub const MAX: i32 = 100;\npub static NAME: &str = "x";\n`,
    );
    expect(r.exports.map((e) => e.name).sort()).toEqual(['MAX', 'NAME']);
  });
});

describe('rustAdapter cyclomatic complexity', () => {
  async function cc(code: string): Promise<number> {
    const r = await rustAdapter.parse('test.rs', code);
    expect(r.ok).toBe(true);
    return r.cyclomaticComplexity;
  }

  it('empty file is CC=1', async () => {
    expect(await cc('')).toBe(1);
  });

  it('if adds 1', async () => {
    expect(await cc(`fn f(x: i32) { if x > 0 { } }`)).toBe(2);
  });

  it('match arms count, wildcard does not', async () => {
    // 2 non-wildcard arms + 1 wildcard => CC 3 (1 + 2)
    expect(
      await cc(`fn f(x: i32) {
  match x {
    1 => {},
    2 => {},
    _ => {},
  }
}`),
    ).toBe(3);
  });

  it('? operator counts (try expression)', async () => {
    expect(
      await cc(`fn f() -> Result<(), String> {
  let _ = std::env::var("X").map_err(|e| e.to_string())?;
  Ok(())
}`),
    ).toBeGreaterThanOrEqual(2);
  });

  it('&& and || each add 1', async () => {
    expect(await cc(`fn f(a: bool, b: bool, c: bool) -> bool { a && b || c }`)).toBe(3);
  });

  it('for and while each add 1', async () => {
    expect(
      await cc(`fn f() {
  for _ in 0..10 {}
  let mut i = 0;
  while i < 10 { i += 1; }
}`),
    ).toBe(3);
  });
});

describe('rustAdapter per-function CC', () => {
  it('emits one entry per function with the right CC', async () => {
    const r = await rustAdapter.parse(
      'a.rs',
      `fn one() {}
fn two(x: i32) -> i32 { if x > 0 { 1 } else { 0 } }
`,
    );
    expect(r.functions).toHaveLength(2);
    const map = new Map(r.functions.map((f) => [f.name, f.cyclomaticComplexity]));
    expect(map.get('one')).toBe(1);
    expect(map.get('two')).toBe(2);
  });

  it('names methods inside impl as Type.method', async () => {
    const r = await rustAdapter.parse(
      'a.rs',
      `struct Widget;
impl Widget {
  fn make() -> Widget { Widget }
  fn name(&self) -> &str { "w" }
}
`,
    );
    const names = r.functions.map((f) => f.name).sort();
    expect(names).toEqual(['Widget.make', 'Widget.name']);
  });

  it('names trait methods as Trait.method', async () => {
    const r = await rustAdapter.parse(
      'a.rs',
      `trait Printable {
  fn print(&self) {}
}
`,
    );
    expect(r.functions[0].name).toBe('Printable.print');
  });
});

describe('rustAdapter call sites', () => {
  it('captures bare function calls and dedupes', async () => {
    const r = await rustAdapter.parse(
      'a.rs',
      `fn main() {
  greet();
  greet();
  process(42);
}
`,
    );
    expect(new Set(r.callSites)).toEqual(new Set(['greet', 'process']));
  });

  it('strips method-call qualification', async () => {
    const r = await rustAdapter.parse(
      'a.rs',
      `fn main() {
  let s = String::new();
  s.push_str("hi");
}
`,
    );
    expect(r.callSites).toContain('push_str');
    // `String::new` calls — we surface the bare leaf.
    expect(r.callSites).toContain('new');
  });
});

describe('rustAdapter package name routing', () => {
  it('classifies external crate paths via toPackageName', () => {
    expect(rustAdapter.toPackageName('std::fs::read_to_string')).toBe('std');
    expect(rustAdapter.toPackageName('serde::Deserialize')).toBe('serde');
    expect(rustAdapter.toPackageName('tokio::main')).toBe('tokio');
  });

  it('returns null for crate:: / self:: / super:: paths (handled by resolveImport)', () => {
    expect(rustAdapter.toPackageName('crate::foo')).toBeNull();
    expect(rustAdapter.toPackageName('self::bar')).toBeNull();
    expect(rustAdapter.toPackageName('super::baz')).toBeNull();
  });
});
