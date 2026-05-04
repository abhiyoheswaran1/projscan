import { describe, it, expect } from 'vitest';
import { csharpAdapter } from '../../../src/core/languages/csharpAdapter.js';

describe('csharpAdapter.parse', () => {
  it('parses a trivial C# file', async () => {
    const r = await csharpAdapter.parse('Program.cs', `class Hello {}\n`);
    expect(r.ok).toBe(true);
    expect(r.lineCount).toBe(2);
  });

  it('handles parse errors gracefully (tree-sitter recovery)', async () => {
    const r = await csharpAdapter.parse('broken.cs', `class Oops { void f( {}\n`);
    expect(r.ok).toBe(true);
  });
});

describe('csharpAdapter.imports', () => {
  it('extracts a simple using', async () => {
    const r = await csharpAdapter.parse('a.cs', `using System;\n`);
    expect(r.imports.map((i) => i.source)).toEqual(['System']);
  });

  it('extracts dotted usings', async () => {
    const r = await csharpAdapter.parse(
      'a.cs',
      `using System.Collections.Generic;\nusing System.IO;\n`,
    );
    const sources = r.imports.map((i) => i.source).sort();
    expect(sources).toEqual(['System.Collections.Generic', 'System.IO']);
  });

  it('extracts using alias', async () => {
    const r = await csharpAdapter.parse(
      'a.cs',
      `using IntList = System.Collections.Generic.List<int>;\n`,
    );
    expect(r.imports).toHaveLength(1);
    expect(r.imports[0].specifiers).toEqual(['IntList']);
  });

  it('extracts using static', async () => {
    const r = await csharpAdapter.parse('a.cs', `using static System.Console;\n`);
    expect(r.imports[0].source).toBe('System.Console');
  });
});

describe('csharpAdapter.exports (visibility-based)', () => {
  it('captures public class but not internal class', async () => {
    const r = await csharpAdapter.parse(
      'a.cs',
      `public class Visible {}\ninternal class Hidden {}\nclass DefaultInternal {}\n`,
    );
    const names = r.exports.map((e) => e.name);
    expect(names).toContain('Visible');
    expect(names).not.toContain('Hidden');
    expect(names).not.toContain('DefaultInternal');
  });

  it('captures public class / interface / enum / struct / record kinds', async () => {
    const src = `public class Widget {}
public interface IDrawable {}
public enum Color { Red }
public struct Point {}
public record Person(string Name);
`;
    const r = await csharpAdapter.parse('a.cs', src);
    const byName = new Map(r.exports.map((e) => [e.name, e.kind]));
    expect(byName.get('Widget')).toBe('class');
    expect(byName.get('IDrawable')).toBe('interface');
    expect(byName.get('Color')).toBe('enum');
    expect(byName.get('Point')).toBe('class');
    expect(byName.get('Person')).toBe('class');
  });

  it('descends into namespace_declaration for nested types', async () => {
    const src = `namespace MyApp.Models {
  public class User {}
  internal class Hidden {}
}
`;
    const r = await csharpAdapter.parse('a.cs', src);
    const names = r.exports.map((e) => e.name);
    expect(names).toContain('User');
    expect(names).not.toContain('Hidden');
  });
});

describe('csharpAdapter cyclomatic complexity', () => {
  async function cc(code: string): Promise<number> {
    const r = await csharpAdapter.parse('test.cs', code);
    expect(r.ok).toBe(true);
    return r.cyclomaticComplexity;
  }

  it('empty file is CC=1', async () => {
    expect(await cc('')).toBe(1);
  });

  it('if adds 1', async () => {
    expect(await cc(`class C { void F(int x) { if (x > 0) {} } }`)).toBe(2);
  });

  it('foreach and while each add 1', async () => {
    expect(
      await cc(`class C {
  void F(int[] xs) {
    foreach (var x in xs) {}
    int i = 0;
    while (i < 10) { i++; }
  }
}`),
    ).toBe(3);
  });

  it('case arms count, default does not', async () => {
    expect(
      await cc(`class C {
  void F(int x) {
    switch (x) {
      case 1: break;
      case 2: break;
      default: break;
    }
  }
}`),
    ).toBe(3);
  });

  it('switch expression arms count, discard does not', async () => {
    expect(
      await cc(`class C {
  string F(int x) {
    return x switch {
      0 => "zero",
      1 => "one",
      _ => "other",
    };
  }
}`),
    ).toBe(3);
  });

  it('&& and || each add 1', async () => {
    expect(await cc(`class C { bool F(bool a, bool b, bool c) => a && b || c; }`)).toBe(3);
  });

  it('?? null coalesce adds 1', async () => {
    expect(await cc(`class C { string F(string a, string b) => a ?? b; }`)).toBe(2);
  });

  it('catch clause adds 1', async () => {
    expect(
      await cc(`class C {
  void F() {
    try { Do(); } catch (System.Exception) {}
  }
}`),
    ).toBe(2);
  });
});

describe('csharpAdapter per-function CC', () => {
  it('emits one entry per method with the right CC', async () => {
    const r = await csharpAdapter.parse(
      'a.cs',
      `class Widget {
  public int One() => 1;
  public int Two(int x) { if (x > 0) return 1; return 0; }
}
`,
    );
    expect(r.functions).toHaveLength(2);
    const map = new Map(r.functions.map((f) => [f.name, f.cyclomaticComplexity]));
    expect(map.get('Widget.One')).toBe(1);
    expect(map.get('Widget.Two')).toBe(2);
  });

  it('captures interface methods as Interface.method', async () => {
    const r = await csharpAdapter.parse(
      'a.cs',
      `interface IPrintable {
  void Print();
}
`,
    );
    expect(r.functions[0].name).toBe('IPrintable.Print');
  });

  it('captures constructor as Type.Type', async () => {
    const r = await csharpAdapter.parse(
      'a.cs',
      `class Widget {
  public Widget() {}
}
`,
    );
    const names = r.functions.map((f) => f.name);
    expect(names).toContain('Widget.Widget');
  });
});

describe('csharpAdapter call sites', () => {
  it('captures bare method calls and dedupes', async () => {
    const r = await csharpAdapter.parse(
      'a.cs',
      `class C {
  void Main() {
    Greet();
    Greet();
    Process(42);
  }
  void Greet() {}
  void Process(int x) {}
}
`,
    );
    expect(new Set(r.callSites)).toEqual(new Set(['Greet', 'Process']));
  });

  it('strips method-call qualification', async () => {
    const r = await csharpAdapter.parse(
      'a.cs',
      `class C {
  void Main() {
    var s = "hi";
    s.ToUpper();
    System.Console.WriteLine("x");
  }
}
`,
    );
    expect(r.callSites).toContain('ToUpper');
    expect(r.callSites).toContain('WriteLine');
  });
});

describe('csharpAdapter package name routing', () => {
  it('returns top namespace segment for dotted paths', () => {
    expect(csharpAdapter.toPackageName('System.Collections.Generic')).toBe('System');
    expect(csharpAdapter.toPackageName('Newtonsoft.Json.Linq')).toBe('Newtonsoft');
    expect(csharpAdapter.toPackageName('MyApp.Services')).toBe('MyApp');
  });
});
