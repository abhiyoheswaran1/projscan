import type { AstExport, SymbolKind } from '../ast.js';

interface TsNode {
  type: string;
  text: string;
  startPosition: { row: number };
  namedChildren: TsNode[];
  childForFieldName?(name: string): TsNode | null;
}

/**
 * Extract package-level "exports" from a Ruby AST.
 *
 * Ruby has no visibility marker on top-level constants - every top-level
 * `class`, `module`, and `def` is part of the file's surface. We capture all
 * three at the top level only (nested defs are part of an enclosing class's
 * surface, not separate file-level exports).
 *
 * Names: leading underscore is treated as a private convention (`_helper`),
 * but we still record it - Ruby doesn't enforce it, and other modules can
 * still call it.
 */
export function extractRubyExports(root: TsNode): AstExport[] {
  const out: AstExport[] = [];
  for (const child of root.namedChildren) {
    visitTopLevel(child, out);
  }
  return out;
}

function visitTopLevel(node: TsNode, out: AstExport[]): void {
  switch (node.type) {
    case 'class':
      addNamed(node, 'class', out, 'constant');
      return;
    case 'module':
      addNamed(node, 'type', out, 'constant');
      return;
    case 'method':
      addNamed(node, 'function', out, 'identifier');
      return;
    default:
      return;
  }
}

function addNamed(
  node: TsNode,
  kind: SymbolKind,
  out: AstExport[],
  nameType: 'constant' | 'identifier',
): void {
  const nameNode =
    node.childForFieldName?.('name') ?? findChild(node, nameType) ?? findChild(node, 'identifier');
  if (!nameNode) return;
  out.push({
    name: nameNode.text,
    kind,
    typeOnly: false,
    line: node.startPosition.row + 1,
  });
}

function findChild(node: TsNode, type: string): TsNode | null {
  for (const c of node.namedChildren) {
    if (c.type === type) return c;
  }
  return null;
}
