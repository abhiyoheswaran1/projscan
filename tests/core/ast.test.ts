import { describe, it, expect } from 'vitest';
import { parseSource, isParseable } from '../../src/core/ast.js';

describe('isParseable', () => {
  it('accepts source extensions', () => {
    expect(isParseable('src/a.ts')).toBe(true);
    expect(isParseable('src/a.tsx')).toBe(true);
    expect(isParseable('src/a.js')).toBe(true);
    expect(isParseable('src/a.jsx')).toBe(true);
    expect(isParseable('src/a.mjs')).toBe(true);
    expect(isParseable('src/a.cjs')).toBe(true);
  });

  it('rejects non-source extensions', () => {
    expect(isParseable('README.md')).toBe(false);
    expect(isParseable('image.png')).toBe(false);
    expect(isParseable('package.json')).toBe(false);
  });
});

describe('parseSource', () => {
  it('parses plain ES imports', () => {
    const r = parseSource(
      'a.ts',
      "import React from 'react';\nimport { join } from 'node:path';",
    );
    expect(r.ok).toBe(true);
    expect(r.imports).toHaveLength(2);
    expect(r.imports[0]).toMatchObject({
      source: 'react',
      kind: 'static',
      specifiers: ['default'],
      typeOnly: false,
    });
    expect(r.imports[1].source).toBe('node:path');
  });

  it('captures import type (which the old regex missed)', () => {
    const r = parseSource('a.ts', "import type { Foo } from './types.js';");
    expect(r.ok).toBe(true);
    expect(r.imports).toHaveLength(1);
    expect(r.imports[0].typeOnly).toBe(true);
    expect(r.imports[0].specifiers).toEqual(['Foo']);
  });

  it('captures dynamic import()', () => {
    const r = parseSource('a.ts', "const mod = await import('./lazy.js');");
    expect(r.imports).toHaveLength(1);
    expect(r.imports[0].kind).toBe('dynamic');
    expect(r.imports[0].source).toBe('./lazy.js');
  });

  it('captures CommonJS require()', () => {
    const r = parseSource('a.js', "const x = require('express');");
    expect(r.imports).toHaveLength(1);
    expect(r.imports[0].kind).toBe('require');
    expect(r.imports[0].source).toBe('express');
  });

  it('captures re-exports as imports', () => {
    const r = parseSource('a.ts', "export { foo } from './foo.js';");
    expect(r.imports).toHaveLength(1);
    expect(r.imports[0].kind).toBe('reexport');
  });

  it('extracts named function exports', () => {
    const r = parseSource('a.ts', 'export function hello() { return 1; }');
    expect(r.exports).toHaveLength(1);
    expect(r.exports[0]).toMatchObject({ name: 'hello', kind: 'function' });
  });

  it('extracts class and const exports', () => {
    const r = parseSource('a.ts', 'export class Widget {}\nexport const VERSION = 1;');
    const names = r.exports.map((e) => e.name);
    expect(names).toContain('Widget');
    expect(names).toContain('VERSION');
  });

  it('extracts interface / type / enum exports (TypeScript)', () => {
    const r = parseSource(
      'a.ts',
      'export interface User { id: string }\nexport type Role = "admin" | "user";\nexport enum Color { Red, Blue }',
    );
    const byName = Object.fromEntries(r.exports.map((e) => [e.name, e.kind]));
    expect(byName.User).toBe('interface');
    expect(byName.Role).toBe('type');
    expect(byName.Color).toBe('enum');
  });

  it('handles JSX', () => {
    const r = parseSource(
      'a.tsx',
      'import React from "react";\nexport const App = () => <div>hi</div>;',
    );
    expect(r.ok).toBe(true);
    expect(r.exports.map((e) => e.name)).toContain('App');
  });

  it('handles decorators-legacy', () => {
    const r = parseSource(
      'a.ts',
      '@Component({})\nexport class MyComponent {}',
    );
    expect(r.ok).toBe(true);
    expect(r.exports.some((e) => e.name === 'MyComponent')).toBe(true);
  });

  it('returns ok:false with reason on malformed source', () => {
    const r = parseSource('a.ts', 'export function {');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/parse error/);
  });

  it('returns default export', () => {
    const r = parseSource('a.ts', 'export default function foo() {}');
    expect(r.exports.some((e) => e.name === 'default')).toBe(true);
  });

  it('collects call sites', () => {
    const r = parseSource(
      'a.ts',
      'function main() { helper(); util.do(); return 1; }\nmain();',
    );
    expect(r.callSites).toContain('main');
    expect(r.callSites).toContain('helper');
    expect(r.callSites).toContain('do');
  });
});
