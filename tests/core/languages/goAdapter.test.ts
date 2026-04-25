import { describe, it, expect } from 'vitest';
import { goAdapter } from '../../../src/core/languages/goAdapter.js';

describe('goAdapter.parse', () => {
  it('parses a trivial Go file', async () => {
    const r = await goAdapter.parse('main.go', 'package main\n\nfunc main() {}\n');
    expect(r.ok).toBe(true);
    expect(r.lineCount).toBe(4);
  });

  it('handles parse errors without throwing (tree-sitter recovery)', async () => {
    const r = await goAdapter.parse('broken.go', 'package broken\n\nfunc oops( {}\n');
    expect(r.ok).toBe(true); // recovers
  });
});

describe('goAdapter.imports', () => {
  it('extracts a single-line import', async () => {
    const r = await goAdapter.parse('a.go', `package a\n\nimport "fmt"\n`);
    expect(r.imports.map((i) => i.source)).toEqual(['fmt']);
  });

  it('extracts a parenthesized import block including aliases', async () => {
    const src = `package a

import (
    "fmt"
    "github.com/foo/bar"
    util "github.com/foo/util"
)
`;
    const r = await goAdapter.parse('a.go', src);
    expect(r.imports.map((i) => i.source).sort()).toEqual([
      'fmt',
      'github.com/foo/bar',
      'github.com/foo/util',
    ]);
  });
});

describe('goAdapter.exports (Go capitalization rule)', () => {
  it('captures exported funcs but not unexported', async () => {
    const r = await goAdapter.parse(
      'a.go',
      `package a\n\nfunc Public() {}\nfunc private() {}\n`,
    );
    expect(r.exports.map((e) => e.name)).toEqual(['Public']);
  });

  it('captures exported types (struct vs interface kind)', async () => {
    const src = `package a

type Widget struct {
    Name string
}

type Reader interface {
    Read() error
}

type lowercaseHidden struct{}
`;
    const r = await goAdapter.parse('a.go', src);
    const widget = r.exports.find((e) => e.name === 'Widget');
    const reader = r.exports.find((e) => e.name === 'Reader');
    expect(widget?.kind).toBe('class'); // struct -> class
    expect(reader?.kind).toBe('interface');
    expect(r.exports.find((e) => e.name === 'lowercaseHidden')).toBeUndefined();
  });

  it('captures exported var/const', async () => {
    const src = `package a

var Version = "1.0"
const Pi = 3.14
var hidden = "x"
`;
    const r = await goAdapter.parse('a.go', src);
    expect(r.exports.map((e) => e.name).sort()).toEqual(['Pi', 'Version']);
  });
});

describe('goAdapter cyclomatic complexity', () => {
  it('empty file is CC=1', async () => {
    const r = await goAdapter.parse('a.go', 'package a\n');
    expect(r.cyclomaticComplexity).toBe(1);
  });

  it('counts if + for + && in a function', async () => {
    const src = `package a

func F(xs []int) int {
    n := 0
    for _, x := range xs {
        if x > 0 && x < 100 {
            n++
        }
    }
    return n
}
`;
    const r = await goAdapter.parse('a.go', src);
    // for(+1) + if(+1) + &&(+1) = 3 -> CC 4
    expect(r.cyclomaticComplexity).toBe(4);
  });

  it('counts switch cases (default does not count)', async () => {
    const src = `package a

func F(x int) string {
    switch x {
    case 1: return "one"
    case 2: return "two"
    case 3: return "three"
    default: return "?"
    }
}
`;
    const r = await goAdapter.parse('a.go', src);
    // 3 case clauses -> CC 4
    expect(r.cyclomaticComplexity).toBe(4);
  });
});
