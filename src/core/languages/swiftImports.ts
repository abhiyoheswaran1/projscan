import type { AstImport } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number; column: number };
  namedChildren: TsNode[];
  childForFieldName?: (name: string) => TsNode | null;
}

/**
 * Extract Swift `import` statements from a tree-sitter-swift AST.
 *
 * Handled forms:
 *   import Foundation                     → source = "Foundation"
 *   import struct Foo.Bar                 → source = "Foo.Bar"
 *   import class Foo.Bar.Baz              → source = "Foo.Bar.Baz"
 *   @testable import MyModule             → source = "MyModule"
 *   @_implementationOnly import Private   → source = "Private"
 *
 * Swift modules don't expose individual symbols at import time the way
 * JS named imports do; the import binds the whole module / submodule.
 */
export function extractSwiftImports(root: TsNode): AstImport[] {
  const imports: AstImport[] = [];
  walk(root, (n) => {
    if (n.type !== 'import_declaration') return;
    const source = readImportPath(n);
    if (!source) return;
    imports.push({
      source,
      kind: 'static',
      specifiers: [],
      typeOnly: false,
      line: n.startPosition.row + 1,
    });
  });
  return imports;
}

function readImportPath(node: TsNode): string {
  const text = node.text.trim();
  let body = text.replace(/^\s*(@[A-Za-z_][\w]*\s*)+/, '');
  body = body.replace(/^\s*import\b/, '').trim();
  body = body.replace(
    /^(typealias|struct|class|enum|protocol|let|var|func)\b\s*/,
    '',
  );
  const m = /^[A-Za-z_][\w.]*/.exec(body);
  return m ? m[0] : '';
}

function walk(node: TsNode, visit: (n: TsNode) => void): void {
  visit(node);
  for (const child of node.namedChildren) walk(child, visit);
}
