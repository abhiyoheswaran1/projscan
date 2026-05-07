import type { AstImport } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract C++ `#include` directives from a tree-sitter-cpp AST.
 *
 * Handled forms:
 *   #include "foo.h"          → source = "foo.h"     (project-local convention)
 *   #include <vector>         → source = "vector"    (system / library header)
 *   #include "../bar/baz.hpp" → source = "../bar/baz.hpp"
 *
 * Modules (C++20 `import std;` / `import :foo;`) are also captured as
 * static imports when the grammar recognises them. Specifiers are not
 * extracted (C++ #include is whole-file inclusion, not symbol binding).
 */
export function extractCppImports(root: TsNode): AstImport[] {
  const imports: AstImport[] = [];
  walk(root, (n) => {
    if (n.type === 'preproc_include') {
      const path = readIncludePath(n);
      if (!path) return;
      imports.push({
        source: path.value,
        kind: 'static',
        specifiers: [],
        typeOnly: false,
        line: n.startPosition.row + 1,
      });
      return;
    }
    if (n.type === 'import_declaration' || n.type === 'module_import') {
      const m = /^\s*(?:export\s+)?import\s+([^;]+);/.exec(n.text);
      if (m) {
        imports.push({
          source: m[1].trim(),
          kind: 'static',
          specifiers: [],
          typeOnly: false,
          line: n.startPosition.row + 1,
        });
      }
    }
  });
  return imports;
}

interface IncludePath {
  value: string;
  isQuoted: boolean;
}

function readIncludePath(node: TsNode): IncludePath | null {
  // tree-sitter-cpp typically exposes the included path as either a
  // `string_literal` (quoted) or a `system_lib_string` (angle-bracketed)
  // child. Some grammar versions use `path` field; we fall back to text.
  if (node.childForFieldName) {
    const p = node.childForFieldName('path');
    if (p) return classify(p.text);
  }
  for (const c of node.namedChildren) {
    if (c.type === 'string_literal' || c.type === 'system_lib_string') {
      return classify(c.text);
    }
  }
  // Fallback: parse from the node's full text.
  const m = /#\s*include\s*([<"][^>"]*[>"])/.exec(node.text);
  return m ? classify(m[1]) : null;
}

function classify(raw: string): IncludePath | null {
  const text = raw.trim();
  if (text.startsWith('"') && text.endsWith('"')) {
    return { value: text.slice(1, -1), isQuoted: true };
  }
  if (text.startsWith('<') && text.endsWith('>')) {
    return { value: text.slice(1, -1), isQuoted: false };
  }
  return null;
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
