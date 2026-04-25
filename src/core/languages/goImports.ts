import type { AstImport } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number };
  namedChildren: TsNode[];
}

/**
 * Extract import paths from a tree-sitter-go AST.
 *
 * Go imports come in two shapes:
 *   import "fmt"
 *   import (
 *       "fmt"
 *       "github.com/foo/bar"
 *       util "github.com/foo/util"   // alias
 *   )
 *
 * The grammar emits `import_declaration` containing one or more
 * `import_spec` nodes. Each spec has an `interpreted_string_literal` child
 * holding the import path (with surrounding quotes that we strip).
 */
export function extractGoImports(root: TsNode): AstImport[] {
  const out: AstImport[] = [];
  visit(root, out);
  return out;
}

function visit(node: TsNode, out: AstImport[]): void {
  for (const child of node.namedChildren) {
    if (child.type === 'import_declaration') {
      handleImportDecl(child, out);
    } else {
      // Imports must be top-level in Go, but we still descend through any
      // top-level wrappers (e.g. source_file).
      visit(child, out);
    }
  }
}

function handleImportDecl(node: TsNode, out: AstImport[]): void {
  const line = node.startPosition.row + 1;
  for (const c of node.namedChildren) {
    if (c.type === 'import_spec') {
      addSpec(c, line, out);
    } else if (c.type === 'import_spec_list') {
      for (const s of c.namedChildren) {
        if (s.type === 'import_spec') addSpec(s, line, out);
      }
    }
  }
}

function addSpec(spec: TsNode, line: number, out: AstImport[]): void {
  // Path is the interpreted_string_literal; we strip the surrounding quotes.
  const pathNode = spec.namedChildren.find(
    (c) => c.type === 'interpreted_string_literal' || c.type === 'raw_string_literal',
  );
  if (!pathNode) return;
  const raw = pathNode.text;
  const source = raw.replace(/^["`]|["`]$/g, '');
  if (!source) return;
  out.push({
    source,
    kind: 'static',
    specifiers: [],
    typeOnly: false,
    line,
  });
}
