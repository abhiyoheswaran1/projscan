import { describe, it, expect } from 'vitest';
import { phpAdapter } from '../../../src/core/languages/phpAdapter.js';

describe('phpAdapter.parse', () => {
  it('parses a trivial PHP file', async () => {
    const r = await phpAdapter.parse('a.php', '<?php\n$x = 1;\n');
    expect(r.ok).toBe(true);
    expect(r.lineCount).toBe(3);
  });

  it('handles parse errors gracefully (tree-sitter recovery)', async () => {
    const r = await phpAdapter.parse('broken.php', '<?php\nfunction oops( {\n');
    expect(r.ok).toBe(true);
  });
});

describe('phpAdapter.imports', () => {
  it('extracts a simple use', async () => {
    const r = await phpAdapter.parse('a.php', `<?php\nuse Foo\\Bar;\n`);
    expect(r.imports.map((i) => i.source)).toEqual(['Foo\\Bar']);
  });

  it('extracts use with alias', async () => {
    const r = await phpAdapter.parse('a.php', `<?php\nuse Foo\\Bar as Baz;\n`);
    expect(r.imports).toHaveLength(1);
    expect(r.imports[0].source).toBe('Foo\\Bar');
    expect(r.imports[0].specifiers).toEqual(['Baz']);
  });

  it('expands a brace-list use', async () => {
    const r = await phpAdapter.parse('a.php', `<?php\nuse Foo\\{Bar, Baz, Qux};\n`);
    const sources = r.imports.map((i) => i.source).sort();
    expect(sources).toEqual(['Foo\\Bar', 'Foo\\Baz', 'Foo\\Qux']);
  });

  it('extracts require/include path strings', async () => {
    const r = await phpAdapter.parse(
      'a.php',
      `<?php\nrequire 'lib/util.php';\ninclude_once 'config.php';\n`,
    );
    const sources = r.imports.map((i) => i.source).sort();
    expect(sources).toEqual(['config.php', 'lib/util.php']);
  });
});

describe('phpAdapter.exports', () => {
  it('captures top-level function/class/interface/trait/enum', async () => {
    const src = `<?php
function helper() {}
class Widget {}
interface Drawable {}
trait Loggable {}
enum Color { case Red; case Green; }
`;
    const r = await phpAdapter.parse('a.php', src);
    const byName = new Map(r.exports.map((e) => [e.name, e.kind]));
    expect(byName.get('helper')).toBe('function');
    expect(byName.get('Widget')).toBe('class');
    expect(byName.get('Drawable')).toBe('interface');
    expect(byName.get('Loggable')).toBe('class');
    expect(byName.get('Color')).toBe('enum');
  });

  it('descends into namespace_definition for top-level decls', async () => {
    const src = `<?php
namespace App\\Models {
  class User {}
  function find() {}
}
`;
    const r = await phpAdapter.parse('a.php', src);
    const names = r.exports.map((e) => e.name).sort();
    expect(names).toEqual(['User', 'find']);
  });
});

describe('phpAdapter cyclomatic complexity', () => {
  async function cc(code: string): Promise<number> {
    const r = await phpAdapter.parse('test.php', code);
    expect(r.ok).toBe(true);
    return r.cyclomaticComplexity;
  }

  it('empty file is CC=1', async () => {
    expect(await cc('<?php\n')).toBe(1);
  });

  it('if adds 1', async () => {
    expect(await cc(`<?php\nfunction f($x) { if ($x > 0) { } }\n`)).toBe(2);
  });

  it('elseif adds 1, else does not', async () => {
    expect(
      await cc(`<?php
function f($x) {
  if ($x > 0) {}
  elseif ($x < 0) {}
  else {}
}
`),
    ).toBe(3);
  });

  it('foreach and while each add 1', async () => {
    expect(
      await cc(`<?php
function f($xs) {
  foreach ($xs as $x) {}
  $i = 0;
  while ($i < 10) { $i++; }
}
`),
    ).toBe(3);
  });

  it('case arms count, default does not', async () => {
    expect(
      await cc(`<?php
function f($x) {
  switch ($x) {
    case 1: break;
    case 2: break;
    default: break;
  }
}
`),
    ).toBe(3);
  });

  it('&& and || each add 1', async () => {
    expect(await cc(`<?php\nfunction f($a, $b, $c) { return $a && $b || $c; }\n`)).toBe(3);
  });

  it('?? null coalesce adds 1', async () => {
    expect(await cc(`<?php\nfunction f($a, $b) { return $a ?? $b; }\n`)).toBe(2);
  });

  it('ternary adds 1', async () => {
    expect(await cc(`<?php\nfunction f($a) { return $a ? 1 : 0; }\n`)).toBe(2);
  });

  it('catch clause adds 1', async () => {
    expect(
      await cc(`<?php
function f() {
  try { something(); } catch (\\Exception $e) {}
}
`),
    ).toBe(2);
  });
});

describe('phpAdapter per-function CC', () => {
  it('emits one entry per function', async () => {
    const r = await phpAdapter.parse(
      'a.php',
      `<?php
function one() {}
function two($x) { if ($x > 0) { return 1; } return 0; }
`,
    );
    expect(r.functions).toHaveLength(2);
    const map = new Map(r.functions.map((f) => [f.name, f.cyclomaticComplexity]));
    expect(map.get('one')).toBe(1);
    expect(map.get('two')).toBe(2);
  });

  it('names methods inside class as Type.method', async () => {
    const r = await phpAdapter.parse(
      'a.php',
      `<?php
class Widget {
  public function make() {}
  public function name() { return 'w'; }
}
`,
    );
    const names = r.functions.map((f) => f.name).sort();
    expect(names).toEqual(['Widget.make', 'Widget.name']);
  });

  it('names interface methods as Interface.method', async () => {
    const r = await phpAdapter.parse(
      'a.php',
      `<?php
interface Printable {
  public function print();
}
`,
    );
    expect(r.functions[0].name).toBe('Printable.print');
  });
});

describe('phpAdapter call sites', () => {
  it('captures bare function calls and dedupes', async () => {
    const r = await phpAdapter.parse(
      'a.php',
      `<?php
function main() {
  greet();
  greet();
  process(42);
}
`,
    );
    expect(new Set(r.callSites)).toEqual(new Set(['greet', 'process']));
  });

  it('strips method-call qualification', async () => {
    const r = await phpAdapter.parse(
      'a.php',
      `<?php
function main() {
  $s = new Builder();
  $s->push('hi');
  Foo::create();
}
`,
    );
    expect(r.callSites).toContain('push');
    expect(r.callSites).toContain('create');
  });
});

describe('phpAdapter package name routing', () => {
  it('returns top namespace segment for namespace use paths', () => {
    expect(phpAdapter.toPackageName('Symfony\\Component\\HttpFoundation\\Request')).toBe('Symfony');
    expect(phpAdapter.toPackageName('Doctrine\\ORM\\EntityManager')).toBe('Doctrine');
  });

  it('returns null for relative include paths', () => {
    expect(phpAdapter.toPackageName('./local.php')).toBeNull();
    expect(phpAdapter.toPackageName('../up/file.php')).toBeNull();
    expect(phpAdapter.toPackageName('/abs/path.php')).toBeNull();
    expect(phpAdapter.toPackageName('lib/util.php')).toBeNull();
  });
});
